import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/colors";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { useAuth } from "@/context/AuthContext";
import {
  fetchInAppNotifications,
  getInAppNotificationsQueryKey,
} from "@/lib/firestore-notifications";

type Props = {
  size?: number;
  /** إذا false (مثل صفحة الملف) لا تُجلب الإشعارات ولا تُعرض العلامة */
  showDot?: boolean;
};

export function NotificationsButton({ size = 24, showDot = true }: Props) {
  const { colors } = useTheme();
  const { pushIfLoggedIn, guestRestricted } = useGuestPrompt();
  const { user } = useAuth();
  const queryEnabled =
    showDot &&
    !guestRestricted &&
    !!user &&
    user.id !== "guest" &&
    user.role !== "guest";

  const queryKey = getInAppNotificationsQueryKey(user?.id, user?.playerId, user?.role);

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: () => fetchInAppNotifications(user!.id, user!.playerId ?? "", user!.role),
    enabled: queryEnabled,
    staleTime: 15_000,
  });

  const unreadCount = items.reduce((n, it) => n + (it.readOnServer ? 0 : 1), 0);
  const showUnreadDot = showDot && queryEnabled && unreadCount > 0;

  return (
    <Pressable
      style={styles.btn}
      onPress={() => pushIfLoggedIn("/notifications")}
      accessibilityRole="button"
      accessibilityLabel="الإشعارات"
    >
      <Ionicons name="notifications" size={size} color={colors.headerIcon} />
      {showUnreadDot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.destructive,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});
