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
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import {
  MOCK_VENUES,
  TIME_SLOTS,
  useBookings,
  formatPrice,
  Booking,
} from "@/context/BookingsContext";

const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

function generateDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayName = DAYS[d.getDay()];
    const dayNum = d.getDate();
    dates.push({
      label: `${dayName}\n${dayNum}`,
      value: d.toISOString().split("T")[0],
    });
  }
  return dates;
}

const BOOKED_SLOTS: Record<string, string[]> = {
  [new Date().toISOString().split("T")[0]]: ["18:00", "19:00", "20:00"],
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { addBooking } = useBookings();

  const venue = MOCK_VENUES.find(v => v.id === id);
  const dates = generateDates();

  const [selectedDate, setSelectedDate] = useState(dates[0].value);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>(venue?.fieldSizes[0] ?? "");
  const [isBooking, setIsBooking] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!venue) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Text style={{ color: Colors.text, textAlign: "center", marginTop: 40 }}>
          الملعب غير موجود
        </Text>
      </View>
    );
  }

  const bookedForSelectedDate = BOOKED_SLOTS[selectedDate] ?? [];

  const handleBooking = async () => {
    if (!selectedTime) {
      Alert.alert("اختر وقتًا", "الرجاء اختيار وقت للحجز");
      return;
    }
    setIsBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await new Promise(res => setTimeout(res, 600));

    const newBooking: Booking = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      venueId: venue.id,
      venueName: venue.name,
      fieldSize: selectedSize,
      date: selectedDate,
      time: selectedTime,
      duration: 1,
      price: venue.pricePerHour,
      status: "upcoming",
      players: [{ id: "p_me", name: "أنا", paid: true }],
      createdAt: new Date().toISOString(),
    };

    addBooking(newBooking);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsBooking(false);

    Alert.alert(
      "تم الحجز!",
      `تم حجز ${venue.name} بنجاح في ${selectedTime}`,
      [
        {
          text: "عرض الحجز",
          onPress: () => {
            router.back();
            router.push("/(tabs)/bookings");
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={[styles.imageArea, { backgroundColor: venue.imageColor }]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.6)", "transparent", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.imageCenter}>
          <Ionicons name="football" size={52} color="rgba(46,204,113,0.4)" />
        </View>
        <View style={styles.imageBottom}>
          <View style={styles.nameRow}>
            <Text style={styles.venueName}>{venue.name}</Text>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{venue.rating}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color={Colors.textSecondary} />
            <Text style={styles.locationText}>{venue.location}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأوقات والأيام</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesRow}
          >
            {dates.map(d => (
              <Pressable
                key={d.value}
                style={[styles.dateChip, selectedDate === d.value && styles.dateChipActive]}
                onPress={() => { setSelectedDate(d.value); setSelectedTime(null); }}
              >
                <Text style={[styles.dateChipText, selectedDate === d.value && styles.dateChipTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر الوقت</Text>
          <View style={styles.slotsGrid}>
            {TIME_SLOTS.map(slot => {
              const booked = bookedForSelectedDate.includes(slot);
              const selected = selectedTime === slot;
              return (
                <Pressable
                  key={slot}
                  style={[
                    styles.slot,
                    selected && styles.slotSelected,
                    booked && styles.slotBooked,
                  ]}
                  onPress={() => !booked && setSelectedTime(slot)}
                  disabled={booked}
                >
                  <Text style={[
                    styles.slotText,
                    selected && styles.slotTextSelected,
                    booked && styles.slotTextBooked,
                  ]}>
                    {slot}
                  </Text>
                  {booked && (
                    <Text style={styles.bookedLabel}>محجوز</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>حجم الملعب</Text>
          <View style={styles.sizesRow}>
            {venue.fieldSizes.map(size => (
              <Pressable
                key={size}
                style={[styles.sizeChip, selectedSize === size && styles.sizeChipActive]}
                onPress={() => setSelectedSize(size)}
              >
                <Text style={[styles.sizeText, selectedSize === size && styles.sizeTextActive]}>
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المرافق</Text>
          <View style={styles.amenitiesRow}>
            {venue.amenities.map(a => (
              <View key={a} style={styles.amenityChip}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>التقييمات</Text>
          <View style={styles.reviewsCard}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>النظافة</Text>
              <View style={styles.reviewBar}>
                <View style={[styles.reviewFill, { width: "90%" }]} />
              </View>
              <Text style={styles.reviewScore}>4.5</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>جودة العشب</Text>
              <View style={styles.reviewBar}>
                <View style={[styles.reviewFill, { width: "85%" }]} />
              </View>
              <Text style={styles.reviewScore}>4.2</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>الإضاءة</Text>
              <View style={styles.reviewBar}>
                <View style={[styles.reviewFill, { width: "95%" }]} />
              </View>
              <Text style={styles.reviewScore}>4.7</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bookingBar, { paddingBottom: bottomPadding + 12 }]}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>السعر/ساعة</Text>
          <Text style={styles.price}>{formatPrice(venue.pricePerHour)}</Text>
        </View>
        <Pressable
          style={[
            styles.bookBtn,
            (!selectedTime || isBooking) && styles.bookBtnDisabled,
          ]}
          onPress={handleBooking}
          disabled={!selectedTime || isBooking}
        >
          <Ionicons name={isBooking ? "hourglass" : "checkmark-circle"} size={20} color="#000" />
          <Text style={styles.bookBtnText}>
            {isBooking ? "جاري الحجز..." : "احجز الآن"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageArea: {
    height: 220,
    justifyContent: "space-between",
    padding: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  imageCenter: {
    alignSelf: "center",
    marginTop: -10,
  },
  imageBottom: {
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  venueName: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    flex: 1,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingText: {
    color: Colors.text,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingTop: 16,
  },
  section: {
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  datesRow: {
    gap: 8,
  },
  dateChip: {
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  dateChipActive: {
    backgroundColor: "rgba(46,204,113,0.15)",
    borderColor: Colors.primary,
  },
  dateChipText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  dateChipTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slot: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  slotSelected: {
    backgroundColor: "rgba(46,204,113,0.2)",
    borderColor: Colors.primary,
  },
  slotBooked: {
    backgroundColor: "rgba(255,59,48,0.06)",
    borderColor: "rgba(255,59,48,0.2)",
    opacity: 0.6,
  },
  slotText: {
    color: Colors.text,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
  },
  slotTextSelected: {
    color: Colors.primary,
  },
  slotTextBooked: {
    color: Colors.destructive,
  },
  bookedLabel: {
    color: Colors.destructive,
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
  },
  sizesRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  sizeChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sizeChipActive: {
    backgroundColor: "rgba(46,204,113,0.15)",
    borderColor: Colors.primary,
  },
  sizeText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
  },
  sizeTextActive: {
    color: Colors.primary,
  },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amenityText: {
    color: Colors.text,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
  },
  reviewsCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewLabel: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    width: 80,
    textAlign: "right",
  },
  reviewBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  reviewFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  reviewScore: {
    color: Colors.text,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    width: 28,
    textAlign: "center",
  },
  bookingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
  },
  priceBlock: {
    gap: 2,
  },
  priceLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  price: {
    color: Colors.primary,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  bookBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  bookBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
});
