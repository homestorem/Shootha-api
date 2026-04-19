import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut, verifyBeforeUpdateEmail, reload } from "firebase/auth";
import { registerPushToken } from "@/lib/notifications";
import { clearPendingFirebaseBridgeTicket } from "@/lib/firebaseBridgeTicket";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { isValidEmailFormat } from "@/lib/validation";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  buildAuthUserFromPhone,
  mergeFirestorePlayerProfile,
  isPhoneAlreadyRegistered,
  ensureFirestoreUserByPhone,
  type FirestoreUserExtras,
} from "@/lib/firebasePhoneAuth";
import { normalizeIqPhoneToE164, isValidIqMobileE164 } from "@/lib/phoneE164";
import { ensureFirebaseAuthForSupportChat } from "@/lib/firebaseSupportAuth";
import { uploadImageIfConfigured, isRemoteImageUrl } from "@/lib/cloudinary-upload";
import { router } from "expo-router";

export type UserRole = "player" | "guest" | "supervisor";

export type AuthUser = {
  id: string;
  /** معرّف التطبيق القصير (ثابت) — يُخزَّن في Firestore ويُستخدم للحجوزات والربط */
  playerId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  dateOfBirth?: string | null;
  profileImage?: string | null;
  gender?: string | null;
  position?: string | null;
  /** رمز دعوة صديق — يُولَّد مع الحساب ويُعرض في الملف الشخصي */
  inviteCode?: string | null;
};

export type PendingPlayerData = {
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  profileImage?: string;
  userLat?: string;
  userLon?: string;
  gender?: string;
  position?: string;
};

export type PendingOwnerData = {
  name: string;
  phone: string;
  venueName: string;
  areaName: string;
  fieldSize: string;
  bookingPrice: string;
  hasBathrooms: boolean;
  hasMarket: boolean;
  latitude: string;
  longitude: string;
  venueImages?: string[];
  ownerDeviceLat?: string;
  ownerDeviceLon?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isGuest: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestLoginPhoneOtp: (rawPhone: string) => Promise<void>;
  verifyLoginPhoneOtp: (code: string) => Promise<void>;
  signInPlayerSession: (user: AuthUser) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    dateOfBirth?: string;
    profileImage?: string;
    position?: string | null;
  }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendEmailChangeOtp: (newEmail: string) => Promise<Record<string, never>>;
  updateEmail: (newEmail: string, otp: string) => Promise<void>;
  /** مزامنة inviteCode من Firestore (للحسابات القديمة أو بعد التسجيل) — يعيد playerId بعد المزامنة أو null */
  refreshPlayerFromFirestore: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_KEY = "shootha_auth_token";
const AUTH_USER_KEY = "shootha_auth_user";
const AUTH_GUEST_KEY = "shootha_auth_guest";
const ONE_TIME_CLEAR_LEGACY_GUEST_KEY = "shootha_migrate_clear_guest_v1";
export const PENDING_REG_KEY = "shootha_pending_reg";
const PENDING_OTP_PHONE_KEY = "shootha_pending_otp_phone";
/** جلسة اللاعب بعد تسجيل الدخول — يُقرأ عند إقلاع التطبيق */
const USER_SESSION_KEY = "user_session";

const GUEST_USER: AuthUser = {
  id: "guest",
  playerId: "",
  name: "ضيف",
  email: "",
  phone: "",
  role: "guest",
};

const LEGACY_MSG =
  "سيتم حفظ التعديلات على السحابة بعد ربط الخادم.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const updateProfileInFlightRef = useRef(false);

  const persistPlayer = useCallback(async (u: AuthUser) => {
    const normalized: AuthUser = {
      ...u,
      playerId: u.playerId ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      inviteCode: u.inviteCode?.trim() || null,
    };
    await AsyncStorage.multiSet([
      [AUTH_USER_KEY, JSON.stringify(normalized)],
      [USER_SESSION_KEY, JSON.stringify(normalized)],
    ]);
    await AsyncStorage.removeItem(AUTH_GUEST_KEY);
    setUser(normalized);
    setToken(null);
    setIsGuest(false);
  }, []);

  const initAuth = useCallback(async () => {
    try {
      const migrated = await AsyncStorage.getItem(ONE_TIME_CLEAR_LEGACY_GUEST_KEY);
      if (!migrated) {
        await AsyncStorage.setItem(ONE_TIME_CLEAR_LEGACY_GUEST_KEY, "1");
        try {
          const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);
          if (rawUser) {
            const u = JSON.parse(rawUser) as AuthUser;
            if (u.role === "guest") {
              await AsyncStorage.multiRemove([
                AUTH_USER_KEY,
                AUTH_GUEST_KEY,
                AUTH_TOKEN_KEY,
                USER_SESSION_KEY,
              ]);
            }
          } else if ((await AsyncStorage.getItem(AUTH_GUEST_KEY)) === "true") {
            await AsyncStorage.removeItem(AUTH_GUEST_KEY);
          }
        } catch {
          await AsyncStorage.multiRemove([AUTH_USER_KEY, AUTH_GUEST_KEY]);
        }
      }

      const [storedToken, storedUser, storedGuest, userSessionRaw] =
        await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
          AsyncStorage.getItem(AUTH_GUEST_KEY),
          AsyncStorage.getItem(USER_SESSION_KEY),
        ]);

      if (userSessionRaw) {
        try {
          const su = JSON.parse(userSessionRaw) as AuthUser;
          if (
            su &&
            su.role === "player" &&
            su.id &&
            su.id !== "guest"
          ) {
            const normalized: AuthUser = {
              ...su,
              playerId: su.playerId ?? "",
              email: su.email ?? "",
              phone: su.phone ?? "",
              inviteCode: su.inviteCode?.trim() || null,
            };
            setUser(normalized);
            setIsGuest(false);
            setToken(storedToken);
            if (storedToken) {
              registerPushToken(storedToken, {
                id: normalized.id,
                phone: normalized.phone,
              }).catch(() => {});
            }
            await AsyncStorage.setItem(
              AUTH_USER_KEY,
              JSON.stringify(normalized),
            );
            return;
          }
          await AsyncStorage.removeItem(USER_SESSION_KEY);
        } catch {
          await AsyncStorage.removeItem(USER_SESSION_KEY);
        }
      }

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          const parsed = JSON.parse(storedUser) as AuthUser;
          const normalizedTok: AuthUser = {
            ...parsed,
            playerId: parsed.playerId ?? "",
            email: parsed.email ?? "",
            phone: parsed.phone ?? "",
            inviteCode: parsed.inviteCode?.trim() || null,
          };
          setUser(normalizedTok);
          if (parsed.role === "player" && parsed.id !== "guest") {
            await AsyncStorage.setItem(
              USER_SESSION_KEY,
              JSON.stringify(normalizedTok),
            );
          }
          registerPushToken(storedToken, {
            id: normalizedTok.id,
            phone: normalizedTok.phone,
          }).catch(() => {});
        } catch {
          await Promise.all([
            AsyncStorage.removeItem(AUTH_TOKEN_KEY),
            AsyncStorage.removeItem(AUTH_USER_KEY),
            AsyncStorage.removeItem(USER_SESSION_KEY),
          ]);
          if (GUEST_FULL_ACCESS) {
            await AsyncStorage.multiSet([
              [AUTH_GUEST_KEY, "true"],
              [AUTH_USER_KEY, JSON.stringify(GUEST_USER)],
            ]);
            setToken(null);
            setUser(GUEST_USER);
            setIsGuest(true);
          }
        }
      } else if (storedUser) {
        try {
          const u = JSON.parse(storedUser) as AuthUser;
          if (u.role === "guest") {
            setUser({
              ...u,
              playerId: u.playerId ?? "",
              email: u.email ?? "",
              phone: u.phone ?? "",
            });
            setIsGuest(true);
            setToken(null);
          } else {
            const normalizedU: AuthUser = {
              ...u,
              playerId: u.playerId ?? "",
              email: u.email ?? "",
              phone: u.phone ?? "",
              inviteCode: u.inviteCode?.trim() || null,
            };
            setUser(normalizedU);
            setToken(storedToken);
            setIsGuest(false);
            if (u.role === "player" && u.id !== "guest") {
              await AsyncStorage.setItem(
                USER_SESSION_KEY,
                JSON.stringify(normalizedU),
              );
            }
          }
        } catch {
          await AsyncStorage.removeItem(AUTH_USER_KEY);
        }
      } else if (storedGuest === "true") {
        try {
          const u = storedUser
            ? (JSON.parse(storedUser) as AuthUser)
            : GUEST_USER;
          if (u.role === "guest") {
            setUser({
              ...u,
              playerId: u.playerId ?? "",
              email: u.email ?? "",
              phone: u.phone ?? "",
            });
            setIsGuest(true);
            setToken(null);
          } else {
            await AsyncStorage.removeItem(AUTH_GUEST_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(AUTH_GUEST_KEY);
        }
      } else if (GUEST_FULL_ACCESS) {
        await AsyncStorage.removeItem(USER_SESSION_KEY);
        await AsyncStorage.multiSet([
          [AUTH_GUEST_KEY, "true"],
          [AUTH_USER_KEY, JSON.stringify(GUEST_USER)],
        ]);
        setToken(null);
        setUser(GUEST_USER);
        setIsGuest(true);
      }
    } catch (e) {
      console.error("Auth init error:", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await initAuth();
      setIsLoading(false);
    })();
  }, [initAuth]);

  useEffect(() => {
    if (isLoading || !user || isGuest || user.role !== "player") return;
    const phone = normalizeIqPhoneToE164(user.phone || user.id || "");
    if (!isValidIqMobileE164(phone)) return;
    void ensureFirebaseAuthForSupportChat(phone).catch(() => {});
  }, [isLoading, user?.id, user?.phone, user?.role, isGuest]);

  const signInPlayerSession = useCallback(
    async (player: AuthUser) => {
      await persistPlayer(player);
      const phone = normalizeIqPhoneToE164(player.phone || player.id || "");
      if (isValidIqMobileE164(phone)) {
        void ensureFirebaseAuthForSupportChat(phone).catch(() => {});
      }
    },
    [persistPlayer],
  );

  const refreshPlayerFromFirestore = useCallback(async (): Promise<string | null> => {
    if (!user || user.role !== "player" || user.id === "guest" || !user.phone?.trim()) return null;
    const phone = normalizeIqPhoneToE164(user.phone);
    if (!isValidIqMobileE164(phone)) return null;
    try {
      await ensureFirestoreUserByPhone(phone, {});
      const fresh = await buildAuthUserFromPhone(phone);
      await persistPlayer(fresh);
      return (fresh.playerId ?? "").trim() || null;
    } catch (e) {
      console.warn("[auth] refreshPlayerFromFirestore", e);
      return null;
    }
  }, [user, persistPlayer]);

  const requestLoginPhoneOtp = useCallback(async (rawPhone: string) => {
    const e164 = normalizeIqPhoneToE164(rawPhone);
    if (!isValidIqMobileE164(e164)) {
      throw new Error("رقم الجوال غير صالح (مثال: 07XXXXXXXXX)");
    }
    await AsyncStorage.setItem(PENDING_OTP_PHONE_KEY, e164);
    await sendPhoneOtp(e164);
  }, []);

  const verifyLoginPhoneOtp = useCallback(
    async (code: string) => {
      const phone = (await AsyncStorage.getItem(PENDING_OTP_PHONE_KEY))?.trim() ?? "";
      if (!phone) {
        throw new Error("انتهت الجلسة — اطلب رمزاً جديداً من شاشة تسجيل الدخول.");
      }
      await verifyPhoneOtp(phone, code);
      if (!(await isPhoneAlreadyRegistered(phone))) {
        await AsyncStorage.removeItem(PENDING_OTP_PHONE_KEY);
        throw new Error("الرقم غير مسجّل. يرجى إنشاء حساب جديد أولاً.");
      }
      const authUser = await buildAuthUserFromPhone(phone);
      await AsyncStorage.removeItem(PENDING_OTP_PHONE_KEY);
      await signInPlayerSession({
        ...authUser,
        playerId: authUser.playerId ?? "",
        role: "player",
      });
    },
    [signInPlayerSession],
  );

  const continueAsGuest = async (): Promise<void> => {
    await AsyncStorage.removeItem(USER_SESSION_KEY);
    await AsyncStorage.multiSet([
      [AUTH_GUEST_KEY, "true"],
      [AUTH_USER_KEY, JSON.stringify(GUEST_USER)],
    ]);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(GUEST_USER);
    setIsGuest(true);
  };

  /** لا ننتظر signOut — قد يتعلّق بالشبكة فيُبقي الجلسة محلياً وكأن زر الخروج لا يعمل */
  const logout = useCallback(async (): Promise<void> => {
    try {
      void signOut(getFirebaseAuth()).catch(() => {});
    } catch {
      /* Firebase غير مهيأ */
    }
    try {
      clearPendingFirebaseBridgeTicket();
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(AUTH_USER_KEY),
        AsyncStorage.removeItem(AUTH_GUEST_KEY),
        AsyncStorage.removeItem(PENDING_OTP_PHONE_KEY),
        AsyncStorage.removeItem(USER_SESSION_KEY),
      ]);
    } catch (e) {
      console.warn("[auth] logout storage clear", e);
    }
    setToken(null);
    setUser(null);
    setIsGuest(false);
    /** تسجيل الخروج دائماً يعيد لشاشة الدخول — حتى مع GUEST_FULL_ACCESS يمكن للمستخدم اختيار «متابعة كضيف» من هناك */
    try {
      router.replace("/auth/player/login");
    } catch (e) {
      console.warn("[auth] logout navigation", e);
    }
  }, []);

  const updateProfile = async (data: {
    name?: string;
    dateOfBirth?: string;
    profileImage?: string;
    position?: string | null;
  }): Promise<void> => {
    if (!user || user.role === "guest") {
      throw new Error("يجب تسجيل الدخول");
    }
    if (updateProfileInFlightRef.current) {
      throw new Error("جاري حفظ الملف الشخصي، انتظر حتى يكتمل.");
    }
    updateProfileInFlightRef.current = true;
    try {
      let profileImage = data.profileImage ?? user.profileImage ?? null;
      if (typeof profileImage === "string" && profileImage.trim() !== "") {
        const trimmed = profileImage.trim();
        if (!isRemoteImageUrl(trimmed)) {
          const uploaded = await uploadImageIfConfigured(trimmed);
          profileImage = uploaded ?? (user.profileImage ?? null);
        } else {
          profileImage = trimmed;
        }
      } else {
        profileImage = null;
      }

      const nextName = (data.name ?? user.name ?? "").trim() || user.name;
      const nextDob = data.dateOfBirth ?? user.dateOfBirth ?? null;
      const nextPosition =
        data.position !== undefined ? data.position : user.position ?? null;

      await mergeFirestorePlayerProfile(user.id, {
        name: nextName,
        email: user.email ?? "",
        phone: user.phone ?? "",
        dateOfBirth: nextDob,
        profileImage,
        gender: user.gender ?? null,
        position: nextPosition,
      });

      const next: AuthUser = {
        ...user,
        name: nextName,
        dateOfBirth: nextDob,
        profileImage,
        position: nextPosition,
      };
      await AsyncStorage.multiSet([
        [AUTH_USER_KEY, JSON.stringify(next)],
        [USER_SESSION_KEY, JSON.stringify(next)],
      ]);
      setUser(next);
    } finally {
      updateProfileInFlightRef.current = false;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      void signOut(getFirebaseAuth()).catch(() => {});
    } catch {
      /* */
    }
    await logout();
  };

  const sendEmailChangeOtp = async (newEmail: string): Promise<Record<string, never>> => {
    const e = newEmail.trim().toLowerCase();
    if (!isValidEmailFormat(e)) {
      throw new Error("البريد غير صالح");
    }
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) throw new Error("يجب تسجيل الدخول");
    await verifyBeforeUpdateEmail(u, e);
    return {};
  };

  const updateEmail = async (newEmail: string, _otp: string): Promise<void> => {
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("يجب تسجيل الدخول");
    await reload(auth.currentUser);
    const verified = auth.currentUser.email?.trim().toLowerCase();
    const want = newEmail.trim().toLowerCase();
    if (verified !== want) {
      throw new Error("أكمل التحقق من الرابط المرسل إلى بريدك الجديد");
    }
    if (!user || user.role === "guest") return;
    const next: AuthUser = { ...user, playerId: user.playerId ?? "", email: want };
    await AsyncStorage.multiSet([
      [AUTH_USER_KEY, JSON.stringify(next)],
      [USER_SESSION_KEY, JSON.stringify(next)],
    ]);
    setUser(next);
  };

  const isAuthenticated = !!user && (!isGuest || GUEST_FULL_ACCESS);

  const value = useMemo(
    () => ({
      user,
      token,
      isGuest,
      isLoading,
      isAuthenticated,
      requestLoginPhoneOtp,
      verifyLoginPhoneOtp,
      signInPlayerSession,
      continueAsGuest,
      logout,
      updateProfile,
      deleteAccount,
      sendEmailChangeOtp,
      updateEmail,
      refreshPlayerFromFirestore,
    } as AuthContextValue),
    [
      user,
      token,
      isGuest,
      isLoading,
      isAuthenticated,
      requestLoginPhoneOtp,
      verifyLoginPhoneOtp,
      signInPlayerSession,
      logout,
      updateProfile,
      deleteAccount,
      sendEmailChangeOtp,
      updateEmail,
      refreshPlayerFromFirestore,
      continueAsGuest,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export async function ensurePlayerFirestoreProfile(
  extras: FirestoreUserExtras,
): Promise<void> {
  const phone = String(extras.phone ?? "").trim();
  if (!phone) throw new Error("لا يوجد رقم جوال للحفظ");
  await ensureFirestoreUserByPhone(phone, extras);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
