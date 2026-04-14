/**
 * شاشة افتتاح — خلفية #228B22، SHOOT'HA في الوسط وشعار عربي في الأسفل (بدون صورة أيقونة).
 */
import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, useWindowDimensions, Platform } from "react-native";

const BG = "#228B22";
const WHITE = "#FFFFFF";

const TOTAL_SPLASH_MS = 2800;

type Props = {
  onComplete: () => void;
};

export function AnimatedLogoSplash({ onComplete }: Props) {
  const { height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);
  const lowerThirdH = height / 3;

  const safeComplete = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (Platform.OS === "web") {
      safeComplete();
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();

    const t = setTimeout(safeComplete, TOTAL_SPLASH_MS);
    return () => clearTimeout(t);
  }, [opacity, safeComplete]);

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View style={[styles.endFull, { opacity }]}>
        <View style={styles.brandAbsoluteCenter}>
          <Text style={styles.brandText} allowFontScaling={false}>
            {"SHOOT'HA"}
          </Text>
        </View>
        <View style={[styles.lowerThird, { height: lowerThirdH }]}>
          <Text style={styles.tagline} allowFontScaling={false}>
            أحجز ملعبك في ثوان
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 99999,
    elevation: 99999,
    alignItems: "center",
    justifyContent: "center",
  },
  endFull: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
  },
  brandAbsoluteCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  brandText: {
    color: WHITE,
    fontSize: 36,
    fontFamily: "Cairo_700Bold",
    letterSpacing: 0.5,
    textAlign: "center",
    transform: [{ skewX: "-4deg" }],
  },
  lowerThird: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 2,
  },
  tagline: {
    color: WHITE,
    fontSize: 17,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "center",
    lineHeight: 26,
    opacity: 0.95,
    writingDirection: "rtl",
  },
});
