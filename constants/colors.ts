/**
 * تباين محسّن (قريب من WCAG AA) + تسلسل هرمي واضح للنصوص.
 * الوضع الداكن: نص أساسي تقريباً أبيض، ثانوي فاتح، ثالثي رمادي مقروء على الخلفية.
 */
export const DARK_COLORS = {
  primary: "#0f9d58",
  background: "#0C0C0E",
  surface: "#16161A",
  card: "#1C1C22",
  border: "#3A3A42",
  /** أيقونات الهيدر — تباين عالٍ */
  headerIcon: "#F5F5F7",
  text: "#F5F5F7",
  /** عناوين فرعية، أسطر ثانوية */
  textSecondary: "#FFFFFF",
  /** تلميحات، وسوم، أيقونات تبويب غير نشطة */
  textTertiary: "#9E9EA8",
  destructive: "#FF453A",
  warning: "#FF9F0A",
  blue: "#0A84FF",
  disabled: "#5C5C64",
  tabBar: "#100F14",
  inputBg: "#1E1E26",
  shimmer1: "#1C1C22",
  shimmer2: "#2A2A32",
};

export const LIGHT_COLORS = {
  primary: "#0f9d58",
  background: "#F2F2F7",
  surface: "#E5E5EA",
  card: "#FFFFFF",
  border: "#C6C6CC",
  headerIcon: "#1C1C1E",
  text: "#1C1C1E",
  textSecondary: "#111111",
  textTertiary: "#636366",
  destructive: "#FF3B30",
  warning: "#FF9500",
  blue: "#007AFF",
  disabled: "#AEAEB2",
  tabBar: "#FFFFFF",
  inputBg: "#FFFFFF",
  shimmer1: "#E5E5EA",
  shimmer2: "#D1D1D6",
};

export type ColorSet = typeof DARK_COLORS;

export function getColors(isDark: boolean): ColorSet {
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}

/** قيم افتراضية للوضع الداكن (شاشات لا تستخدم ThemeContext) */
export const Colors = DARK_COLORS;

export default {
  light: {
    text: LIGHT_COLORS.text,
    background: LIGHT_COLORS.background,
    tint: LIGHT_COLORS.primary,
    tabIconDefault: LIGHT_COLORS.textTertiary,
    tabIconSelected: LIGHT_COLORS.primary,
  },
};
