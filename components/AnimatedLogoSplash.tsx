/**
 * شاشة افتتاح — خلفية خضراء ونص فقط (بدون صور).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, useWindowDimensions, Platform } from "react-native";
import i18n from "@/i18n";

const BG = "#228B22";
const WHITE = "#FFFFFF";

const TOTAL_SPLASH_MS = 2800;

type Props = {
  onComplete: () => void;
};

export function AnimatedLogoSplash({ onComplete }: Props) {
  const { height } = useWindowDimensions();
  const [, setI18nTick] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);
  const lowerThirdH = height / 3;
  const tagline = i18n.t("splash.tagline");
  const rtl = i18n.dir() === "rtl";

  const safeComplete = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const onLang = () => setI18nTick((n) => n + 1);
    i18n.on("languageChanged", onLang);
    return () => {
      void i18n.off("languageChanged", onLang);
    };
  }, []);

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
          <Text
            style={[styles.tagline, { writingDirection: rtl ? "rtl" : "ltr" }]}
            allowFontScaling={false}
          >
            {tagline}
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
  },
});
