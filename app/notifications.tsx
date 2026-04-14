import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { AppBrand } from "@/components/AppBrand";
import { Colors } from "@/constants/colors";
import { AppBackground } from "@/components/AppBackground";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import {
  fetchInAppNotifications,
  formatNotificationTimeAr,
  getInAppNotificationsQueryKey,
  IN_APP_NOTIFICATIONS_QUERY_KEY,
  markAllUserNotificationsRead,
  type InAppNotification,
} from "@/lib/firestore-notifications";

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { guestRestricted, promptLogin } = useGuestPrompt();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryEnabled =
    !guestRestricted && !!user && user.id !== "guest" && user.role !== "guest";

  const queryKey = useMemo(
    () => getInAppNotificationsQueryKey(user?.id, user?.playerId, user?.role),
    [user?.id, user?.playerId, user?.role],
  );

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => fetchInAppNotifications(user!.id, user!.playerId ?? "", user!.role),
    enabled: queryEnabled,
    staleTime: 20_000,
  });

  useFocusEffect(
    useCallback(() => {
      if (guestRestricted) {
        promptLogin();
        router.replace("/(tabs)");
        return;
      }
      if (!queryEnabled || !user) return;

      let cancelled = false;
      (async () => {
        try {
          let list = queryClient.getQueryData<InAppNotification[]>(queryKey);
          if (!list || list.length === 0) {
            list = await fetchInAppNotifications(user.id, user.playerId ?? "", user.role);
          }
          if (cancelled) return;
          const unread = list.filter((n) => !n.readOnServer).map((n) => n.id);
          if (unread.length === 0) return;
          await markAllUserNotificationsRead(unread);
          await queryClient.invalidateQueries({ queryKey: [IN_APP_NOTIFICATIONS_QUERY_KEY] });
        } catch (e) {
          console.warn("[notifications] mark read on screen open:", e);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [guestRestricted, promptLogin, queryEnabled, user, queryClient, queryKey]),
  );

  const unreadCount = useMemo(() => items.reduce((n, it) => n + (it.readOnServer ? 0 : 1), 0), [items]);

  if (guestRestricted) {
    return null;
  }

  const showLoading = queryEnabled && isLoading && items.length === 0;

  const isIconName = (name: string): name is keyof typeof Ionicons.glyphMap =>
    name in Ionicons.glyphMap;

  return (
    <AppBackground>
      <View style={[styles.container, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <AppBrand size={24} />
            <View style={styles.headerRow}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>الإشعارات</Text>
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {showLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>جاري تحميل الإشعارات…</Text>
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>تعذّر التحميل</Text>
            <Pressable
              style={[
                styles.retryBtn,
                { borderColor: isDark ? "#4A4A54" : colors.border, backgroundColor: isDark ? "#25252C" : colors.card },
              ]}
              onPress={() => refetch()}
            >
              <Text style={[styles.retryText, { color: Colors.primary }]}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={() => refetch()}
                tintColor={Colors.primary}
              />
            }
          >
            {items.map((it) => {
              const isUnread = !it.readOnServer;
              const iconName = isIconName(it.icon) ? it.icon : "notifications-outline";
              return (
                <NotificationRow
                  key={it.id}
                  item={it}
                  iconName={iconName}
                  isUnread={isUnread}
                  colors={colors}
                  isDark={isDark}
                  timeLabel={formatNotificationTimeAr(it.createdAt)}
                />
              );
            })}

            {items.length === 0 && !isLoading && (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد إشعارات</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  ستصلك هنا التنبيهات المتعلقة بحسابك.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </AppBackground>
  );
}

function NotificationRow({
  item,
  iconName,
  isUnread,
  colors,
  isDark,
  timeLabel,
}: {
  item: InAppNotification;
  iconName: keyof typeof Ionicons.glyphMap;
  isUnread: boolean;
  colors: {
    card: string;
    border: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    surface: string;
  };
  isDark: boolean;
  timeLabel: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.imageUrl && !imgFailed;

  const cardBg = isUnread
    ? isDark
      ? "rgba(15,157,88,0.16)"
      : "rgba(15,157,88,0.10)"
    : isDark
      ? "#1A1A22"
      : colors.card;

  const borderCol = isUnread ? Colors.primary : isDark ? "#3D3D48" : colors.border;
  const titleColor = isUnread ? colors.text : isDark ? "#E4E4EA" : colors.text;
  const bodyColor = isDark ? "#C8C8D4" : "#3C3C43";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: borderCol,
          borderWidth: isUnread ? 1.5 : 1,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: item.imageUrl! }}
          style={styles.bannerImage}
          contentFit="cover"
          transition={180}
          onError={() => setImgFailed(true)}
        />
      ) : null}

      <View style={styles.cardInner}>
        {showImage ? null : (
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isDark ? "#2A2A34" : colors.surface,
                borderWidth: isUnread ? 0 : 1,
                borderColor: isDark ? "#3D3D48" : colors.border,
              },
            ]}
          >
            <Ionicons name={iconName} size={22} color={isUnread ? Colors.primary : colors.textSecondary} />
          </View>
        )}

        <View style={[styles.textBlock, showImage && styles.textBlockFull]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
              {item.title}
            </Text>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={[styles.body, { color: bodyColor }]} numberOfLines={4}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitles: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  pageTitle: { fontSize: 16, fontFamily: "Cairo_700Bold" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#000", fontSize: 12, fontFamily: "Cairo_700Bold" },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  card: { borderRadius: 16, overflow: "hidden" },
  bannerImage: { width: "100%", height: 140, backgroundColor: "#2A2A32" },
  cardInner: { flexDirection: "row", gap: 12, padding: 14 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 6, minWidth: 0 },
  textBlockFull: { paddingTop: 0 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontFamily: "Cairo_700Bold", flex: 1, lineHeight: 22 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  body: { fontSize: 14, fontFamily: "Cairo_400Regular", lineHeight: 22 },
  time: { fontSize: 12, fontFamily: "Cairo_600SemiBold", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Cairo_700Bold" },
  emptyText: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  hint: { fontSize: 14, fontFamily: "Cairo_400Regular" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryText: { fontFamily: "Cairo_600SemiBold", fontSize: 14 },
});
