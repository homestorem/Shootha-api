import React, { memo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

type GlassWelcomeCardProps = {
  userName: string;
  locationLines: string;
};

function GlassWelcomeCardInner({ userName, locationLines }: GlassWelcomeCardProps) {
  const { isDark, colors } = useTheme();
  const tint = isDark ? "dark" : "light";
  const fallbackBg = isDark ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.55)";
  const labelColor = isDark ? "rgba(255,255,255,0.62)" : colors.textSecondary;
  const nameColor = isDark ? "rgba(255,255,255,0.96)" : colors.text;

  return (
    <View
      style={[
        styles.wrap,
        { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" },
      ]}
    >
      <View style={[styles.fallbackTint, { backgroundColor: fallbackBg }]} />
      <BlurView
        intensity={Platform.OS === "ios" ? (isDark ? 42 : 36) : 28}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ["rgba(255,255,255,0.07)", "rgba(255,255,255,0)", "rgba(0,0,0,0.12)"]
            : ["rgba(255,255,255,0.65)", "rgba(255,255,255,0.15)", "rgba(0,0,0,0.04)"]
        }
        locations={[0, 0.35, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.04)", "transparent"]}
        style={styles.innerGlow}
        pointerEvents="none"
      />
      <View style={styles.inner}>
        <View style={styles.headTextWrap}>
          <Text
            style={[
              styles.label,
              { color: labelColor, textAlign: "right", writingDirection: "rtl" },
            ]}
          >
            أهلاً بك
          </Text>
          <Text
            style={[
              styles.name,
              { color: nameColor, textAlign: "right", writingDirection: "rtl" },
            ]}
            numberOfLines={1}
          >
            {userName}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.textSecondary} style={styles.locIcon} />
          <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={2}>
            {locationLines}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const GlassWelcomeCard = memo(GlassWelcomeCardInner);

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },
  fallbackTint: {
    ...StyleSheet.absoluteFillObject,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  inner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
    alignItems: "flex-end",
  },
  headTextWrap: {
    width: "100%",
    alignItems: "flex-end",
  },
  label: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    letterSpacing: 0.15,
    width: "100%",
  },
  name: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
    lineHeight: 22,
    width: "100%",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  locIcon: {
    marginTop: 1,
    opacity: 0.95,
  },
  locationText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    lineHeight: 15,
    textAlign: "right",
  },
});
