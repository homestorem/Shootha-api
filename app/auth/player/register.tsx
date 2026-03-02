import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";
import { useAuth, PENDING_REG_KEY, PendingPlayerData } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { AuthInput } from "@/components/AuthInput";

export default function PlayerRegisterScreen() {
  const insets = useSafeAreaInsets();
  const { sendOtp } = useAuth();
  const location = useLocation();

  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const [nameError, setNameError] = useState("");
  const [dobError, setDobError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول إلى معرض الصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const validate = () => {
    let valid = true;

    if (!name.trim()) {
      setNameError("الاسم الكامل مطلوب");
      valid = false;
    } else setNameError("");

    if (!dateOfBirth.trim()) {
      setDobError("تاريخ الميلاد مطلوب");
      valid = false;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      setDobError("الصيغة الصحيحة: YYYY-MM-DD");
      valid = false;
    } else setDobError("");

    if (!phone.trim()) {
      setPhoneError("رقم الهاتف مطلوب");
      valid = false;
    } else if (phone.replace(/\D/g, "").length < 10) {
      setPhoneError("رقم الهاتف غير صحيح");
      valid = false;
    } else setPhoneError("");

    if (!password.trim()) {
      setPasswordError("كلمة المرور مطلوبة");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      valid = false;
    } else setPasswordError("");

    if (!confirmPassword.trim()) {
      setConfirmPasswordError("تأكيد كلمة المرور مطلوب");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("كلمتا المرور غير متطابقتين");
      valid = false;
    } else setConfirmPasswordError("");

    return valid;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let userLat: string | undefined;
      let userLon: string | undefined;
      if (Platform.OS !== "web") {
        if (location.hasPermission === null) {
          await location.requestLocation();
        }
        if (location.hasPermission !== false) {
          userLat = String(location.latitude);
          userLon = String(location.longitude);
        }
      }

      const pendingData: PendingPlayerData = {
        name: name.trim(),
        phone: phone.trim(),
        password,
        dateOfBirth: dateOfBirth.trim(),
        profileImage: profileImageUri ?? undefined,
        userLat,
        userLon,
      };
      await AsyncStorage.setItem(PENDING_REG_KEY, JSON.stringify(pendingData));

      const res = await sendOtp(phone.trim());
      router.push({
        pathname: "/auth/player/verify-otp",
        params: {
          phone: phone.trim(),
          mode: "register",
          role: "player",
          devOtp: res.devOtp ?? "",
        },
      });
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
          <View style={styles.roleIcon}>
            <Ionicons name="person-add" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>إنشاء حساب لاعب</Text>
          <Text style={styles.subtitle}>انضم إلى مجتمع اللاعبين في الموصل</Text>
        </View>

        <View style={styles.form}>
          <AuthInput
            label="الاسم الكامل"
            icon="person-outline"
            placeholder="أحمد محمد"
            value={name}
            onChangeText={(v) => { setName(v); setNameError(""); }}
            error={nameError}
          />

          <AuthInput
            label="تاريخ الميلاد"
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={dateOfBirth}
            onChangeText={(v) => { setDateOfBirth(v); setDobError(""); }}
            keyboardType="numbers-and-punctuation"
            error={dobError}
          />

          <AuthInput
            label="رقم الهاتف"
            icon="call-outline"
            placeholder="07XX XXX XXXX"
            value={phone}
            onChangeText={(v) => { setPhone(v); setPhoneError(""); }}
            keyboardType="phone-pad"
            error={phoneError}
          />

          <AuthInput
            label="كلمة المرور"
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => { setPassword(v); setPasswordError(""); }}
            isPassword
            error={passwordError}
          />

          <AuthInput
            label="تأكيد كلمة المرور"
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setConfirmPasswordError(""); }}
            isPassword
            error={confirmPasswordError}
          />

          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>صورة الملف الشخصي (اختياري)</Text>
            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={Colors.textSecondary} />
                  <Text style={styles.imagePlaceholderText}>اختر صورة</Text>
                </View>
              )}
            </Pressable>
            {profileImageUri && (
              <Pressable onPress={() => setProfileImageUri(null)}>
                <Text style={styles.removeImageText}>إزالة الصورة</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <Ionicons name={isLoading ? "hourglass-outline" : "checkmark-circle"} size={20} color="#000" />
            <Text style={styles.submitBtnText}>
              {isLoading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>لديك حساب بالفعل؟</Text>
          <Pressable onPress={() => router.replace("/auth/player/login")}>
            <Text style={styles.loginLink}>تسجيل الدخول</Text>
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
    backgroundColor: Colors.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  heroSection: { alignItems: "center", gap: 12, marginBottom: 36 },
  roleIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderWidth: 2, borderColor: "rgba(46,204,113,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 24, fontFamily: "Cairo_700Bold", textAlign: "center" },
  subtitle: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular", textAlign: "center" },
  form: { gap: 16, marginBottom: 24 },
  imageSection: { gap: 8, alignItems: "center" },
  imageLabel: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Cairo_600SemiBold", alignSelf: "flex-start" },
  imagePicker: {
    width: 100, height: 100, borderRadius: 50,
    overflow: "hidden", borderWidth: 2, borderColor: Colors.border,
    borderStyle: "dashed",
  },
  imagePlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.card, gap: 4,
  },
  imagePlaceholderText: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Cairo_400Regular" },
  previewImage: { width: "100%", height: "100%" },
  removeImageText: { color: Colors.destructive, fontSize: 12, fontFamily: "Cairo_400Regular" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: Colors.disabled },
  submitBtnText: { color: "#000", fontSize: 15, fontFamily: "Cairo_700Bold" },
  loginRow: { flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center" },
  loginHint: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular" },
  loginLink: { color: Colors.primary, fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
