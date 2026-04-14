import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useBookings, Booking, formatDate, formatPrice } from "@/context/BookingsContext";
import { useAuth } from "@/context/AuthContext";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { AppBrand } from "@/components/AppBrand";
import { NotificationsButton } from "@/components/NotificationsButton";
import { AppBackground } from "@/components/AppBackground";
import { useLang } from "@/context/LanguageContext";

const TABS = [
  { id: "active", labelKey: "bookings.tabActive" },
  { id: "upcoming", labelKey: "bookings.tabUpcoming" },
  { id: "past", labelKey: "bookings.tabPast" },
];
function BookingCard({ booking }: { booking: Booking }) {
  const { colors, isDark } = useTheme();
  const { t } = useLang();
  const { cancelBooking } = useBookings();
  const secondaryReadable = isDark ? "#D8D8E0" : colors.textSecondary;
  const tertiaryReadable = isDark ? "#B3B3BD" : colors.textTertiary;

  const statusColor = {
    upcoming: colors.primary,
    active: colors.warning,
    completed: tertiaryReadable,
    cancelled: colors.destructive,
  }[booking.status];

  const statusLabel = {
    upcoming: t("bookings.status.upcoming"),
    active: t("bookings.status.active"),
    completed: t("bookings.status.completed"),
    cancelled: t("bookings.status.cancelled"),
  }[booking.status];

  const handleCancel = () => {
    Alert.alert(
      t("bookings.cancelTitle"),
      t("bookings.cancelConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("bookings.cancelAction"),
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            cancelBooking(booking.id, booking);
          },
        },
      ]
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookingCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.9 },
      ]}
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={[styles.dateText, { color: secondaryReadable }]}>{formatDate(booking.date)}</Text>
      </View>

      <Text style={[styles.venueName, { color: colors.text }]}>{booking.venueName}</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="football-outline" size={13} color={secondaryReadable} />
          <Text style={[styles.detailText, { color: secondaryReadable }]}>{booking.fieldSize}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={13} color={secondaryReadable} />
          <Text style={[styles.detailText, { color: secondaryReadable }]}>{booking.time}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={13} color={secondaryReadable} />
          <Text style={[styles.detailText, { color: secondaryReadable }]}>{t("bookings.playersCount", { count: booking.players.length })}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={[styles.price, { color: colors.text }]}>{formatPrice(booking.price)}</Text>
        {(booking.status === "upcoming" || booking.status === "active") && (
          <View style={styles.actionRow}>
            <Pressable style={styles.detailsBtn} onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}>
              <Text style={[styles.detailsBtnText, { color: colors.primary }]}>{t("common.details")}</Text>
              <Ionicons name="chevron-back" size={14} color={colors.primary} />
            </Pressable>
            <Pressable style={[styles.cancelBtn, { backgroundColor: "rgba(255,59,48,0.12)" }]} onPress={handleCancel}>
              <Ionicons name="close" size={15} color={colors.destructive} />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { bookings, isLoading } = useBookings();
  const { t } = useLang();
  const tabTextColor = isDark ? "#D8D8E0" : colors.textSecondary;
  const { isGuest } = useAuth();
  const { promptLogin } = useGuestPrompt();
  const [activeTab, setActiveTab] = useState("upcoming");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered =
    isGuest && !GUEST_FULL_ACCESS
      ? []
      : bookings.filter((b) => {

  if (activeTab === "active")
    return b.status === "active";

  if (activeTab === "upcoming")
    return b.status === "upcoming";

  if (activeTab === "past")
    return b.status === "completed" || b.status === "cancelled";

  return true;
});

  return (
    <AppBackground>
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
     <View style={styles.header}>

  <View style={styles.headerLeft}>
    <AppBrand size={22} />
    <View style={styles.pageTitleRow}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>{t("bookings.title")}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {isGuest ? 0 : bookings.filter(b => b.status === "upcoming").length}
        </Text>
      </View>
    </View>
  </View>
<NotificationsButton />

</View>

      {isGuest && !GUEST_FULL_ACCESS && (
        <Pressable
          style={[styles.guestBanner, { backgroundColor: "rgba(255,149,0,0.08)", borderColor: "rgba(255,149,0,0.25)" }]}
          onPress={() => promptLogin()}
        >
          <Ionicons name="lock-closed-outline" size={16} color={colors.warning} />
          <Text style={[styles.guestBannerText, { color: colors.warning }]}>{t("bookings.guestBanner")}</Text>
          <Ionicons name="chevron-back" size={14} color={colors.warning} />
        </Pressable>
      )}

     <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>

  {TABS.map(tab => (

    <Pressable
      key={tab.id}
      style={[
        styles.tabBtn,
        activeTab === tab.id && styles.tabBtnActive,
        activeTab === tab.id && { backgroundColor: "rgba(15,157,88,0.16)" },
      ]}
      onPress={() => setActiveTab(tab.id)}
    >

      <Text
        style={[
          styles.tabBtnText,
          { color: tabTextColor },
          activeTab === tab.id && styles.tabBtnTextActive,
          activeTab === tab.id && { color: colors.primary },
        ]}
      >
        {t(tab.labelKey)}
      </Text>

    </Pressable>

  ))}

</View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {!isLoading && filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#FFFFFF" />
            <Text style={[styles.emptyTitle, { color: "#FFFFFF" }]}>{t("bookings.emptyTitle")}</Text>
            <Text style={[styles.emptyText, { color: "#FFFFFF" }]}>
              {activeTab === "upcoming" ? t("bookings.emptyUpcoming") : t("bookings.emptyPast")}
            </Text>
            {activeTab === "upcoming" && (
              <Pressable style={[styles.bookNowBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/search")}>
                <Text style={styles.bookNowText}>{t("bookings.searchVenue")}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map(b => <BookingCard key={b.id} booking={b} />)
        )}
      </ScrollView>
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: "Cairo_700Bold",
  },
  pageTitle: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#000",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,149,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,149,0,0.25)",
    gap: 8,
  },
  guestBannerText: {
    flex: 1,
    color: Colors.warning,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: "rgba(15,157,88,0.15)",
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
  },
  tabTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 4,
  },
  bookingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  venueName: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailsBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,59,48,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    width: "100%",
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
  },
  bookNowBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bookNowText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  tabsContainer:{
flexDirection:"row",
marginHorizontal:20,
borderWidth: 1,
borderRadius:14,
padding:4,
marginBottom:16
},

tabBtn:{
flex:1,
alignItems:"center",
paddingVertical:8,
borderRadius:10
},

tabBtnActive:{
backgroundColor:"rgba(15,157,88,0.16)"
},

tabBtnText:{
fontFamily:"Cairo_600SemiBold",
fontSize:13,
color:Colors.textSecondary
},

tabBtnTextActive:{
color:Colors.primary
},

headerLeft:{
flexDirection:"column",
alignItems:"flex-start",
gap:4
},
pageTitleRow:{
flexDirection:"row",
alignItems:"center",
gap:8
},
});
