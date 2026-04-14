import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ImageBackground,
  InteractionManager,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { normalizeIqPhoneToE164, isValidIqMobileE164 } from "@/lib/phoneE164";
import { AuthInput } from "@/components/AuthInput";
import { LinearGradient } from "expo-linear-gradient";
import RecaptchaWebMount from "@/components/RecaptchaWebMount";
import {
  assertPhoneAllowedForPlayerApp,
  isPhoneAlreadyRegistered,
} from "@/lib/firebasePhoneAuth";
import { useLang, type Language } from "@/context/LanguageContext";
import { Colors } from "@/constants/colors";

export default function PlayerLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestLoginPhoneOtp, continueAsGuest } = useAuth();
  const { t, language, setLanguageForUser } = useLang();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const validatePhone = (val: string) => {
    if (!val.trim()) return t("auth.common.phoneRequired");
    const e164 = normalizeIqPhoneToE164(val);
    if (!isValidIqMobileE164(e164)) return t("auth.common.phoneInvalid");
    return "";
  };

  const handleLogin = async () => {
    const err = validatePhone(phone);
    if (err) {
      setPhoneError(err);
      return;
    }
    setPhoneError("");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const e164 = normalizeIqPhoneToE164(phone);
      await assertPhoneAllowedForPlayerApp(e164);
      const exists = await isPhoneAlreadyRegistered(e164);
      if (!exists) {
        Alert.alert(t("auth.login.phoneNotRegisteredTitle"), t("auth.login.phoneNotRegisteredBody"));
        return;
      }
      await requestLoginPhoneOtp(phone);
      /** بدون + في المسار لتجنّب أخطاء الترميز؛ يُعاد بناء E.164 في شاشة التحقق */
      const go = () =>
        router.push({
          pathname: "/auth/player/verify-otp",
          params: {
            phone: e164.replace(/^\+/, ""),
            mode: "login",
          },
        } as Href);
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

  const handleGuest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await continueAsGuest();
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => router.replace("/(tabs)" as Href), 0);
      });
    } catch {
      Alert.alert(t("auth.common.error"), t("auth.login.guestFailed"));
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
        <View style={styles.langRow}>
          <Pressable style={styles.langBtn} onPress={() => setShowLanguage(true)}>
            <Ionicons name="language-outline" size={16} color={Colors.primary} />
            <Text style={styles.langBtnTxt}>
              {language === "ar" ? t("language.ar") : language === "ku" ? t("language.ku") : t("language.en")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.heroSection}>
          <View style={styles.roleIcon}>
            <Ionicons name="football" size={32} color="#fff" />
          </View>
          <Text style={styles.title}>{t("auth.login.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.login.subtitle")}</Text>
        </View>

        <View style={styles.form}>
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
            autoCapitalize="none"
            error={phoneError}
            authEmphasis
          />

          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.submitBtnText}>
              {isLoading ? t("auth.login.sending") : t("auth.login.sendOtp")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.guestSection}>
          <View style={styles.divider} />
          <Text style={styles.orText}>{t("auth.common.or")}</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={styles.guestBtn}
          onPress={handleGuest}
          disabled={isLoading}
        >
          <Ionicons name="person-outline" size={20} color="#fff" />
          <Text style={styles.guestBtnText}>{t("auth.login.continueGuest")}</Text>
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={styles.registerHint}>{t("auth.common.noAccount")}</Text>
          <Pressable onPress={() => router.replace("/auth/registration" as Href)}>
            <Text style={styles.registerLink}>{t("auth.common.createAccount")}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal visible={showLanguage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t("language.select")}</Text>
            {(
              [
                { id: "ar", label: t("language.ar") },
                { id: "ku", label: t("language.ku") },
                { id: "en", label: t("language.en") },
              ] as { id: Language; label: string }[]
            ).map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.langOption, language === opt.id && styles.langOptionActive]}
                onPress={async () => {
                  await setLanguageForUser(opt.id);
                  setShowLanguage(false);
                }}
              >
                <Text style={[styles.langOptionText, language === opt.id && styles.langOptionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.doneBtn} onPress={() => setShowLanguage(false)}>
              <Text style={styles.doneBtnTxt}>{t("common.done")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 0 },
  langRow: { alignItems: "flex-end", marginBottom: 8 },
  langBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  langBtnTxt: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  heroSection: { alignItems: "center", gap: 12, marginBottom: 36 },
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
  form: { gap: 16, marginBottom: 24 },
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
  submitBtnDisabled: { backgroundColor: "rgba(0,0,0,0.4)" },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Cairo_700Bold" },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },
  registerHint: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  registerLink: { color: "#fff", fontSize: 14, fontFamily: "Cairo_600SemiBold" },
  guestSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 16,
    gap: 10,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
  },

  orText: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  guestBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBox: {
    width: "84%",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(20,20,20,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  langOption: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  langOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(15,157,88,0.16)",
  },
  langOptionText: {
    color: "#fff",
    fontFamily: "Cairo_600SemiBold",
  },
  langOptionTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_700Bold",
  },
  doneBtn: {
    marginTop: 4,
    height: 42,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  doneBtnTxt: {
    color: "#000",
    fontFamily: "Cairo_700Bold",
  },
});
