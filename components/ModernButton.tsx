import React, { memo, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  withRepeat,
  cancelAnimation,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";

const ACCENT = Colors.primary;
const DURATION = 200;
const EASE = Easing.out(Easing.cubic);

export type ModernButtonVariant = "primary" | "secondary";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export type ModernButtonProps = {
  title: string;
  icon: IoniconsName;
  onPress: () => void;
  variant?: ModernButtonVariant;
  /** نبض خفيف على الحافة السفلية (الأساسي فقط) */
  pulseGlow?: boolean;
  testID?: string;
};

function ModernButtonInner({
  title,
  icon,
  onPress,
  variant = "primary",
  pulseGlow = true,
  testID,
}: ModernButtonProps) {
  const pressed = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!pulseGlow || variant !== "primary") {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => cancelAnimation(pulse);
  }, [pulseGlow, variant, pulse]);

  const rStyle = useAnimatedStyle(() => {
    const t = pressed.value;
    const scale = interpolate(t, [0, 1], [1, 0.97]);
    const opacity = interpolate(t, [0, 1], [1, 0.88]);
    return { transform: [{ scale }], opacity };
  });

  const rGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.2, 0.45]),
  }));

  const onPressIn = () => {
    pressed.value = withTiming(1, { duration: DURATION, easing: EASE });
  };

  const onPressOut = () => {
    pressed.value = withTiming(0, { duration: DURATION, easing: EASE });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isPrimary = variant === "primary";

  return (
    <Animated.View style={[styles.flex, rStyle]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.pressable}
      >
        {isPrimary ? (
          <View style={[styles.clip, styles.primaryClip]}>
            <LinearGradient
              colors={["rgba(28,28,28,0.98)", "rgba(18,18,18,0.99)", "rgba(14,14,14,1)"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255,255,255,0.06)", "transparent", "transparent"]}
              style={styles.reflection}
            />
            <Animated.View style={[styles.accentGlowLine, rGlowStyle]} />
            <View style={styles.accentTopHairline} />
            <View style={styles.content}>
              <Ionicons name={icon} size={22} color="rgba(255,255,255,0.92)" />
              <Text style={styles.titlePrimary} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.clip, styles.secondaryOuter]}>
            <BlurView intensity={Platform.OS === "ios" ? 28 : 20} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255,255,255,0.05)", "transparent", "rgba(0,0,0,0.15)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.content}>
              <Ionicons name={icon} size={22} color="rgba(255,255,255,0.88)" />
              <Text style={styles.titleSecondary} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export const ModernButton = memo(ModernButtonInner);

const R = 16;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pressable: {
    borderRadius: R,
    overflow: "hidden",
  },
  clip: {
    minHeight: 92,
    borderRadius: R,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderWidth: 1,
  },
  primaryClip: {
    borderColor: "rgba(15, 157, 88, 0.22)",
  },
  secondaryOuter: {
    backgroundColor: "rgba(12,12,12,0.45)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  reflection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    borderTopLeftRadius: R,
    borderTopRightRadius: R,
  },
  accentTopHairline: {
    position: "absolute",
    top: 0,
    left: "12%",
    right: "12%",
    height: 1,
    backgroundColor: ACCENT,
    opacity: 0.35,
  },
  accentGlowLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: ACCENT,
    opacity: 0.35,
  },
  content: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2,
  },
  titlePrimary: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    lineHeight: 16,
    width: "100%",
  },
  titleSecondary: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    lineHeight: 16,
    width: "100%",
  },
});
