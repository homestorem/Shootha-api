import "react-native-get-random-values";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
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
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PENDING_REG_KEY, useAuth, ensurePlayerFirestoreProfile } from "@/context/AuthContext";
import {
  verifyPhoneOtp,
  sendPhoneOtp,
  buildAuthUserFromPhone,
} from "@/lib/firebasePhoneAuth";
import { isValidIqMobileE164, normalizePhoneFromOtpRouteParam } from "@/lib/phoneE164";
import { SMS_OTP_LENGTH } from "@/lib/otpConstants";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import RecaptchaWebMount from "@/components/RecaptchaWebMount";
import { uploadImageAsync, isRemoteImageUrl } from "@/lib/cloudinary-upload";
import { useLang } from "@/context/LanguageContext";

function paramOne(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function maskPhone(p: string): string {
  const t = p.trim();
  if (t.length < 8) return t;
  return `${t.slice(0, 5)}…${t.slice(-3)}`;
}

export default function VerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const { t, iconFlipStyle } = useLang();
  const raw = useLocalSearchParams();
  const { verifyLoginPhoneOtp, signInPlayerSession } = useAuth();

  const phoneParam = paramOne(raw.phone).trim();
  const mode = paramOne(raw.mode).trim().toLowerCase();

  const [phoneDisplay, setPhoneDisplay] = useState(() =>
    phoneParam ? normalizePhoneFromOtpRouteParam(phoneParam) : "",
  );
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const verifyLock = useRef(false);

  useEffect(() => {
    if (phoneParam) {
      setPhoneDisplay(normalizePhoneFromOtpRouteParam(phoneParam));
    }
  }, [phoneParam]);

  useEffect(() => {
    if (phoneParam) return;
    (async () => {
      const data = await AsyncStorage.getItem(PENDING_REG_KEY);
      try {
        const reg = data ? (JSON.parse(data) as { phone?: string }) : {};
        const ph = String(reg.phone ?? "").trim();
        if (ph) setPhoneDisplay(normalizePhoneFromOtpRouteParam(ph));
      } catch {
        /* ignore */
      }
    })();
  }, [phoneParam]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const resolvePhoneE164 = useCallback((): string => {
    const rawPhone = phoneParam || phoneDisplay.trim();
    if (!rawPhone) return "";
    return normalizePhoneFromOtpRouteParam(rawPhone);
  }, [phoneParam, phoneDisplay]);

  const runVerify = useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? otp).replace(/\D/g, "").slice(0, SMS_OTP_LENGTH);
      if (code.length !== SMS_OTP_LENGTH) {
        Alert.alert(t("common.warningTitle"), t("auth.otp.enterDigits", { count: SMS_OTP_LENGTH }));
        return;
      }
      if (verifyLock.current) return;
      const phoneE164 = resolvePhoneE164();
      if (!phoneE164) {
        Alert.alert(t("auth.common.error"), t("auth.otp.phoneMissing"));
        return;
      }
      if (!isValidIqMobileE164(phoneE164)) {
        Alert.alert(t("auth.common.error"), t("auth.otp.phoneInvalidRetry"));
        return;
      }

      verifyLock.current = true;
      setVerifying(true);
      try {
        const isLogin = mode === "login";
        if (isLogin) {
          await verifyLoginPhoneOtp(code);
          router.replace("/(tabs)");
          return;
        }

        await verifyPhoneOtp(phoneE164, code);

        const data = await AsyncStorage.getItem(PENDING_REG_KEY);
        let reg: Record<string, unknown> = {};
        try {
          reg = data ? (JSON.parse(data) as Record<string, unknown>) : {};
        } catch {
          reg = {};
        }

        const phoneNormReg = String(reg.phone ?? "").trim();
        const emailReg = String(reg.email ?? "").trim().toLowerCase();
        const shareCodeReg = String(reg.shareCode ?? "").trim() || null;
        let profileImageUrl = ((reg.profileImage as string) || (reg.image as string) || "").trim() || null;
        if (profileImageUrl && !isRemoteImageUrl(profileImageUrl)) {
          profileImageUrl = await uploadImageAsync(profileImageUrl);
        }

        if (!reg.name && !data) {
          Alert.alert(t("auth.common.error"), t("auth.otp.noRegData"));
          return;
        }

        await ensurePlayerFirestoreProfile({
          name: String(reg.name ?? "").trim() || t("auth.defaultPlayerName"),
          email: emailReg,
          phone: phoneNormReg || phoneE164 || "",
          dateOfBirth: (reg.dateOfBirth as string) || (reg.date_of_birth as string) || null,
          profileImage: profileImageUrl,
          gender:
            typeof reg.gender === "string"
              ? reg.gender === "male"
                ? t("auth.register.male")
                : reg.gender === "female"
                  ? t("auth.register.female")
                  : reg.gender
              : null,
          position: (reg.playerType as string) || (reg.position as string) || null,
          shareCode: shareCodeReg,
        });

        const authUser = await buildAuthUserFromPhone(phoneE164, {
          name: String(reg.name ?? "").trim() || undefined,
          email: emailReg || undefined,
        });

        await signInPlayerSession({
          ...authUser,
          role: "player",
          name: String(reg.name ?? "").trim() || authUser.name,
          email: emailReg || authUser.email,
          phone: phoneE164 || authUser.phone,
          dateOfBirth: (reg.dateOfBirth as string) || (reg.date_of_birth as string) || authUser.dateOfBirth,
          profileImage: profileImageUrl ?? authUser.profileImage,
          gender:
            typeof reg.gender === "string"
              ? reg.gender === "male"
                ? t("auth.register.male")
                : reg.gender === "female"
                  ? t("auth.register.female")
                  : reg.gender
              : authUser.gender,
          position: (reg.playerType as string) || (reg.position as string) || authUser.position,
          inviteCode: authUser.inviteCode ?? null,
        });
        await AsyncStorage.removeItem(PENDING_REG_KEY);

        router.replace("/(tabs)");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t("auth.common.genericError");
        Alert.alert(t("auth.common.error"), msg);
        setOtp("");
      } finally {
        setVerifying(false);
        verifyLock.current = false;
      }
    },
    [otp, mode, verifyLoginPhoneOtp, signInPlayerSession, resolvePhoneE164, t],
  );

  const resend = async () => {
    const phoneE164 = resolvePhoneE164();
    if (!phoneE164) {
      Alert.alert(t("auth.common.error"), t("auth.otp.noNumberResend"));
      return;
    }
    if (!isValidIqMobileE164(phoneE164)) {
      Alert.alert(t("auth.common.error"), t("auth.otp.invalidPhone"));
      return;
    }
    setResending(true);
    try {
      await sendPhoneOtp(phoneE164);
      setTimer(60);
      setOtp("");
      Alert.alert(t("auth.otp.resendSuccessTitle"), t("auth.otp.resendSuccessBody"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("auth.otp.resendGenericError");
      Alert.alert(t("auth.otp.resendFailTitle"), msg);
    } finally {
      setResending(false);
    }
  };

  const masked = maskPhone(phoneDisplay || phoneParam || "");
  const topPad = Platform.OS === "web" ? 24 : insets.top + 12;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (mode === "login") {
      router.replace("/auth/player/login" as Href);
    } else {
      router.replace("/auth/player/register" as Href);
    }
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
          <Pressable
            style={styles.backRow}
            onPress={handleBack}
            hitSlop={12}
            disabled={verifying}
          >
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
  },
  resend: {
    marginTop: 20,
    color: "#fff",
    fontFamily: "Cairo_600SemiBold",
  },
});
