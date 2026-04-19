import React, { useState, createElement } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Image,
  Modal,
  ImageBackground,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";
import {
  REGISTRATION_PENDING_KEY,
  type RegistrationPending,
} from "@/constants/registration";
import { useAuth } from "@/context/AuthContext";
import { normalizeIqPhoneToE164, isValidIqMobileE164 } from "@/lib/phoneE164";
import { AuthInput } from "@/components/AuthInput";
import { LinearGradient } from "expo-linear-gradient";
import RecaptchaWebMount from "@/components/RecaptchaWebMount";
import {
  assertPhoneAllowedForPlayerApp,
  isPhoneAlreadyRegistered,
} from "@/lib/firebasePhoneAuth";
import { useLang } from "@/context/LanguageContext";
import { RegistrationShareCodePrompt } from "@/components/RegistrationShareCodePrompt";

function validateBirthDateYmd(
  value: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): { ok: true } | { ok: false; message: string } {
  const raw = value.trim();
  if (!raw) return { ok: false, message: t("auth.dob.required") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, message: t("auth.dob.format") };
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return { ok: false, message: t("auth.dob.invalid") };
  }
  const now = new Date();
  if (dt > now) return { ok: false, message: t("auth.dob.future") };
  const minAge = 10;
  const maxAge = 100;
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
  if (age < minAge) return { ok: false, message: t("auth.dob.minAge", { min: minAge }) };
  if (age > maxAge) return { ok: false, message: t("auth.dob.unreasonable") };
  return { ok: true };
}

function formatDateLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalYmd(): string {
  return formatDateLocalYmd(new Date());
}

const POSITION_KEYS = ["gk", "def", "mid", "atk"] as const;
const POSITION_LABEL_KEYS: Record<(typeof POSITION_KEYS)[number], string> = {
  gk: "profile.playerTypes.gk",
  def: "profile.playerTypes.def",
  mid: "profile.playerTypes.mid",
  atk: "profile.playerTypes.atk",
};

export default function RegistrationScreen() {
  const { requestLoginPhoneOtp } = useAuth();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [position, setPosition] = useState("");
  const [nameError, setNameError] = useState("");
  const [dobError, setDobError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("errors.permissionRequired"), t("errors.photoPermission"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t("auth.common.error"), t("auth.register.galleryError"));
    }
  };

  const validate = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError(t("auth.register.nameRequired"));
      valid = false;
    } else setNameError("");

    const dobCheck = validateBirthDateYmd(dateOfBirth, t);
    if (!dobCheck.ok) {
      setDobError(dobCheck.message);
      valid = false;
    } else setDobError("");

    if (!gender) {
      Alert.alert(t("common.warningTitle"), t("auth.register.pickGender"));
      return false;
    }

    const phoneE164 = normalizeIqPhoneToE164(phone);
    if (!phone.trim() || !isValidIqMobileE164(phoneE164)) {
      setPhoneError(t("auth.common.phoneRequiredValid"));
      valid = false;
    } else setPhoneError("");

    if (!position) {
      Alert.alert(t("common.warningTitle"), t("auth.register.pickPosition"));
      valid = false;
    }

    return valid;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const posKey = position as (typeof POSITION_KEYS)[number];
      const positionLabel =
        position && (POSITION_KEYS as readonly string[]).includes(position)
          ? t(POSITION_LABEL_KEYS[posKey])
          : position;
      const phoneE164 = normalizeIqPhoneToE164(phone);
      await assertPhoneAllowedForPlayerApp(phoneE164);
      const exists = await isPhoneAlreadyRegistered(phoneE164);
      if (exists) {
        Alert.alert(t("auth.register.phoneInUseTitle"), t("auth.register.phoneInUseBody"));
        return;
      }

      const sc = shareCode.trim();
      const pending: RegistrationPending = {
        full_name: name.trim(),
        phone: phoneE164,
        birth_date: dateOfBirth.trim(),
        gender: gender === "male" ? t("auth.register.male") : gender === "female" ? t("auth.register.female") : "",
        position: positionLabel,
        avatar_url: profileImageUri,
        ...(sc ? { shareCode: sc } : {}),
      };

      await AsyncStorage.setItem(REGISTRATION_PENDING_KEY, JSON.stringify(pending));
      await requestLoginPhoneOtp(phone);

      const go = () =>
        router.push("/auth/registration/otp" as Href);
      InteractionManager.runAfterInteractions(() => {
        setTimeout(go, 0);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("auth.common.genericError");
      Alert.alert(t("auth.common.error"), msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../../assets/images/p1.jpg")}
      resizeMode="cover"
      style={[styles.container, { paddingTop: topPadding }]}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.72)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {Platform.OS === "web" ? <RecaptchaWebMount /> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <View style={styles.roleIcon}>
            <Ionicons name="person-add" size={32} color="#fff" />
          </View>
          <Text style={styles.title}>{t("auth.register.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.register.subtitle")}</Text>
          <RegistrationShareCodePrompt value={shareCode} onChange={setShareCode} />
        </View>

        <View style={styles.form}>
          <AuthInput
            label={t("auth.register.nameLabel")}
            icon="person-outline"
            placeholder={t("auth.register.namePlaceholder")}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setNameError("");
            }}
            error={nameError}
            authEmphasis
          />

          {Platform.OS === "web" ? (
            <View style={styles.datePicker}>
              <Ionicons name="calendar-outline" size={18} color="#48484A" />
              {createElement("input", {
                type: "date",
                value: dateOfBirth || "",
                max: todayLocalYmd(),
                onChange: (e: { target: { value: string } }) => {
                  const v = e.target.value;
                  setDateOfBirth(v);
                  if (v) {
                    const [y, m, d] = v.split("-").map(Number);
                    setDobDate(new Date(y, m - 1, d));
                  } else {
                    setDobDate(null);
                  }
                  const check = validateBirthDateYmd(v, t);
                  setDobError(check.ok ? "" : check.message);
                },
                style: {
                  flex: 1,
                  minWidth: 0,
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.15)",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  color: "#1A1A1A",
                  boxSizing: "border-box",
                },
              })}
            </View>
          ) : Platform.OS === "android" ? (
            <>
              <Pressable
                style={styles.datePicker}
                onPress={() => {
                  setTempDate(dobDate || new Date(2000, 0, 1));
                  setShowPicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={18} color="#48484A" />
                <Text style={styles.dateText}>
                  {dobDate ? formatDateLocalYmd(dobDate) : t("auth.register.pickDob")}
                </Text>
              </Pressable>
              {showPicker ? (
                <DateTimePicker
                  value={tempDate || new Date(2000, 0, 1)}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event, selectedDate) => {
                    setShowPicker(false);
                    if (!selectedDate) return;
                    setTempDate(selectedDate);
                    setDobDate(selectedDate);
                    const ymd = formatDateLocalYmd(selectedDate);
                    setDateOfBirth(ymd);
                    const check = validateBirthDateYmd(ymd, t);
                    setDobError(check.ok ? "" : check.message);
                  }}
                />
              ) : null}
            </>
          ) : (
            <>
              <Pressable
                style={styles.datePicker}
                onPress={() => {
                  setTempDate(dobDate || new Date(2000, 0, 1));
                  setShowPicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={18} color="#48484A" />
                <Text style={styles.dateText}>
                  {dobDate ? formatDateLocalYmd(dobDate) : t("auth.register.pickDob")}
                </Text>
              </Pressable>
              <Modal
                visible={showPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPicker(false)}
              >
                <Pressable style={styles.dateModal} onPress={() => setShowPicker(false)}>
                  <Pressable style={styles.dateModalContent} onPress={() => {}}>
                    <View style={styles.datePickerWrap}>
                      <DateTimePicker
                        value={tempDate || new Date(2000, 0, 1)}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        maximumDate={new Date()}
                        onChange={(_event, selectedDate) => {
                          if (selectedDate) setTempDate(selectedDate);
                        }}
                      />
                    </View>
                    <Pressable
                      style={styles.dateConfirmBtn}
                      onPress={() => {
                        if (tempDate) {
                          setDobDate(tempDate);
                          const y = tempDate.getFullYear();
                          const m = String(tempDate.getMonth() + 1).padStart(2, "0");
                          const d = String(tempDate.getDate()).padStart(2, "0");
                          const ymd = `${y}-${m}-${d}`;
                          setDateOfBirth(ymd);
                          const check = validateBirthDateYmd(ymd, t);
                          setDobError(check.ok ? "" : check.message);
                        }
                        setShowPicker(false);
                      }}
                    >
                      <Text style={styles.dateConfirmText}>{t("auth.register.confirmDate")}</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          )}
          {dobError ? <Text style={styles.fieldError}>{dobError}</Text> : null}

          <AuthInput
            label={t("auth.common.phoneLabel")}
            icon="call-outline"
            placeholder={t("auth.common.phonePlaceholder")}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setPhoneError("");
            }}
            keyboardType="phone-pad"
            error={phoneError}
            authEmphasis
          />

          <View style={styles.genderSection}>
            <Text style={styles.genderLabel}>{t("auth.register.gender")} </Text>
            <View style={styles.genderRow}>
              <Pressable
                style={[styles.genderBtn, gender === "male" && styles.genderBtnActive]}
                onPress={() => setGender(gender === "male" ? "" : "male")}
              >
                <Ionicons
                  name="male"
                  size={16}
                  color={gender === "male" ? "#fff" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    gender === "male" && styles.genderBtnTextActive,
                  ]}
                >
                  {t("auth.register.male")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.genderBtn,
                  gender === "female" && styles.genderBtnActiveFemale,
                ]}
                onPress={() => setGender(gender === "female" ? "" : "female")}
              >
                <Ionicons
                  name="female"
                  size={16}
                  color={gender === "female" ? "#fff" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    gender === "female" && styles.genderBtnTextActiveFemale,
                  ]}
                >
                  {t("auth.register.female")}
                </Text>
              </Pressable>
            </View>

            <View style={styles.positionSection}>
              <Text style={styles.genderLabel}>{t("auth.register.favoritePosition")}</Text>
              <View style={styles.positionGrid}>
                {[
                  { key: "gk" as const, labelKey: "profile.playerTypes.gk", icon: "hand-left-outline" },
                  { key: "def" as const, labelKey: "profile.playerTypes.def", icon: "shield-outline" },
                  { key: "mid" as const, labelKey: "profile.playerTypes.mid", icon: "sync-outline" },
                  { key: "atk" as const, labelKey: "profile.playerTypes.atk", icon: "football-outline" },
                ].map((p) => (
                  <Pressable
                    key={p.key}
                    style={[styles.positionBtn, position === p.key && styles.positionBtnActive]}
                    onPress={() => setPosition(p.key)}
                  >
                    <Ionicons
                      name={p.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={position === p.key ? "#fff" : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.positionText,
                        position === p.key && styles.positionTextActive,
                      ]}
                    >
                      {t(p.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>{t("auth.register.profilePhoto")} </Text>
            <Pressable style={styles.imagePickerWrap} onPress={pickImage}>
              <View style={styles.imagePicker}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={Colors.textSecondary} />
                    <Text style={styles.imagePlaceholderText}>{t("auth.register.choosePhoto")}</Text>
                  </View>
                )}
                <View style={styles.cameraOverlay}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </View>
            </Pressable>
            {profileImageUri ? (
              <Pressable onPress={() => setProfileImageUri(null)}>
                <Text style={styles.removeImageText}>{t("auth.register.removePhoto")}</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? "hourglass-outline" : "checkmark-circle"}
              size={20}
              color="#fff"
            />
            <Text style={styles.submitBtnText}>
              {isLoading ? t("auth.register.sending") : t("auth.register.sendOtp")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>{t("auth.common.haveAccount")}</Text>
          <Pressable onPress={() => router.replace("/auth/player/login")}>
            <Text style={styles.loginLink}>{t("auth.common.signIn")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    gap: 12,
    marginBottom: 36,
  },
  roleIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  genderSection: {
    gap: 10,
  },
  genderLabel: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  genderBtnActive: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  genderBtnActiveFemale: {
    backgroundColor: "#E91E8C",
    borderColor: "#E91E8C",
  },
  genderBtnText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  genderBtnTextActive: {
    color: "#fff",
  },
  genderBtnTextActiveFemale: {
    color: "#fff",
  },
  imageSection: {
    gap: 8,
    alignItems: "center",
  },
  imageLabel: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    alignSelf: "flex-start",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  imagePicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderStyle: "dashed",
  },
  imagePickerWrap: {
    position: "relative",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    gap: 4,
  },
  imagePlaceholderText: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "#fff",
  },
  removeImageText: {
    color: Colors.destructive,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  fieldError: {
    color: Colors.destructive,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginTop: 4,
    marginBottom: 4,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#000",
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },
  loginHint: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loginLink: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  dateText: {
    color: "#0D0D0F",
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
  },
  positionSection: {
    gap: 10,
  },
  positionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  positionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  positionBtnActive: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  positionText: {
    fontFamily: "Cairo_600SemiBold",
    color: "#333",
  },
  positionTextActive: {
    color: "#fff",
  },
  dateModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dateModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "85%",
    alignItems: "center",
    overflow: "hidden",
  },
  datePickerWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 8,
  },
  dateConfirmBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  dateConfirmText: {
    color: "#fff",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },
});
