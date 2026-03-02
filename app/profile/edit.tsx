import React, { useState } from "react";
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
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? "");
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [nameError, setNameError] = useState("");

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
              <View style={[styles.avatarPlaceholder, { backgroundColor: "rgba(46,204,113,0.15)" }]}>
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
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("phone")}</Text>
            <View
              style={[
                styles.input,
                styles.inputLocked,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.inputLockedText, { color: colors.textSecondary }]}>
                {user?.phone ?? "—"}
              </Text>
              <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
            </View>
            <Text style={[styles.lockedNote, { color: colors.textTertiary }]}>{t("phoneLocked")}</Text>
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
    backgroundColor: "rgba(46,204,113,0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.3)",
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
  inputLocked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  inputLockedText: { fontSize: 15, fontFamily: "Cairo_400Regular" },
  lockedNote: { fontSize: 11, fontFamily: "Cairo_400Regular" },
  errorText: { fontSize: 12, fontFamily: "Cairo_400Regular" },
});
