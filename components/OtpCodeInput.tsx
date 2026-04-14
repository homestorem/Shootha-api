import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  type TextInput as TextInputType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SMS_OTP_LENGTH } from "@/lib/otpConstants";

type Props = {
  value: string;
  onChange: (digits: string) => void;
  /** يُستدعى عند اكتمال الرمز */
  onFilled?: (code: string) => void;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * حقل رمز شفاف فوق خلايا عرض — ملء تلقائي من SMS (iOS oneTimeCode / Android sms-otp) ولصق كامل.
 */
export function OtpCodeInput({ value, onChange, onFilled, disabled, containerStyle }: Props) {
  const inputRef = useRef<TextInputType>(null);
  const lastNotified = useRef<string>("");

  const applyDigits = useCallback(
    (raw: string) => {
      const d = raw.replace(/\D/g, "").slice(0, SMS_OTP_LENGTH);
      onChange(d);
      return d;
    },
    [onChange],
  );

  useEffect(() => {
    if (value.length < SMS_OTP_LENGTH) {
      lastNotified.current = "";
    }
  }, [value]);

  useEffect(() => {
    if (!onFilled || value.length !== SMS_OTP_LENGTH) return;
    if (lastNotified.current === value) return;
    lastNotified.current = value;
    const id = requestAnimationFrame(() => onFilled(value));
    return () => cancelAnimationFrame(id);
  }, [value, onFilled]);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <View style={styles.boxRow} pointerEvents="none">
        {Array.from({ length: SMS_OTP_LENGTH }, (_, i) => (
          <View key={i} style={[styles.cell, value.length > i && styles.cellFilled]}>
            <Text style={styles.cellText}>{value[i] ?? ""}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.overlayInput}
        value={value}
        editable={!disabled}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={SMS_OTP_LENGTH}
        textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
        autoComplete={Platform.OS === "android" ? "sms-otp" : Platform.OS === "web" ? "one-time-code" : "off"}
        importantForAutofill="yes"
        autoFocus
        caretHidden
        onChangeText={(t) => {
          const d = applyDigits(t);
          if (d.length === SMS_OTP_LENGTH) {
            inputRef.current?.blur();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
    minHeight: 68,
    width: "100%",
    maxWidth: 320,
  },
  boxRow: {
    flexDirection: "row",
    gap: 10,
  },
  cell: {
    width: 52,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: {
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  cellText: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
  },
  overlayInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    color: "transparent",
    fontSize: 16,
  },
});
