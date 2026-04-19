import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useBookings, formatDate, formatPrice, Player, type Booking } from "@/context/BookingsContext";
import { useAuth } from "@/context/AuthContext";
import { useGuestPrompt } from "@/context/GuestPromptContext";

function PlayerRow({ player, onToggle }: { player: Player; onToggle: () => void }) {
  return (
    <Pressable
      style={[styles.playerRow, player.paid && styles.playerRowPaid]}
      onPress={onToggle}
    >
      <View style={styles.playerLeft}>
        <View style={[styles.avatarMini, { backgroundColor: player.paid ? "rgba(15,157,88,0.15)" : Colors.surface }]}>
          <Text style={[styles.avatarMiniText, { color: player.paid ? Colors.primary : Colors.textSecondary }]}>
            {player.name.charAt(0)}
          </Text>
        </View>
        <Text style={styles.playerName}>{player.name}</Text>
      </View>
      <View style={[styles.payStatus, player.paid ? styles.payStatusPaid : styles.payStatusUnpaid]}>
        <Ionicons
          name={player.paid ? "checkmark-circle" : "ellipse-outline"}
          size={16}
          color={player.paid ? Colors.primary : Colors.textTertiary}
        />
        <Text style={[styles.payStatusText, { color: player.paid ? Colors.primary : Colors.textTertiary }]}>
          {player.paid ? "دفع" : "لم يدفع"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { bookings, updateBooking, cancelBooking } = useBookings();
  const { isGuest } = useAuth();
  const { promptLogin } = useGuestPrompt();

  const booking = bookings.find(b => b.id === id);

  const [newPlayerName, setNewPlayerName] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!booking) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
        <Text style={{ color: Colors.text, textAlign: "center", marginTop: 40, fontFamily: "Cairo_400Regular" }}>
          الحجز غير موجود
        </Text>
      </View>
    );
  }

  const paidCount = booking.players.filter(p => p.paid).length;
  const perPlayer = booking.players.length > 0
    ? Math.round(booking.price / booking.players.length)
    : booking.price;

  const handleTogglePlayer = (playerId: string) => {
    if (isGuest) {
      promptLogin();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = booking.players.map(p =>
      p.id === playerId ? { ...p, paid: !p.paid } : p
    );
    updateBooking(booking.id, { players: updated });
  };

  const handleAddPlayer = () => {
    if (isGuest) {
      promptLogin();
      return;
    }
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: newPlayerName.trim(),
      paid: false,
    };
    updateBooking(booking.id, { players: [...booking.players, newPlayer] });
    setNewPlayerName("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCancel = () => {
    if (isGuest) {
      promptLogin();
      return;
    }
    Alert.alert(
      "إلغاء الحجز",
      "هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "إلغاء الحجز",
          style: "destructive",
          onPress: () => {
            cancelBooking(booking.id, booking);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  };

  const statusColor = {
    upcoming: Colors.primary,
    active: Colors.warning,
    completed: Colors.textTertiary,
    cancelled: Colors.destructive,
  }[booking.status];

  const statusLabel = {
    upcoming: "حجز قادم",
    active: "مباراة جارية",
    completed: "مكتملة",
    cancelled: "ملغاة",
  }[booking.status];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>تفاصيل الحجز</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {booking.randomMatchId ? (
          <Pressable
            style={styles.rmBanner}
            onPress={() => {
              if (isGuest) {
                promptLogin();
                return;
              }
              router.push({
                pathname: "/random-match/[id]",
                params: { id: booking.randomMatchId as string },
              });
            }}
          >
            <Ionicons name="people" size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rmBannerTitle}>مباراة عشوائية</Text>
              <Text style={styles.rmBannerSub}>عرض اللاعبين والانضمام باسمك من حسابك</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </Pressable>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.statusBadge, { borderColor: statusColor + "40", backgroundColor: statusColor + "15" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={styles.bookingId}>#{booking.id.slice(-6).toUpperCase()}</Text>
          </View>

          <Text style={styles.venueName}>{booking.venueName}</Text>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <View>
                <Text style={styles.detailLabel}>التاريخ</Text>
                <Text style={styles.detailValue}>{formatDate(booking.date)}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <View>
                <Text style={styles.detailLabel}>الوقت</Text>
                <Text style={styles.detailValue}>{booking.time}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="football-outline" size={16} color={Colors.textSecondary} />
              <View>
                <Text style={styles.detailLabel}>نوع الملعب</Text>
                <Text style={styles.detailValue}>{booking.fieldSize}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
              <View>
                <Text style={styles.detailLabel}>الإجمالي</Text>
                <Text style={[styles.detailValue, { color: Colors.primary }]}>{formatPrice(booking.price)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>تقسيم الفاتورة</Text>
            <View style={styles.sectionBadge}>
              <Ionicons name="shield" size={12} color={Colors.primary} />
              <Text style={styles.sectionBadgeText}>أداة الكابتن</Text>
            </View>
          </View>

          <View style={styles.splitSummary}>
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>إجمالي اللاعبين</Text>
              <Text style={styles.splitValue}>{booking.players.length}</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>على كل لاعب</Text>
              <Text style={[styles.splitValue, { color: Colors.primary }]}>{formatPrice(perPlayer)}</Text>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitItem}>
              <Text style={styles.splitLabel}>دفعوا</Text>
              <Text style={styles.splitValue}>{paidCount}/{booking.players.length}</Text>
            </View>
          </View>

          <View style={styles.playersList}>
            {booking.players.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                onToggle={() => handleTogglePlayer(player.id)}
              />
            ))}
          </View>

          {booking.status === "upcoming" && (
            <View style={styles.addPlayerRow}>
              <TextInput
                style={styles.playerInput}
                placeholder="أضف لاعب..."
                placeholderTextColor={Colors.textTertiary}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                onSubmitEditing={handleAddPlayer}
              />
              <Pressable
                style={[styles.addPlayerBtn, !newPlayerName.trim() && { opacity: 0.4 }]}
                onPress={handleAddPlayer}
                disabled={!newPlayerName.trim()}
              >
                <Ionicons name="person-add" size={18} color="#000" />
              </Pressable>
            </View>
          )}
        </View>

        {(booking.status === "upcoming" || booking.status === "active") && (
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Ionicons name="close-circle-outline" size={18} color={Colors.destructive} />
            <Text style={styles.cancelBtnText}>إلغاء الحجز</Text>
          </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 4,
  },
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  bookingId: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  venueName: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "45%",
  },
  detailLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  detailValue: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15,157,88,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.25)",
  },
  sectionBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
  splitSummary: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  splitItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  splitLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
  },
  splitValue: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  splitDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  playersList: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playerRowPaid: {
    backgroundColor: "rgba(15,157,88,0.04)",
  },
  playerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMiniText: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  playerName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  payStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  payStatusPaid: {
    backgroundColor: "rgba(15,157,88,0.1)",
    borderColor: "rgba(15,157,88,0.3)",
  },
  payStatusUnpaid: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  payStatusText: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  addPlayerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  playerInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    color: Colors.text,
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: "right",
  },
  addPlayerBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
    backgroundColor: "rgba(255,59,48,0.07)",
    marginTop: 8,
  },
  cancelBtnText: {
    color: Colors.destructive,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  rmBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.35)",
    backgroundColor: "rgba(15,157,88,0.08)",
    marginBottom: 4,
  },
  rmBannerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  rmBannerSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
});
