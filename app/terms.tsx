import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { AppBackground } from "@/components/AppBackground";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PAD = Math.max(16, Math.min(22, SCREEN_WIDTH * 0.05));
const CARD_RADIUS = 18;

function LegalCard({
  children,
  isDark,
  colors,
  accentRail = true,
}: {
  children: React.ReactNode;
  isDark: boolean;
  colors: { card: string; border: string };
  accentRail?: boolean;
}) {
  const shadow = isDark
    ? {
        shadowColor: Colors.primary,
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 0,
      }
    : {
        shadowColor: "#0A0A0A",
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      };

  return (
    <View
      style={[
        styles.cardOuter,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          ...(accentRail ? { borderStartWidth: 4, borderStartColor: Colors.primary } : {}),
        },
        shadow,
      ]}
    >
      <View style={styles.cardPad}>{children}</View>
    </View>
  );
}

function BodyBlock({
  text,
  color,
  textAlign,
  writingDirection,
  marginBottom = 10,
}: {
  text: string;
  color: string;
  textAlign: "left" | "right";
  writingDirection: "ltr" | "rtl";
  marginBottom?: number;
}) {
  if (!text.trim()) return null;
  return (
    <Text
      style={[styles.body, { color, textAlign, writingDirection, marginBottom }]}
    >
      {text}
    </Text>
  );
}

export default function Terms() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t, textAlign, writingDirection, iconFlipStyle } = useLang();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 28 : insets.bottom;
  const headerBg = isDark ? "rgba(13,13,13,0.82)" : "rgba(255,255,255,0.92)";
  const subtitle = t("terms.docSubtitle").trim();
  const gap = { marginBottom: 14 };

  return (
    <AppBackground>
      <View style={styles.flex}>
        <View
          style={[
            styles.header,
            {
              paddingTop: topPad,
              backgroundColor: headerBg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.headerIcon} style={iconFlipStyle} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {t("profile.terms")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: H_PAD,
            paddingTop: 16,
            paddingBottom: bottomPad + 48,
          }}
          showsVerticalScrollIndicator={false}
        >
          <LegalCard isDark={isDark} colors={colors} accentRail={false}>
            <Text style={[styles.h1, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.docTitle")}
            </Text>
            {subtitle ? (
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: isDark ? "rgba(15,157,88,0.16)" : "rgba(15,157,88,0.12)",
                    borderColor: isDark ? "rgba(15,157,88,0.35)" : "rgba(15,157,88,0.28)",
                    alignSelf: writingDirection === "rtl" ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: colors.primary }]}>{subtitle}</Text>
              </View>
            ) : null}
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.introTitle")}
            </Text>
            <BodyBlock
              text={t("terms.introBody")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec1Title")}
            </Text>
            <BodyBlock text={t("terms.sec1a")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <BodyBlock
              text={t("terms.sec1b")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec2Title")}
            </Text>
            <BodyBlock text={t("terms.sec2a")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <BodyBlock text={t("terms.sec2b")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <BodyBlock
              text={t("terms.sec2c")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec3Title")}
            </Text>
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection, marginTop: 4 }]}>
              {t("terms.sec3EarlyTitle")}
            </Text>
            <BodyBlock text={t("terms.sec3EarlyBody")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec3LateTitle")}
            </Text>
            <BodyBlock text={t("terms.sec3LateBody")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec3NoShowTitle")}
            </Text>
            <BodyBlock text={t("terms.sec3NoShowBody")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec3VenueTitle")}
            </Text>
            <BodyBlock
              text={t("terms.sec3VenueBody")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec4Title")}
            </Text>
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection, marginTop: 4 }]}>
              {t("terms.sec4InjTitle")}
            </Text>
            <BodyBlock text={t("terms.sec4InjBody")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec4PropTitle")}
            </Text>
            <BodyBlock text={t("terms.sec4PropBody")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <Text style={[styles.h3, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec4CondTitle")}
            </Text>
            <BodyBlock
              text={t("terms.sec4CondBody")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec5Title")}
            </Text>
            <BodyBlock text={t("terms.sec5a")} color={colors.textSecondary} textAlign={textAlign} writingDirection={writingDirection} />
            <BodyBlock
              text={t("terms.sec5b")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>

          <View style={gap} />

          <LegalCard isDark={isDark} colors={colors}>
            <Text style={[styles.h2, { color: colors.text, textAlign, writingDirection }]}>
              {t("terms.sec6Title")}
            </Text>
            <BodyBlock
              text={t("terms.sec6Body")}
              color={colors.textSecondary}
              textAlign={textAlign}
              writingDirection={writingDirection}
              marginBottom={0}
            />
          </LegalCard>
        </ScrollView>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  scroll: { flex: 1, backgroundColor: "transparent" },
  cardOuter: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardPad: { paddingHorizontal: 16, paddingVertical: 16 },
  h1: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    lineHeight: 28,
    marginBottom: 10,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  h2: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
    lineHeight: 24,
    marginBottom: 10,
  },
  h3: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    lineHeight: 24,
  },
});
