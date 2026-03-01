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
import { useBookings, Booking, formatDate, formatPrice } from "@/context/BookingsContext";

const TABS = ["القادمة", "المكتملة", "الملغاة"];

function BookingCard({ booking }: { booking: Booking }) {
  const { cancelBooking } = useBookings();

  const statusColor = {
    upcoming: Colors.primary,
    active: Colors.warning,
    completed: Colors.textTertiary,
    cancelled: Colors.destructive,
  }[booking.status];

  const statusLabel = {
    upcoming: "قادمة",
    active: "جارية",
    completed: "مكتملة",
    cancelled: "ملغاة",
  }[booking.status];

  const handleCancel = () => {
    Alert.alert(
      "إلغاء الحجز",
      "هل تريد إلغاء هذا الحجز؟",
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "إلغاء الحجز",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            cancelBooking(booking.id);
          },
        },
      ]
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookingCard,
        pressed && { opacity: 0.9 },
      ]}
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(booking.date)}</Text>
      </View>

      <Text style={styles.venueName}>{booking.venueName}</Text>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="football-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{booking.fieldSize}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{booking.time}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{booking.players.length} لاعب</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.price}>{formatPrice(booking.price)}</Text>
        {booking.status === "upcoming" && (
          <View style={styles.actionRow}>
            <Pressable style={styles.detailsBtn} onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}>
              <Text style={styles.detailsBtnText}>تفاصيل</Text>
              <Ionicons name="chevron-back" size={14} color={Colors.primary} />
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={handleCancel}>
              <Ionicons name="close" size={15} color={Colors.destructive} />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, isLoading } = useBookings();
  const [activeTab, setActiveTab] = useState("القادمة");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const filtered = bookings.filter(b => {
    if (activeTab === "القادمة") return b.status === "upcoming" || b.status === "active";
    if (activeTab === "المكتملة") return b.status === "completed";
    if (activeTab === "الملغاة") return b.status === "cancelled";
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>حجوزاتي</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{bookings.filter(b => b.status === "upcoming").length}</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
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
            <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>لا توجد حجوزات</Text>
            <Text style={styles.emptyText}>
              {activeTab === "القادمة" ? "احجز ملعبك الآن وابدأ اللعب" : "لا يوجد سجل هنا"}
            </Text>
            {activeTab === "القادمة" && (
              <Pressable style={styles.bookNowBtn} onPress={() => router.push("/(tabs)/search")}>
                <Text style={styles.bookNowText}>ابحث عن ملعب</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filtered.map(b => <BookingCard key={b.id} booking={b} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "rgba(46,204,113,0.15)",
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
    alignItems: "center",
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
});
