import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { registerPushToken, setupNotificationHandler } from "@/lib/notifications";

export type UserRole = "player" | "owner" | "guest" | "supervisor";

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  dateOfBirth?: string | null;
  profileImage?: string | null;
  gender?: string | null;
};

export type PendingPlayerData = {
  name: string;
  phone: string;
  dateOfBirth?: string;
  profileImage?: string;
  userLat?: string;
  userLon?: string;
  gender?: string;
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
  login: (phone: string, otp: string) => Promise<void>;
  register: (
    phone: string,
    name: string,
    role: UserRole,
    otp: string,
    extraData?: Record<string, string | string[] | boolean | undefined>
  ) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ devOtp?: string }>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    dateOfBirth?: string;
    profileImage?: string;
  }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendPhoneChangeOtp: (newPhone: string) => Promise<{ devOtp?: string }>;
  updatePhone: (newPhone: string, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_TOKEN_KEY = "shootha_auth_token";
const AUTH_USER_KEY = "shootha_auth_user";
const AUTH_GUEST_KEY = "shootha_auth_guest";
export const PENDING_REG_KEY = "shootha_pending_reg";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setupNotificationHandler().catch(() => {});
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const [storedToken, storedUser, storedGuest] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
        AsyncStorage.getItem(AUTH_GUEST_KEY),
      ]);
      if (storedToken && storedUser) {
        try {
          const url = new URL("/api/auth/me", getApiUrl()).toString();
          const verifyRes = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (verifyRes.ok) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            registerPushToken(storedToken).catch(() => {});
          } else {
            await Promise.all([
              AsyncStorage.removeItem(AUTH_TOKEN_KEY),
              AsyncStorage.removeItem(AUTH_USER_KEY),
            ]);
          }
        } catch {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } else if (storedGuest === "true") {
        setIsGuest(true);
      }
    } catch (e) {
      console.error("Auth init error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const authFetch = async (
    method: string,
    route: string,
    data?: unknown
  ): Promise<Response> => {
    const url = new URL(route, getApiUrl()).toString();
    const currentToken = token;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const body = await res.json();
        msg = body.message || msg;
      } catch {}
      throw new Error(msg);
    }
    return res;
  };

  const sendOtp = async (phone: string): Promise<{ devOtp?: string }> => {
    const res = await apiRequest("POST", "/api/auth/send-otp", { phone });
    return await res.json();
  };

  const login = async (phone: string, otp: string): Promise<void> => {
    const res = await apiRequest("POST", "/api/auth/login", { phone, otp });
    const data: { token: string; user: AuthUser } = await res.json();
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
    ]);
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
    registerPushToken(data.token).catch(() => {});
  };

  const register = async (
    phone: string,
    name: string,
    role: UserRole,
    otp: string,
    extraData?: Record<string, string | string[] | boolean | undefined>
  ): Promise<void> => {
    const payload: Record<string, string | string[] | boolean | undefined> = {
      phone,
      name,
      role,
      otp,
      ...extraData,
    };
    const res = await apiRequest("POST", "/api/auth/register", payload);
    const data: { token: string; user: AuthUser } = await res.json();
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
    ]);
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
    registerPushToken(data.token).catch(() => {});
  };

  const continueAsGuest = async (): Promise<void> => {
    await AsyncStorage.setItem(AUTH_GUEST_KEY, "true");
    setIsGuest(true);
    setUser(null);
    setToken(null);
  };

  const logout = async (): Promise<void> => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
      AsyncStorage.removeItem(AUTH_GUEST_KEY),
    ]);
    setToken(null);
    setUser(null);
    setIsGuest(false);
  };

  const updateProfile = async (data: {
    name?: string;
    dateOfBirth?: string;
    profileImage?: string;
  }): Promise<void> => {
    const res = await authFetch("PATCH", "/api/user/profile", data);
    const body: { user: AuthUser } = await res.json();
    const updatedUser = { ...user!, ...body.user };
    setUser(updatedUser);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
  };

  const deleteAccount = async (): Promise<void> => {
    await authFetch("DELETE", "/api/user/account");
    await logout();
  };

  const sendPhoneChangeOtp = async (newPhone: string): Promise<{ devOtp?: string }> => {
    const res = await authFetch("POST", "/api/user/phone/send-otp", { newPhone });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message ?? "تعذر إرسال رمز التحقق");
    }
    return res.json();
  };

  const updatePhone = async (newPhone: string, otp: string): Promise<void> => {
    const res = await authFetch("PATCH", "/api/user/phone", { newPhone, otp });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message ?? "تعذر تحديث رقم الهاتف");
    }
    const body: { user: AuthUser } = await res.json();
    const updatedUser = { ...user!, ...body.user };
    setUser(updatedUser);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
  };

  const isAuthenticated = !!user && !isGuest;

  const value = useMemo(
    () => ({
      user,
      token,
      isGuest,
      isLoading,
      isAuthenticated,
      login,
      register,
      sendOtp,
      continueAsGuest,
      logout,
      updateProfile,
      deleteAccount,
      sendPhoneChangeOtp,
      updatePhone,
    }),
    [user, token, isGuest, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
