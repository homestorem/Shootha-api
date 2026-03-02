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
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { AuthInput } from "@/components/AuthInput";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";

export default function NewPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const params = useLocalSearchParams<{ phone: string; otp: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleSubmit = async () => {
    let valid = true;
    if (password.length < 6) {
      setPasswordError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      valid = false;
    } else {
      setPasswordError("");
    }
    if (password !== confirmPassword) {
      setConfirmError("كلمتا المرور غير متطابقتين");
      valid = false;
    } else {
      setConfirmError("");
    }
    if (!valid) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        phone: params.phone,
        otp: params.otp,
        newPassword: password,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم", "تم تغيير كلمة المرور بنجاح. سيتم تسجيل دخولك الآن.", [
        {
          text: "حسناً",
          onPress: async () => {
            try {
              await login(params.phone, params.otp);
              router.replace("/(tabs)");
            } catch {
              router.replace("/auth/player/login");
            }
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "حدث خطأ، حاول مجدداً");
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
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>كلمة مرور جديدة</Text>
          <Text style={styles.subtitle}>أدخل كلمة مرور جديدة لحسابك</Text>
        </View>

        <View style={styles.form}>
          <AuthInput
            label="كلمة مرور جديدة"
            icon="lock-closed-outline"
            placeholder="6 أحرف على الأقل"
            value={password}
            onChangeText={(v) => { setPassword(v); setPasswordError(""); }}
            secureTextEntry
            error={passwordError}
          />
          <AuthInput
            label="تأكيد كلمة المرور"
            icon="lock-closed-outline"
            placeholder="أعد كتابة كلمة المرور"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setConfirmError(""); }}
            secureTextEntry
            error={confirmError}
          />

          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? "hourglass-outline" : "checkmark-circle"}
              size={20}
              color="#000"
            />
            <Text style={styles.submitBtnText}>
              {isLoading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </Text>
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
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 2, borderColor: "rgba(46,204,113,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 24, fontFamily: "Cairo_700Bold", textAlign: "center" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center", lineHeight: 22 },
  form: { gap: 16 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: Colors.disabled },
  submitBtnText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
});
