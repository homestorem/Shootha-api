import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

interface SkeletonCardProps {
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ height = 120, borderRadius = 16, style }: SkeletonCardProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.85],
  });

  return (
    <Animated.View
      style={[
        styles.base,
        { height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonVenueCard() {
  return (
    <View style={styles.venueCard}>
      <SkeletonCard height={160} borderRadius={16} style={styles.imageArea} />
      <View style={styles.textArea}>
        <SkeletonCard height={16} borderRadius={8} style={{ width: "60%" }} />
        <SkeletonCard height={12} borderRadius={6} style={{ width: "40%", marginTop: 6 }} />
        <SkeletonCard height={12} borderRadius={6} style={{ width: "30%", marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.shimmer2,
  },
  venueCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  imageArea: {
    width: "100%",
    borderRadius: 0,
  },
  textArea: {
    padding: 14,
    gap: 4,
  },
});
