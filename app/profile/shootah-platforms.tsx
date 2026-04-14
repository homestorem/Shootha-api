import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  ScrollView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { AppBrand } from "@/components/AppBrand";
import { BRAND_PLATFORMS } from "@/constants/brandPlatforms";

type PlatformTile = {
  key: string;
  url: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
};

const TILES_TOP: PlatformTile[] = [
  {
    key: "fb",
    url: BRAND_PLATFORMS.facebook,
    labelKey: "brandPlatforms.facebook",
    icon: "logo-facebook",
    iconColor: "#1877F2",
    bg: "rgba(24,119,242,0.12)",
  },
  {
    key: "ig",
    url: BRAND_PLATFORMS.instagram,
    labelKey: "brandPlatforms.instagram",
    icon: "logo-instagram",
    iconColor: "#E4405F",
    bg: "rgba(228,64,95,0.12)",
  },
];

const TILES_MID: PlatformTile[] = [
  {
    key: "tt",
    url: BRAND_PLATFORMS.tiktok,
    labelKey: "brandPlatforms.tiktok",
    icon: "logo-tiktok",
    iconColor: "#fff",
    bg: "rgba(0,0,0,0.55)",
  },
  {
    key: "wa",
    url: BRAND_PLATFORMS.whatsapp,
    labelKey: "brandPlatforms.whatsapp",
    icon: "logo-whatsapp",
    iconColor: "#25D366",
    bg: "rgba(37,211,102,0.14)",
  },
];

export default function ShootahPlatformsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { t } = useLang();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const gap = 12;
  const pad = 18;
  const colW = (width - pad * 2 - gap) / 2;

  const openUrl = useCallback(
    async (url: string) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await Linking.openURL(url);
      } catch {
        Alert.alert(t("common.errorTitle"), t("brandPlatforms.openError"));
      }
    },
    [t],
  );

  const dialPhone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const raw = BRAND_PLATFORMS.phoneE164.replace(/^\+/, "");
    Linking.openURL(`tel:+${raw}`);
  }, []);

  const webTile: PlatformTile = {
    key: "web",
    url: BRAND_PLATFORMS.website,
    labelKey: "brandPlatforms.website",
    icon: "globe-outline",
    iconColor: Colors.primary,
    bg: isDark ? "rgba(0,230,118,0.12)" : "rgba(0,200,83,0.1)",
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        <Pressable style={styles.headerIcon} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {t("profile.shoothaPlatforms")}
        </Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: pad, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("brandPlatforms.subtitle")}
        </Text>

        <View style={[styles.row, { gap }]}>
          {TILES_TOP.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => openUrl(tile.url)}
              style={({ pressed }) => [
                styles.tile,
                {
                  width: colW,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: tile.bg }]}>
                <Ionicons name={tile.icon} size={28} color={tile.iconColor} />
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{t(tile.labelKey)}</Text>
              <Text style={[styles.tileHint, { color: colors.textTertiary }]}>
                {t("brandPlatforms.tapOpen")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={dialPhone}
          style={({ pressed }) => [
            styles.centerCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? "rgba(0,230,118,0.35)" : "rgba(0,200,83,0.28)",
              marginTop: gap,
              opacity: pressed ? 0.95 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <AppBrand size={26} />
          <View style={styles.phoneRow}>
            <Ionicons name="call" size={20} color={Colors.primary} />
            <Text style={[styles.phoneText, { color: colors.text }]} selectable>
              {BRAND_PLATFORMS.phoneDisplay}
            </Text>
          </View>
          <Text style={[styles.centerHint, { color: colors.textSecondary }]}>
            {t("brandPlatforms.tapCall")}
          </Text>
        </Pressable>

        <View style={[styles.row, { gap, marginTop: gap }]}>
          {TILES_MID.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => openUrl(tile.url)}
              style={({ pressed }) => [
                styles.tile,
                {
                  width: colW,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: tile.bg }]}>
                <Ionicons name={tile.icon} size={28} color={tile.iconColor} />
              </View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>{t(tile.labelKey)}</Text>
              <Text style={[styles.tileHint, { color: colors.textTertiary }]}>
                {t("brandPlatforms.tapOpen")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => openUrl(webTile.url)}
          style={({ pressed }) => [
            styles.webTile,
            {
              marginTop: gap,
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <View style={[styles.tileIconWrap, { backgroundColor: webTile.bg }]}>
            <Ionicons name={webTile.icon} size={28} color={webTile.iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tileLabel, { color: colors.text }]}>{t(webTile.labelKey)}</Text>
            <Text style={[styles.webUrl, { color: colors.textSecondary }]} numberOfLines={1}>
              {BRAND_PLATFORMS.website.replace(/^https?:\/\//, "")}
            </Text>
          </View>
          <Ionicons name="open-outline" size={20} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Cairo_700Bold" },
  scroll: { paddingTop: 20 },
  subtitle: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    minHeight: 132,
    justifyContent: "center",
  },
  tileIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileLabel: { fontSize: 15, fontFamily: "Cairo_700Bold", textAlign: "center" },
  tileHint: { fontSize: 11, fontFamily: "Cairo_400Regular", marginTop: 4, textAlign: "center" },
  centerCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  phoneText: { fontSize: 20, fontFamily: "Cairo_700Bold", letterSpacing: 0.5 },
  centerHint: { fontSize: 12, fontFamily: "Cairo_400Regular", marginTop: 2 },
  webTile: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  webUrl: { fontSize: 13, fontFamily: "Cairo_400Regular", marginTop: 2 },
});
