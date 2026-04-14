import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import {
  detectMisspelledWords,
  sanitizeInput,
  suggestWord,
  validatePersonName,
  validatePhoneByCountry,
} from "@/lib/input-intelligence";

interface AuthInputProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  isPassword?: boolean;
  /** شاشات تسجيل الدخول/التسجيل فوق صورة — تباين أعلى للعناوين والنصوص */
  authEmphasis?: boolean;
  smartMode?: "none" | "name" | "phone" | "generic";
  countryCode?: string;
}

export function AuthInput({
  label,
  icon,
  error,
  isPassword,
  authEmphasis,
  smartMode = "none",
  countryCode = "IQ",
  ...rest
}: AuthInputProps) {
  const { colors } = useTheme();
  const { language, textAlign, writingDirection, t } = useLang();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smartError, setSmartError] = useState<string | undefined>(undefined);
  const [spellIssues, setSpellIssues] = useState<string[]>([]);
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    if (rest.onFocus) rest.onFocus({} as any);
  };
  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    if (rest.onBlur) rest.onBlur({} as any);
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? Colors.destructive : colors.border,
      error ? Colors.destructive : Colors.primary,
    ],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  /** شاشات المصادقة فوق صورة: عناوين بيضاء وتباين عالٍ */
  const labelColor = authEmphasis ? "#FFFFFF" : colors.textSecondary;
  const placeholderColor = authEmphasis ? colors.textSecondary : colors.textTertiary;
  const authIconColor = authEmphasis
    ? isFocused
      ? Colors.primary
      : "#FFFFFF"
    : isFocused
      ? Colors.primary
      : colors.textSecondary;

  const handleSmartChange = (value: string) => {
    const safe = sanitizeInput(value, /[\p{L}\d\s@.+_'-]/u);
    if (smartMode === "name") {
      setSmartError(validatePersonName(safe) || safe.length === 0 ? undefined : t("invalidName"));
    } else if (smartMode === "phone") {
      setSmartError(
        validatePhoneByCountry(safe, countryCode) || safe.length === 0 ? undefined : t("invalidPhone"),
      );
    } else {
      setSmartError(undefined);
    }

    if (smartMode === "generic" || smartMode === "name") {
      setSpellIssues(detectMisspelledWords(safe, language));
    } else {
      setSpellIssues([]);
    }
    rest.onChangeText?.(safe);
  };

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          authEmphasis && styles.labelAuth,
          authEmphasis && styles.labelAuthOnImage,
          { color: labelColor },
        ]}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: colors.card,
            shadowColor: error ? Colors.destructive : Colors.primary,
            shadowOpacity,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: isFocused ? 4 : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={authIconColor} />
        <TextInput
          {...rest}
          style={[
            styles.input,
            {
              color: colors.text,
              textAlign,
              writingDirection,
              textDecorationLine: spellIssues.length ? "underline" : "none",
              textDecorationColor: spellIssues.length ? Colors.destructive : "transparent",
            },
          ]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isPassword && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleSmartChange}
          autoCorrect={language === "en"}
          spellCheck={language === "en"}
        />
        {isPassword && (
          <Pressable onPress={() => setShowPassword((v) => !v)}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={
                authEmphasis
                  ? isFocused
                    ? Colors.primary
                    : "#FFFFFF"
                  : colors.textSecondary
              }
            />
          </Pressable>
        )}
      </Animated.View>
      {error || smartError ? <Text style={styles.errorText}>{error ?? smartError}</Text> : null}
      {spellIssues.length > 0 ? (
        <Text style={[styles.spellHint, { color: colors.textSecondary }]}>
          {t("spellIssues")}: {spellIssues.join(", ")}. {t("spellSuggestions")}:{" "}
          {suggestWord(spellIssues[0], language).join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Cairo_600SemiBold" },
  labelAuth: { fontSize: 14 },
  labelAuthOnImage: {
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    textAlign: "right",
  },
  errorText: {
    color: Colors.destructive,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  spellHint: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
});
