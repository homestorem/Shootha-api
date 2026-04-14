import React from "react";
import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatPrice, type Venue } from "@/context/BookingsContext";
import { getHourlyRate } from "@/lib/venue-pricing";
import { prefetchVenueDetailQuery } from "@/lib/app-data";
import { VenueAmenitiesRow } from "@/components/VenueAmenitiesRow";

interface VenueListCardProps {
  venue: Venue & { distanceKm?: number };
  /** يُدمَج مع `id` عند فتح صفحة الملعب (مثلاً تقييد الدفع) */
  venueParams?: Record<string, string>;
}

function StarRating({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  const safe = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  const full = Math.floor(safe);
  const empty = Math.max(0, 5 - full);
  return (
    <View style={styles.ratingRow}>
      <View style={styles.starRow}>
        {Array.from({ length: full }).map((_, i) => (
          <Ionicons key={`f-${i}`} name="star" size={14} color="#FFD700" />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <Ionicons key={`e-${i}`} name="star-outline" size={14} color="#CCCCCC" />
        ))}
      </View>
      <Text style={styles.ratingMeta}>
        {safe.toFixed(1)} ({Number(venueSafeCount(reviewCount)).toLocaleString("en-US")})
      </Text>
    </View>
  );
}

function venueSafeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function VenueListCard({ venue, venueParams }: VenueListCardProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const sizeLabel = Array.isArray(venue.fieldSizes) && venue.fieldSizes.length > 0 ? venue.fieldSizes[0] : "5x5";
  const hourly = getHourlyRate(venue);
  const distanceRaw = venue.distanceKm;
  const distanceKm =
    distanceRaw != null && distanceRaw <= 400
      ? `${distanceRaw.toFixed(2)} كم`
      : distanceRaw != null && distanceRaw > 400
        ? "—"
        : "—";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.9 },
      ]}
      onPressIn={() => prefetchVenueDetailQuery(queryClient, venue.id)}
      onPress={() =>
        router.push({
          pathname: "/venue/[id]",
          params: { id: venue.id, ...venueParams },
        })
      }
    >
      <View style={styles.leftBlock}>
        <View style={styles.sizePill}>
          <Text style={styles.sizeText}>{sizeLabel}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {venue.name || "ملعب"}
        </Text>
        <StarRating rating={Number(venue.rating ?? 0)} reviewCount={Number(venue.reviewCount ?? 0)} />
        <Text style={[styles.priceLine, { color: colors.primary }]}>
          {hourly > 0 ? `${formatPrice(hourly)} / hr` : "See details for pricing"}
        </Text>
        <View style={styles.locationRow}>
          <Text style={[styles.distance, { color: colors.textSecondary }]}>{distanceKm}</Text>
          <View style={styles.locationWrap}>
            <Ionicons name="location" size={12} color={Colors.primary} />
            <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
              {venue.location || "الموصل"}
            </Text>
          </View>
        </View>
        <VenueAmenitiesRow amenities={Array.isArray(venue.amenities) ? venue.amenities : []} max={3} compact />
      </View>

      <View style={[styles.imageWrap, { backgroundColor: venue.imageColor || "#1A2F1A" }]}>
        <ImageBackground
          source={venue.image ? { uri: venue.image } : undefined}
          style={styles.imagePlaceholder}
          resizeMode="cover"
        />
        {!venue.isOpen && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>مغلق</Text>
          </View>
        )}
        <View style={styles.openBadge}>
          <Text style={styles.openBadgeText}>{venue.isOpen ? "متاح الآن" : "مغلق"}</Text>
        </View>
        <Pressable
          style={styles.heartBtn}
          hitSlop={12}
          onPress={(e) => {
            e.stopPropagation();
            // TODO: toggle favorite
          }}
        >
          <Ionicons name="heart-outline" size={20} color="#fff" />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 138,
  },
  leftBlock: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 13,
    paddingRight: 9,
    justifyContent: "space-between",
  },
  sizePill: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sizeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  name: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    marginTop: 4,
  },
  priceLine: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
  },
  distance: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  locationWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  location: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    flex: 1,
  },
  imageWrap: {
    width: 148,
    position: "relative",
    overflow: "hidden",
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  closedText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  openBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
