import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const { token } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [subjectError, setSubjectError] = useState("");
  const [messageError, setMessageError] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleWhatsApp = () => {
    Linking.openURL("https://wa.me/9647700000000");
  };

  const handleEmail = () => {
    Linking.openURL("mailto:support@shootha.iq");
  };

  const validate = (): boolean => {
    let valid = true;
    if (!subject.trim()) {
      setSubjectError(t("fieldRequired"));
      valid = false;
    } else {
      setSubjectError("");
    }
    if (!message.trim()) {
      setMessageError(t("fieldRequired"));
      valid = false;
    } else {
      setMessageError("");
    }
    return valid;
  };

  const handleSend = async () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSending(true);
    setSentMsg("");
    try {
      await apiRequest(
        "POST",
        "/api/support/message",
        { subject: subject.trim(), message: message.trim() },
        { Authorization: `Bearer ${token!}` }
      );
      setSentMsg(t("messageSent"));
      setSubject("");
      setMessage("");
      setTimeout(() => setSentMsg(""), 5000);
    } catch (e: any) {
      setSentMsg(e?.message ?? "حدث خطأ");
    } finally {
      setIsSending(false);
    }
  };

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
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("supportTitle")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.quickLinksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            style={[styles.quickLink, { borderBottomColor: colors.border }]}
            onPress={handleWhatsApp}
          >
            <View style={[styles.quickIcon, { backgroundColor: "rgba(37,211,102,0.12)" }]}>
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t("whatsapp")}</Text>
            <Ionicons name="chevron-back" size={16} color={colors.textTertiary} />
          </Pressable>

          <Pressable style={styles.quickLink} onPress={handleEmail}>
            <View style={[styles.quickIcon, { backgroundColor: "rgba(0,122,255,0.12)" }]}>
              <Ionicons name="mail-outline" size={22} color={Colors.blue} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t("email")}</Text>
            <Ionicons name="chevron-back" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        <Text
          style={[styles.sectionTitle, { color: colors.textSecondary }]}
        >
          {t("contactForm")}
        </Text>

        {!!sentMsg && (
          <View
            style={[
              styles.sentBanner,
              {
                backgroundColor: sentMsg === t("messageSent")
                  ? "rgba(46,204,113,0.12)"
                  : "rgba(255,59,48,0.1)",
                borderColor: sentMsg === t("messageSent")
                  ? "rgba(46,204,113,0.3)"
                  : "rgba(255,59,48,0.3)",
              },
            ]}
          >
            <Ionicons
              name={sentMsg === t("messageSent") ? "checkmark-circle" : "alert-circle"}
              size={18}
              color={sentMsg === t("messageSent") ? Colors.primary : Colors.destructive}
            />
            <Text
              style={[
                styles.sentText,
                { color: sentMsg === t("messageSent") ? Colors.primary : Colors.destructive },
              ]}
            >
              {sentMsg}
            </Text>
          </View>
        )}

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("subject")}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: subjectError ? Colors.destructive : colors.border,
                },
              ]}
              value={subject}
              onChangeText={(v) => { setSubject(v); setSubjectError(""); }}
              placeholder={t("subjectPlaceholder")}
              placeholderTextColor={colors.textTertiary}
              textAlign="right"
            />
            {!!subjectError && (
              <Text style={[styles.errorText, { color: Colors.destructive }]}>{subjectError}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t("message")}</Text>
            <TextInput
              style={[
                styles.textarea,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: messageError ? Colors.destructive : colors.border,
                },
              ]}
              value={message}
              onChangeText={(v) => { setMessage(v); setMessageError(""); }}
              placeholder={t("messagePlaceholder")}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              textAlign="right"
            />
            {!!messageError && (
              <Text style={[styles.errorText, { color: Colors.destructive }]}>{messageError}</Text>
            )}
          </View>

          <Pressable
            style={[styles.sendBtn, isSending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>{t("send")}</Text>
              </>
            )}
          </Pressable>
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60, gap: 0 },
  quickLinksCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 24,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { flex: 1, fontSize: 15, fontFamily: "Cairo_400Regular" },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  sentText: { flex: 1, fontSize: 13, fontFamily: "Cairo_400Regular" },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
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
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
  },
  errorText: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  sendBtnText: { color: "#fff", fontSize: 16, fontFamily: "Cairo_700Bold" },
});
