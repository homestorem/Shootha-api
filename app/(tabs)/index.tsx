import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useBookings, formatPrice, MOCK_VENUES } from "@/context/BookingsContext";
import { VenueCard } from "@/components/VenueCard";
import { SkeletonVenueCard } from "@/components/SkeletonCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_HEIGHT = 190;

const ADS = [
  {
    id: "1",
    title: "عرض خاص – صالة كمال الأجسام",
    subtitle: "خصم 30% على الاشتراك الشهري",
    icon: "barbell-outline" as const,
    color: "#0D0D1F",
    accent: "#4A90D9",
    gradient: ["#0D0D1F", "#1A1A3E"] as [string, string],
  },
  {
    id: "2",
    title: "مطعم الملعب",
    subtitle: "وجبة لاعب مجانية مع كل حجز",
    icon: "restaurant-outline" as const,
    color: "#1F0D0D",
    accent: "#E74C3C",
    gradient: ["#1F0D0D", "#3E1A1A"] as [string, string],
  },
  {
    id: "3",
    title: "مشروب الطاقة SportX",
    subtitle: "احصل على علبتك مجانًا الآن",
    icon: "flash-outline" as const,
    color: "#0D1F0D",
    accent: Colors.primary,
    gradient: ["#0D1F0D", "#1A3E1A"] as [string, string],
  },
];

function AdSlide({ item, width }: { item: typeof ADS[0]; width: number }) {
  const isGreen = item.accent === Colors.primary;
  return (
    <View
      style={[
        adSlideStyles.container,
        { width, backgroundColor: item.color },
        isGreen && adSlideStyles.glowBorder,
      ]}
    >
      <LinearGradient
        colors={item.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={adSlideStyles.content}>
        <View style={[adSlideStyles.iconRing, { borderColor: item.accent + "40" }]}>
          <Ionicons name={item.icon} size={30} color={item.accent} />
        </View>
        <View style={adSlideStyles.textBlock}>
          <Text style={adSlideStyles.title}>{item.title}</Text>
          <Text style={adSlideStyles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <View style={[adSlideStyles.accentLine, { backgroundColor: item.accent }]} />
    </View>
  );
}

const adSlideStyles = StyleSheet.create({
  container: {
    height: BANNER_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  glowBorder: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  accentLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
});

function AdsBanner() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const bannerWidth = SCREEN_WIDTH - 40;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIdx(prev => {
        const next = (prev + 1) % ADS.length;
        flatRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.adWrapper}>
      <FlatList
        ref={flatRef}
        data={ADS}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <AdSlide item={item} width={bannerWidth} />}
        keyExtractor={item => item.id}
        getItemLayout={(_, index) => ({ length: bannerWidth, offset: bannerWidth * index, index })}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
          setCurrentIdx(idx);
        }}
        snapToInterval={bannerWidth}
        decelerationRate="fast"
        contentContainerStyle={{ gap: 0 }}
      />
      <View style={styles.adDots}>
        {ADS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.adDot,
              i === currentIdx && styles.adDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function LiveCounter() {
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
        <Text style={styles.liveNumber}>27</Text>
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
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.rebookWrapper]}>
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

        <AdsBanner />

        <LiveCounter />

        <RebookCard />

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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 0 },
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
  adWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  adDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  adDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
  },
  adDotActive: {
    backgroundColor: Colors.primary,
    width: 18,
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
  rebookWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  rebookCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.25)",
  },
  rebookTop: { gap: 4 },
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
