import "react-native-get-random-values";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ImageBackground,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, ensurePlayerFirestoreProfile } from "@/context/AuthContext";
import {
  REGISTRATION_PENDING_KEY,
  type RegistrationPending,
} from "@/constants/registration";
import {
  verifyPhoneOtp,
  sendPhoneOtp,
  buildAuthUserFromPhone,
  isPhoneAlreadyRegistered,
} from "@/lib/firebasePhoneAuth";
import { normalizeIqPhoneToE164, normalizePhoneFromOtpRouteParam } from "@/lib/phoneE164";
import { SMS_OTP_LENGTH } from "@/lib/otpConstants";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import RecaptchaWebMount from "@/components/RecaptchaWebMount";
import { uploadImageAsync, isRemoteImageUrl } from "@/lib/cloudinary-upload";
import { useLang } from "@/context/LanguageContext";

function maskPhone(p: string): string {
  const t = p.trim();
  if (t.length < 8) return t;
  return `${t.slice(0, 5)}…${t.slice(-3)}`;
}

export default function RegistrationOtpScreen() {
  const insets = useSafeAreaInsets();
  const { t, iconFlipStyle } = useLang();
  const { signInPlayerSession } = useAuth();

  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const verifyLock = useRef(false);

  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem(REGISTRATION_PENDING_KEY);
      try {
        const reg = data ? (JSON.parse(data) as RegistrationPending) : null;
        const ph = String(reg?.phone ?? "").trim();
        if (ph) setPhoneDisplay(normalizePhoneFromOtpRouteParam(ph));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const runVerify = useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? otp).replace(/\D/g, "").slice(0, SMS_OTP_LENGTH);
      if (code.length !== SMS_OTP_LENGTH) {
        Alert.alert(t("common.warningTitle"), t("auth.otp.enterDigits", { count: SMS_OTP_LENGTH }));
        return;
      }
      if (verifyLock.current) return;

      const raw = await AsyncStorage.getItem(REGISTRATION_PENDING_KEY);
      if (!raw) {
        Alert.alert(t("auth.common.error"), t("auth.otp.sessionExpired"));
        router.replace("/auth/registration" as Href);
        return;
      }

      let pending: RegistrationPending;
      try {
        pending = JSON.parse(raw) as RegistrationPending;
      } catch {
        Alert.alert(t("auth.common.error"), t("auth.otp.invalidData"));
        return;
      }

      const phoneRaw = String(pending.phone ?? "").trim();
      if (!phoneRaw) {
        Alert.alert(t("auth.common.error"), t("auth.otp.noPhoneInSession"));
        return;
      }
      const phoneE164 = normalizePhoneFromOtpRouteParam(phoneRaw);

      verifyLock.current = true;
      setVerifying(true);
      try {
        const exists = await isPhoneAlreadyRegistered(phoneE164);
        if (exists) {
          await AsyncStorage.removeItem(REGISTRATION_PENDING_KEY);
          Alert.alert(t("auth.register.phoneInUseTitle"), t("auth.register.phoneInUseBody"));
          router.replace("/auth/player/login" as Href);
          return;
        }

        await verifyPhoneOtp(phoneE164, code);
        const normalizedEmail = String(pending.email ?? "").trim().toLowerCase();
        let profileImageUrl = pending.avatar_url ?? null;
        if (profileImageUrl && !isRemoteImageUrl(profileImageUrl)) {
          try {
            profileImageUrl = await uploadImageAsync(profileImageUrl);
          } catch (uploadErr) {
            // لا نوقف التسجيل إذا Cloudinary غير مضبوط؛ نكمل الحساب بدون صورة.
            console.warn("[registration] profile image upload skipped:", uploadErr);
            profileImageUrl = null;
          }
        }

        const shareCodePending = String(pending.shareCode ?? "").trim() || null;

        await ensurePlayerFirestoreProfile({
          name: pending.full_name.trim() || t("auth.defaultPlayerName"),
          email: normalizedEmail,
          phone: pending.phone || phoneE164 || "",
          dateOfBirth: pending.birth_date || null,
          profileImage: profileImageUrl,
          gender: pending.gender || null,
          position: pending.position || null,
          shareCode: shareCodePending,
        });

        const authUser = await buildAuthUserFromPhone(phoneE164, {
          name: pending.full_name.trim() || undefined,
          email: normalizedEmail || undefined,
        });

        await signInPlayerSession({
          ...authUser,
          role: "player",
          name: pending.full_name.trim() || authUser.name,
          email: normalizedEmail || authUser.email,
          phone: pending.phone ?? authUser.phone,
          dateOfBirth: pending.birth_date || authUser.dateOfBirth,
          profileImage: profileImageUrl ?? authUser.profileImage,
          gender: pending.gender || authUser.gender,
          position: pending.position || authUser.position,
          inviteCode: authUser.inviteCode ?? null,
        });

        await AsyncStorage.removeItem(REGISTRATION_PENDING_KEY);
        router.replace("/(tabs)" as Href);
      } catch (e) {
        Alert.alert(
          t("auth.otp.verifyFailTitle"),
          e instanceof Error ? e.message : t("auth.otp.tryLater"),
        );
        setOtp("");
      } finally {
        setVerifying(false);
        verifyLock.current = false;
      }
    },
    [otp, signInPlayerSession, t],
  );

  const resend = async () => {
    const raw = await AsyncStorage.getItem(REGISTRATION_PENDING_KEY);
    let phone = phoneDisplay;
    try {
      if (raw) {
        const p = JSON.parse(raw) as RegistrationPending;
        phone = String(p.phone ?? "").trim() || phone;
      }
    } catch {
      /* ignore */
    }
    if (!phone) {
      Alert.alert(t("auth.common.error"), t("auth.otp.noNumberResend"));
      return;
    }
    setResending(true);
    try {
      const e164 = normalizePhoneFromOtpRouteParam(phone) || (phone.startsWith("+") ? phone : normalizeIqPhoneToE164(phone));
      await sendPhoneOtp(e164);
      setTimer(60);
      setOtp("");
      Alert.alert(t("auth.otp.resendSuccessTitle"), t("auth.otp.resendSuccessBody"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("auth.otp.resendGenericError");
      Alert.alert(t("auth.common.error"), msg);
    } finally {
      setResending(false);
    }
  };

  const masked = phoneDisplay.length > 6 ? maskPhone(phoneDisplay) : phoneDisplay;
  const topPad = Platform.OS === "web" ? 24 : insets.top + 12;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/auth/registration" as Href);
  };

  return (
    <ImageBackground
      source={require("../../../assets/images/p1.jpg")}
      resizeMode="cover"
      style={styles.container}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.72)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {Platform.OS === "web" ? <RecaptchaWebMount /> : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollInner, { paddingTop: topPad, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.backRow} onPress={handleBack} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#fff" style={iconFlipStyle} />
            <Text style={styles.backLabel}>{t("auth.otp.back")}</Text>
          </Pressable>

          <Text style={styles.title}>{t("auth.otp.title")}</Text>

          <Text style={styles.subtitle}>
            {t("auth.otp.subtitle")}
            {"\n"}
            {masked || t("auth.otp.yourPhone")}
          </Text>

          <OtpCodeInput
            value={otp}
            onChange={setOtp}
            disabled={verifying}
            onFilled={(c) => void runVerify(c)}
          />

          <Pressable
            style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
            onPress={() => void runVerify()}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyText}>{t("auth.otp.confirm")}</Text>
            )}
          </Pressable>

          {timer > 0 ? (
            <Text style={styles.timer}>{t("auth.otp.resendIn", { seconds: timer })}</Text>
          ) : (
            <Pressable onPress={resend} disabled={resending}>
              {resending ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
              ) : (
                <Text style={styles.resend}>{t("auth.otp.resend")}</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollInner: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backLabel: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
  },
  title: {
    fontSize: 28,
    color: "#fff",
    marginBottom: 10,
    fontFamily: "Cairo_700Bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.96)",
    marginBottom: 16,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  verifyBtn: {
    backgroundColor: "#000",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 160,
    alignItems: "center",
    marginTop: 8,
  },
  verifyBtnDisabled: { opacity: 0.7 },
  verifyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  timer: {
    marginTop: 20,
    color: "rgba(255,255,255,0.92)",
    fontFamily: "Cairo_400Regular",
  },
  resend: {
    marginTop: 20,
    color: "#fff",
    fontFamily: "Cairo_600SemiBold",
  },
});
