export const DARK_COLORS = {
  primary: "#2ECC71",
  background: "#121212",
  surface: "#1A1A1A",
  card: "#1E1E1E",
  border: "#2A2A2A",
  text: "#FFFFFF",
  textSecondary: "#8E8E93",
  textTertiary: "#555555",
  destructive: "#FF3B30",
  warning: "#FF9500",
  blue: "#007AFF",
  disabled: "#3A3A3A",
  tabBar: "#111111",
  inputBg: "#1E1E1E",
  shimmer1: "#1E1E1E",
  shimmer2: "#2A2A2A",
};

export const LIGHT_COLORS = {
  primary: "#2ECC71",
  background: "#F5F5F5",
  surface: "#EEEEEE",
  card: "#FFFFFF",
  border: "#E0E0E0",
  text: "#1A1A1A",
  textSecondary: "#666666",
  textTertiary: "#999999",
  destructive: "#FF3B30",
  warning: "#FF9500",
  blue: "#007AFF",
  disabled: "#CCCCCC",
  tabBar: "#FFFFFF",
  inputBg: "#FFFFFF",
  shimmer1: "#E8E8E8",
  shimmer2: "#D0D0D0",
};

export type ColorSet = typeof DARK_COLORS;

export function getColors(isDark: boolean): ColorSet {
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

export const Colors = DARK_COLORS;

export default {
  light: {
    text: DARK_COLORS.text,
    background: DARK_COLORS.background,
    tint: DARK_COLORS.primary,
    tabIconDefault: DARK_COLORS.textTertiary,
    tabIconSelected: DARK_COLORS.primary,
  },
};
