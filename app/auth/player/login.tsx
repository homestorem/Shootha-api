import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { AuthInput } from "@/components/AuthInput";

export default function PlayerLoginScreen() {
  const insets = useSafeAreaInsets();
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const validatePhone = (val: string) => {
    if (!val.trim()) return "رقم الهاتف مطلوب";
    if (val.replace(/\D/g, "").length < 10) return "رقم الهاتف غير صحيح";
    return "";
  };

  const handleSendOtp = async () => {
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    setPhoneError("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await sendOtp(phone.trim());
      router.push({
        pathname: "/auth/player/verify-otp",
        params: { phone: phone.trim(), mode: "login", devOtp: res.devOtp ?? "" },
      });
    } catch (e: any) {
      const msg = e?.message ?? "حدث خطأ، حاول مجدداً";
      Alert.alert("خطأ", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <View style={styles.roleIcon}>
            <Ionicons name="football" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>تسجيل دخول اللاعب</Text>
          <Text style={styles.subtitle}>أدخل رقم هاتفك وسنرسل لك رمز التحقق</Text>
        </View>

        <View style={styles.form}>
          <AuthInput
            label="رقم الهاتف"
            icon="call-outline"
            placeholder="07XX XXX XXXX"
            value={phone}
            onChangeText={(v) => { setPhone(v); setPhoneError(""); }}
            keyboardType="phone-pad"
            error={phoneError}
          />

          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleSendOtp}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? "hourglass-outline" : "arrow-back-circle"}
              size={20}
              color="#000"
            />
            <Text style={styles.submitBtnText}>
              {isLoading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.registerRow}>
          <Text style={styles.registerHint}>ليس لديك حساب؟</Text>
          <Pressable onPress={() => router.replace("/auth/player/register")}>
            <Text style={styles.registerLink}>إنشاء حساب جديد</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 0 },
  heroSection: { alignItems: "center", gap: 12, marginBottom: 36 },
  roleIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 2, borderColor: "rgba(46,204,113,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 24, fontFamily: "Cairo_700Bold", textAlign: "center" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", lineHeight: 22 },
  form: { gap: 16, marginBottom: 24 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: Colors.disabled },
  submitBtnText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
  registerRow: { flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center" },
  registerHint: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular" },
  registerLink: { color: Colors.primary, fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
