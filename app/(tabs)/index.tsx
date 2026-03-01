import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useBookings, formatDate, formatPrice, MOCK_VENUES } from "@/context/BookingsContext";
import { VenueCard } from "@/components/VenueCard";
import { SkeletonVenueCard } from "@/components/SkeletonCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ADS = [
  { id: "1", title: "عرض خاص – صالة كمال الأجسام", subtitle: "خصم 30% على الاشتراك الشهري", color: "#1A1A2F", accent: "#4A90D9" },
  { id: "2", title: "مطعم الملعب", subtitle: "وجبة لاعب مجانية مع كل حجز", color: "#2F1A1A", accent: "#E74C3C" },
  { id: "3", title: "مشروب الطاقة SportX", subtitle: "احصل على علبتك مجانًا الآن", color: "#1A2F1A", accent: "#2ECC71" },
];

function LiveCounter() {
  const [count] = useState(27);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.liveCard}>
      <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.liveDotInner} />
      </Animated.View>
      <View style={styles.liveTextBlock}>
        <Text style={styles.liveNumber}>{count}</Text>
        <Text style={styles.liveLabel}>مباراة جارية الآن في الموصل</Text>
      </View>
      <Ionicons name="flame" size={22} color={Colors.warning} />
    </View>
  );
}

function RebookCard() {
  const { bookings, rebookLast } = useBookings();
  const lastCompleted = bookings.find(b => b.status === "completed");
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (!lastCompleted) return null;

  const handleRebook = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rebookLast();
    router.push("/(tabs)/bookings");
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={["#0F2A1A", "#0A1A0F"]}
        style={styles.rebookCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.rebookTop}>
          <View style={styles.rebookBadge}>
            <Ionicons name="time-outline" size={12} color={Colors.primary} />
            <Text style={styles.rebookBadgeText}>آخر حجز</Text>
          </View>
          <Text style={styles.rebookVenue}>{lastCompleted.venueName}</Text>
          <Text style={styles.rebookDetails}>
            {lastCompleted.fieldSize} · {lastCompleted.time} · {formatPrice(lastCompleted.price)}
          </Text>
        </View>
        <Pressable style={styles.rebookBtn} onPress={handleRebook}>
          <Ionicons name="refresh" size={16} color="#000" />
          <Text style={styles.rebookBtnText}>إعادة الحجز للأسبوع القادم</Text>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

function AdsBanner() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setCurrentIdx(prev => (prev + 1) % ADS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const ad = ADS[currentIdx];

  return (
    <Animated.View style={[styles.adCard, { opacity: fadeAnim, backgroundColor: ad.color }]}>
      <View style={styles.adContent}>
        <View style={[styles.adAccent, { backgroundColor: ad.accent }]} />
        <View style={styles.adText}>
          <Text style={styles.adTitle}>{ad.title}</Text>
          <Text style={styles.adSubtitle}>{ad.subtitle}</Text>
        </View>
        <Ionicons name="megaphone" size={28} color={ad.accent} style={{ opacity: 0.7 }} />
      </View>
      <View style={styles.adDots}>
        {ADS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.adDot,
              i === currentIdx && { backgroundColor: Colors.text, width: 16 },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading } = useBookings();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>أهلًا بك</Text>
            <Text style={styles.headerTitle}>اختر ملعبك</Text>
          </View>
          <Pressable style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>

        <LiveCounter />

        <RebookCard />

        <AdsBanner />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الملاعب القريبة</Text>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.seeAll}>عرض الكل</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <>
            <SkeletonVenueCard />
            <SkeletonVenueCard />
          </>
        ) : (
          MOCK_VENUES.slice(0, 3).map(venue => (
            <VenueCard key={venue.id} venue={venue} />
          ))
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  greeting: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: "Cairo_700Bold",
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.destructive,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  liveCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  liveDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.destructive,
  },
  liveTextBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  liveNumber: {
    color: Colors.destructive,
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
  },
  liveLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    flex: 1,
  },
  rebookCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.25)",
  },
  rebookTop: {
    gap: 4,
  },
  rebookBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  rebookBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
  rebookVenue: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  rebookDetails: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  rebookBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rebookBtnText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  adCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  adContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adAccent: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  adText: {
    flex: 1,
    gap: 3,
  },
  adTitle: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  adSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  adDots: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  adDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  seeAll: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
});
