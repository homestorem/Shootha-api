import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleWhatsApp = () => {
    Linking.openURL("https://wa.me/9647700000000");
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("helpSupport")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoIcon}>
            <Ionicons name="headset-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {t("helpSupport")}
          </Text>
          <Text style={[styles.infoSub, { color: colors.textSecondary }]}>
            فريقنا جاهز لمساعدتك في أي وقت
          </Text>
        </View>

        <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            style={[styles.chatBtn, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/profile/support-chat")}
          >
            <View style={styles.chatIcon}>
              <Ionicons name="chatbubbles-outline" size={26} color={Colors.primary} />
            </View>
            <View style={styles.chatTextCol}>
              <Text style={[styles.chatLabel, { color: colors.text }]}>
                محادثة مباشرة مع الدعم
              </Text>
              <Text style={[styles.chatSub, { color: colors.textSecondary }]}>
                ردود فورية من الفريق
              </Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            style={[styles.whatsappBtn, { borderColor: "rgba(37,211,102,0.3)" }]}
            onPress={handleWhatsApp}
          >
            <View style={styles.whatsappIcon}>
              <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
            </View>
            <View style={styles.whatsappTextCol}>
              <Text style={[styles.whatsappLabel, { color: colors.text }]}>
                {t("whatsapp")}
              </Text>
              <Text style={[styles.whatsappSub, { color: colors.textSecondary }]}>
                +964 770 000 0000
              </Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 28, gap: 16 },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  infoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(15,157,88,0.1)",
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  infoTitle: { fontSize: 18, fontFamily: "Cairo_700Bold" },
  infoSub: { fontSize: 13, fontFamily: "Cairo_400Regular", textAlign: "center" },
  linksCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  chatIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(15,157,88,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatTextCol: { flex: 1, gap: 2 },
  chatLabel: { fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  chatSub: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  whatsappBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 0,
  },
  whatsappIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(37,211,102,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  whatsappTextCol: { flex: 1, gap: 2 },
  whatsappLabel: { fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  whatsappSub: { fontSize: 12, fontFamily: "Cairo_400Regular" },
});
