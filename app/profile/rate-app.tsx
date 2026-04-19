import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { Colors } from "@/constants/colors";
import { submitAppFeedback } from "@/lib/firestore-app-feedback";

function StarsRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const v = Math.max(1, Math.min(5, value));
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        const active = star <= v;
        return (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={10}>
            <Ionicons
              name={active ? "star" : "star-outline"}
              size={28}
              color={active ? "#FBBF24" : "rgba(255,255,255,0.55)"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RateAppScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const { user, isGuest } = useAuth();

  const [stars, setStars] = useState(5);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const appVersion = useMemo(() => {
    const v = (Constants.expoConfig as any)?.version ?? null;
    return typeof v === "string" ? v : null;
  }, []);

  const canSend = message.trim().length >= 3 && !sending;

  const onSubmit = async () => {
    if (!user || isGuest || user.id === "guest") {
      Alert.alert(t("common.warningTitle"), t("account.loginFirst"));
      return;
    }
    const msg = message.trim();
    if (msg.length < 3) {
      Alert.alert(t("common.warningTitle"), "اكتب ملاحظة قصيرة حتى نعرف شنو نصلّح.");
      return;
    }
    setSending(true);
    try {
      await submitAppFeedback({
        userId: user.id,
        userName: user.name ?? null,
        phone: user.phone ?? null,
        playerId: user.playerId ?? null,
        role: user.role ?? null,
        stars,
        message: msg,
        platform: Platform.OS,
        appVersion,
      });
      Alert.alert(t("common.done"), "شكراً! تم إرسال تقييمك.");
      setMessage("");
      router.back();
    } catch (e: any) {
      Alert.alert(t("common.errorTitle"), e?.message ?? "تعذر إرسال التقييم.");
    } finally {
      setSending(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("profile.rateApp")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>شنو رأيك بالتطبيق؟</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              قيّمنا بالنجوم واكتب ملاحظة قصيرة. هذا يساعدنا نصلّح المشاكل بسرعة.
            </Text>

            <StarsRow value={stars} onChange={setStars} />

            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="اكتب رأيك هنا…"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={[styles.counter, { color: colors.textTertiary }]}>
                {message.trim().length}/500
              </Text>
            </View>

            <Pressable
              style={[
                styles.sendBtn,
                { backgroundColor: Colors.primary },
                !canSend && { opacity: 0.55 },
              ]}
              onPress={onSubmit}
              disabled={!canSend}
            >
              {sending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.sendText}>إرسال التقييم</Text>
                </>
              )}
            </Pressable>

            {appVersion ? (
              <Text style={[styles.meta, { color: colors.textTertiary }]}>
                نسخة التطبيق: {appVersion}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  content: { paddingHorizontal: 20, paddingTop: 20 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  title: { fontSize: 18, fontFamily: "Cairo_700Bold" },
  sub: { fontSize: 13, fontFamily: "Cairo_400Regular", lineHeight: 20 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 6 },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 140,
    gap: 8,
  },
  input: { fontFamily: "Cairo_400Regular", fontSize: 14, minHeight: 96 },
  counter: { alignSelf: "flex-end", fontSize: 11, fontFamily: "Cairo_400Regular" },
  sendBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  sendText: { color: "#000", fontSize: 14, fontFamily: "Cairo_700Bold" },
  meta: { textAlign: "center", fontSize: 11, fontFamily: "Cairo_400Regular", marginTop: 4 },
});

