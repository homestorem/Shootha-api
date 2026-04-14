import React from "react";
import { Text, View, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  size?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function AppBrand({ size = 28, style, textStyle }: Props) {
  const { isDark } = useTheme();
  const lineHeight = Math.round(size * 1.25);

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.text, { fontSize: size, lineHeight }, textStyle]}>
        <Text style={[styles.shoot, { fontSize: size, lineHeight }]}>SHOOT</Text>
        <Text style={[styles.ha, { fontSize: size, lineHeight, color: isDark ? "#fff" : "#000" }]}>
          {"'HA"}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontFamily: "Cairo_700Bold" },
  shoot: { color: Colors.primary, fontFamily: "Cairo_700Bold", letterSpacing: 0.2 },
  ha: { fontFamily: "Cairo_700Bold" },
});

