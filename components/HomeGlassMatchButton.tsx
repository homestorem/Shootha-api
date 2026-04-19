import React, { useCallback, useId, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Stop, Rect, Pattern, Line } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

const BTN_H = 72;
const R = BTN_H / 2;
const GRID = 6;

export type HomeGlassMatchVariant = "create" | "join";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type Props = {
  variant: HomeGlassMatchVariant;
  title: string;
  icon: IoniconsName;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function HomeGlassMatchButton({ variant, title, icon, onPress, accessibilityLabel }: Props) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const radialId = `${reactId}rad`;
  const gridId = `${reactId}grid`;
  const [w, setW] = useState(240);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setW(Math.max(1, Math.round(e.nativeEvent.layout.width)));
  }, []);

  const isJoin = variant === "join";
  const borderColor = isJoin ? "rgba(121, 237, 137, 0.3)" : "rgba(200, 200, 200, 0.3)";
  const textColor = isJoin ? "#c9ffd3" : "#e0e0e0";
  const iconColor = textColor;

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pressOuter,
        isJoin ? styles.shadowJoin : styles.shadowCreate,
        pressed && (isJoin ? styles.shadowJoinHover : styles.shadowCreateHover),
        { transform: [{ translateY: pressed ? -2 : 0 }] },
      ]}
    >
      <View
        style={[styles.clip, { borderColor }]}
        onLayout={onLayout}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 32 : 24}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        <Svg width={w} height={BTN_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={radialId} cx="50%" cy="50%" r="65%">
              {isJoin ? (
                <>
                  <Stop offset="0%" stopColor="rgba(30, 77, 47, 0.62)" />
                  <Stop offset="100%" stopColor="rgba(15, 30, 20, 0.82)" />
                </>
              ) : (
                <>
                  <Stop offset="0%" stopColor="rgba(40, 50, 60, 0.62)" />
                  <Stop offset="100%" stopColor="rgba(20, 25, 30, 0.82)" />
                </>
              )}
            </RadialGradient>
            <Pattern id={gridId} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <Line x1="0" y1="0" x2={GRID} y2="0" stroke="rgba(121, 237, 137, 0.08)" strokeWidth="1" />
              <Line x1="0" y1="0" x2="0" y2={GRID} stroke="rgba(121, 237, 137, 0.08)" strokeWidth="1" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width={w} height={BTN_H} fill={`url(#${radialId})`} />
          <Rect x="0" y="0" width={w} height={BTN_H} fill={`url(#${gridId})`} opacity={0.45} />
        </Svg>

        <LinearGradient
          colors={["rgba(121, 237, 137, 0.06)", "transparent", "rgba(121, 237, 137, 0.03)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.insetGlow}
          pointerEvents="none"
        />

        <View style={styles.content} pointerEvents="none">
          <Ionicons name={icon} size={26} color={iconColor} style={{ opacity: 0.88, marginBottom: 4 }} />
          <Text style={[styles.label, { color: textColor }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressOuter: {
    flex: 1,
    minWidth: 100,
    maxWidth: 240,
    borderRadius: R,
  },
  clip: {
    height: BTN_H,
    borderRadius: R,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  insetGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    zIndex: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "center",
    lineHeight: 17,
  },
  shadowJoin: {
    ...Platform.select({
      ios: {
        shadowColor: "rgba(121, 237, 137, 0.45)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  shadowCreate: {
    ...Platform.select({
      ios: {
        shadowColor: "rgba(180, 190, 200, 0.35)",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 7,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  shadowJoinHover: {
    ...Platform.select({
      ios: {
        shadowColor: "rgba(121, 237, 137, 0.65)",
        shadowRadius: 12,
      },
      android: { elevation: 7 },
      default: {},
    }),
  },
  shadowCreateHover: {
    ...Platform.select({
      ios: {
        shadowColor: "rgba(200, 210, 220, 0.45)",
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
});
