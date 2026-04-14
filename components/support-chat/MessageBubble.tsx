import React, { useMemo } from "react";
import { View, Text, StyleSheet, I18nManager } from "react-native";
import type { ColorSet } from "@/constants/colors";
import type { SupportMessage } from "@/lib/firestore-support-chat";

type Props = {
  message: SupportMessage;
  isUser: boolean;
  colors: ColorSet;
  isDark: boolean;
};

function formatTime(d: Date | null): string {
  if (!d) return "";
  try {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageBubble({ message, isUser, colors, isDark }: Props) {
  const timeLabel = useMemo(() => formatTime(message.createdAt), [message.createdAt]);

  const bubbleBg = isUser
    ? colors.primary
    : isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.06)";
  const textColor = isUser ? "#FFFFFF" : colors.text;
  const metaColor = isUser ? "rgba(255,255,255,0.85)" : colors.textTertiary;

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.alignEnd : styles.alignStart,
      ]}
    >
      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleBg },
          isUser ? styles.bubbleUser : styles.bubbleOther,
        ]}
      >
        <Text style={[styles.text, { color: textColor }]}>{message.text}</Text>
        <Text style={[styles.time, { color: metaColor }]}>{timeLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  alignStart: {
    alignItems: "flex-start",
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: I18nManager.isRTL ? 18 : 4,
    borderBottomLeftRadius: I18nManager.isRTL ? 4 : 18,
  },
  bubbleOther: {
    borderBottomLeftRadius: I18nManager.isRTL ? 18 : 4,
    borderBottomRightRadius: I18nManager.isRTL ? 4 : 18,
  },
  text: {
    fontSize: 15,
    fontFamily: "Cairo_400Regular",
    lineHeight: 22,
  },
  time: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    marginTop: 4,
    alignSelf: "flex-end",
  },
});
