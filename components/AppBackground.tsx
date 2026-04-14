import React from "react";
import { ImageBackground, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function AppBackground({ children, style }: Props) {
  return (
    <ImageBackground
      source={require("../assets/images/p1.jpg")}
      resizeMode="cover"
      style={[styles.bg, style]}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0.40)", "rgba(0,0,0,0.70)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { flex: 1 },
});

