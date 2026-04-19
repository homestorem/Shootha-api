import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const { user, updateProfile, sendEmailChangeOtp, updateEmail } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? "");
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [nameError, setNameError] = useState("");

  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  /** Firebase يرسل رابط تحقق بالبريد وليس OTP من 6 أرقام */
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const lastEmailVerificationSentTo = useRef("");
  const saveInFlightRef = useRef(false);

  const emailChanged = newEmail.trim() !== (user?.email ?? "");

  const handleSendEmailOtp = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setOtpError(t("fieldRequired"));
      return;
    }
    const want = newEmail.trim().toLowerCase();
    if (emailLinkSent && lastEmailVerificationSentTo.current === want) {
      return;
    }
    setOtpError("");
    setIsSendingOtp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await sendEmailChangeOtp(newEmail.trim());
      lastEmailVerificationSentTo.current = want;
      setEmailLinkSent(true);
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "تعذر إرسال رابط التحقق");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleConfirmEmailAfterLink = async () => {
    setOtpError("");
    setIsVerifyingOtp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateEmail(newEmail.trim(), "");
      setEmailLinkSent(false);
      lastEmailVerificationSentTo.current = "";
      setEmailSuccess("تم تحديث البريد");
      setTimeout(() => setEmailSuccess(""), 4000);
    } catch (e: unknown) {
      setOtpError(
        e instanceof Error
          ? e.message
          : "افتح الرابط من البريد على هذا الجهاز ثم أعد المحاولة",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("الإذن مطلوب", "يتطلب التطبيق إذن الوصول للصور");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const validate = (): boolean => {
    if (!name.trim() || name.trim().length < 2) {
      setNameError(t("fieldRequired"));
      return false;
    }
    setNameError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (saveInFlightRef.current || isSaving) return;
    saveInFlightRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    setSavedMsg("");
    try {
      await updateProfile({
        name: name.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        profileImage: profileImage ?? undefined,
      });
      setSavedMsg(t("savedSuccess"));
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (e: any) {
      Alert.alert("خطأ", e?.message ?? "تعذر الحفظ");
    } finally {
      setIsSaving(false);
      saveInFlightRef.current = false;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("editProfileTitle")}</Text>
        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>{t("save")}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!savedMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
            <Text style={styles.successText}>{savedMsg}</Text>
          </View>
        )}

        <Pressable style={styles.avatarSection} onPress={pickImage}>
          <View style={styles.avatarWrap}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: "rgba(15,157,88,0.15)" }]}>
                <Text style={styles.avatarInitial}>{name.charAt(0) || "؟"}</Text>
              </View>
            )}
            <View style={[styles.cameraBtn, { backgroundColor: Colors.primary }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </View>
          <Text style={[styles.changePhotoText, { color: Colors.primary }]}>{t("changePhoto")}</Text>
        </Pressable>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("fullName")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: nameError ? Colors.destructive : colors.border,
                },
              ]}
              value={name}
              onChangeText={(v) => { setName(v); setNameError(""); }}
              placeholder={t("fullName")}
              placeholderTextColor={colors.textTertiary}
              textAlign="right"
            />
            {!!nameError && (
              <Text style={[styles.errorText, { color: Colors.destructive }]}>{nameError}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("dateOfBirth")}</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
              ]}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              textAlign="right"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>البريد الإلكتروني</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[
                  styles.phoneInput,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: otpError && !emailLinkSent ? Colors.destructive : colors.border,
                  },
                ]}
                value={newEmail}
                onChangeText={(v) => {
                  setNewEmail(v);
                  setEmailLinkSent(false);
                  setOtpError("");
                  setEmailSuccess("");
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
                editable={!emailLinkSent}
              />
              {emailChanged && !emailLinkSent && (
                <Pressable
                  style={[
                    styles.otpSendBtn,
                    isSendingOtp && { opacity: 0.5 },
                  ]}
                  onPress={handleSendEmailOtp}
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.otpSendBtnText}>{t("sendOtp")}</Text>
                  )}
                </Pressable>
              )}
            </View>

            {emailLinkSent && (
              <View style={styles.otpSection}>
                <Text style={[styles.emailLinkHint, { color: colors.textSecondary }]}>
                  أُرسل رابط إلى بريدك. افتح الرابط من هذا الجهاز، ثم اضغط الزر أدناه مرة واحدة لتأكيد
                  التحديث.
                </Text>
                <Pressable
                  style={[styles.verifyBtn, isVerifyingOtp && { opacity: 0.5 }]}
                  onPress={() => void handleConfirmEmailAfterLink()}
                  disabled={isVerifyingOtp}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.verifyBtnText}>تأكيد تحديث البريد</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEmailLinkSent(false);
                    setOtpError("");
                  }}
                >
                  <Text style={[styles.resendText, { color: colors.textTertiary }]}>
                    تغيير البريد
                  </Text>
                </Pressable>
              </View>
            )}

            {!!otpError && (
              <Text style={[styles.errorText, { color: Colors.destructive }]}>{otpError}</Text>
            )}
            {!!emailSuccess && (
              <Text style={[styles.successText, { color: Colors.primary }]}>{emailSuccess}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Cairo_700Bold" },
  saveBtn: { height: 36, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: Colors.primary, fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 0 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(15,157,88,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.3)",
  },
  successText: { color: Colors.primary, fontSize: 14, fontFamily: "Cairo_600SemiBold" },
  avatarSection: { alignItems: "center", paddingVertical: 32, gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarInitial: { color: Colors.primary, fontSize: 36, fontFamily: "Cairo_700Bold" },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  changePhotoText: { fontSize: 14, fontFamily: "Cairo_600SemiBold" },
  form: { gap: 20 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Cairo_600SemiBold" },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
  },
  otpSendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  otpSendBtnText: { color: "#000", fontSize: 12, fontFamily: "Cairo_700Bold" },
  otpSection: { gap: 10, marginTop: 4 },
  emailLinkHint: { fontSize: 13, fontFamily: "Cairo_400Regular", lineHeight: 20 },
  verifyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyBtnText: { color: "#000", fontSize: 14, fontFamily: "Cairo_700Bold" },
  resendText: { fontSize: 12, fontFamily: "Cairo_400Regular", textAlign: "center" },
  errorText: { fontSize: 12, fontFamily: "Cairo_400Regular" },
});
