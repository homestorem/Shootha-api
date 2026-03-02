import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";
import { useAuth, UserRole, PENDING_REG_KEY, PendingPlayerData } from "@/context/AuthContext";

const OTP_LENGTH = 6;

export default function PlayerVerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const { login, register, sendOtp } = useAuth();
  const params = useLocalSearchParams<{
    phone: string;
    mode: "login" | "register" | "reset-password";
    role?: string;
    devOtp?: string;
  }>();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown(v => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 400);
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) {
      setError("أدخل الرمز المكون من 6 أرقام");
      shakeError();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      if (params.mode === "reset-password") {
        router.replace({
          pathname: "/auth/player/new-password",
          params: { phone: params.phone, otp },
        });
        return;
      } else if (params.mode === "register") {
        const pendingRaw = await AsyncStorage.getItem(PENDING_REG_KEY);
        const pending: PendingPlayerData | null = pendingRaw ? JSON.parse(pendingRaw) : null;

        await register(
          params.phone,
          pending?.name ?? "",
          (params.role ?? "player") as UserRole,
          otp,
          {
            password: pending?.password,
            dateOfBirth: pending?.dateOfBirth,
            profileImage: pending?.profileImage,
            userLat: pending?.userLat,
            userLon: pending?.userLon,
          }
        );
      } else {
        await login(params.phone, otp);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg = e?.message ?? "رمز التحقق غير صحيح";
      setError(msg);
      setOtp("");
      shakeError();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendOtp(params.phone);
      setResendCooldown(60);
      setOtp("");
      Alert.alert("تم الإرسال", "تم إرسال رمز تحقق جديد");
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>رمز التحقق</Text>
          <Text style={styles.subtitle}>
            أرسلنا رمزاً من 6 أرقام إلى{"\n"}
            <Text style={styles.phone}>{params.phone}</Text>
          </Text>
          {params.devOtp ? (
            <View style={styles.devHint}>
              <Ionicons name="bug-outline" size={12} color={Colors.warning} />
              <Text style={styles.devHintText}>رمز التطوير: {params.devOtp}</Text>
            </View>
          ) : null}
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  otp.length === i && styles.otpBoxActive,
                  otp.length > i && styles.otpBoxFilled,
                  error && styles.otpBoxError,
                ]}
              >
                <Text style={styles.otpDigit}>{otp[i] ?? ""}</Text>
              </View>
            ))}
          </Pressable>
        </Animated.View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, OTP_LENGTH);
            setOtp(digits);
            setError("");
            if (digits.length === OTP_LENGTH) {
              setTimeout(() => handleVerify(), 100);
            }
          }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          caretHidden
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.verifyBtn, (isLoading || otp.length < OTP_LENGTH) && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={isLoading || otp.length < OTP_LENGTH}
        >
          <Ionicons name={isLoading ? "hourglass-outline" : "checkmark-circle"} size={20} color="#000" />
          <Text style={styles.verifyBtnText}>
            {isLoading ? "جاري التحقق..." : "تأكيد"}
          </Text>
        </Pressable>

        <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
          <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textTertiary }]}>
            {resendCooldown > 0
              ? `إعادة الإرسال بعد ${resendCooldown} ثانية`
              : "إعادة إرسال الرمز"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  content: { flex: 1, paddingHorizontal: 24, alignItems: "center", gap: 24, paddingTop: 20 },
  heroSection: { alignItems: "center", gap: 12 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 2, borderColor: "rgba(46,204,113,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 24, fontFamily: "Cairo_700Bold" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", lineHeight: 22 },
  phone: { color: Colors.text, fontFamily: "Cairo_600SemiBold" },
  devHint: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,149,0,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,149,0,0.3)",
  },
  devHintText: { color: Colors.warning, fontSize: 12, fontFamily: "Cairo_600SemiBold" },
  otpRow: { flexDirection: "row", gap: 10 },
  otpBox: {
    width: 46, height: 56, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  otpBoxActive: { borderColor: Colors.primary, backgroundColor: "rgba(46,204,113,0.05)" },
  otpBoxFilled: { borderColor: Colors.primary },
  otpBoxError: { borderColor: Colors.destructive },
  otpDigit: { color: Colors.text, fontSize: 22, fontFamily: "Cairo_700Bold" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  errorText: { color: Colors.destructive, fontSize: 13, fontFamily: "Cairo_400Regular", textAlign: "center" },
  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
    width: "100%",
  },
  verifyBtnDisabled: { backgroundColor: Colors.disabled },
  verifyBtnText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
  resendText: { color: Colors.primary, fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
