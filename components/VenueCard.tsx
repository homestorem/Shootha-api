import React from "react";
import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { Venue, formatPrice } from "@/context/BookingsContext";
import { getHourlyRate } from "@/lib/venue-pricing";
import { prefetchVenueDetailQuery } from "@/lib/app-data";
import { VenueAmenitiesRow } from "@/components/VenueAmenitiesRow";

interface VenueCardProps {
  venue: Venue;
}

export function VenueCard({ venue }: VenueCardProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const hourly = getHourlyRate(venue);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
      onPressIn={() => prefetchVenueDetailQuery(queryClient, venue.id)}
      onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
    >
      <View style={[styles.imageArea, { backgroundColor: venue.imageColor }]}>
        <ImageBackground
          source={venue.image ? { uri: venue.image } : undefined}
          style={styles.imageBg}
          imageStyle={styles.imageBgStyle}
          resizeMode="cover"
        >
          <View style={styles.imageOverlay}>
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.7)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topBadges}>
              <View style={[styles.badge, venue.isOpen ? styles.openBadge : styles.closedBadge]}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: venue.isOpen ? Colors.primary : Colors.destructive },
                  ]}
                />
                <Text style={styles.badgeText}>{venue.isOpen ? "متاح" : "مغلق"}</Text>
              </View>
            </View>
            <View style={styles.fieldIcon}>
              <Ionicons name="football" size={32} color="rgba(15,157,88,0.4)" />
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>
                {hourly > 0 ? `${formatPrice(hourly)}/hr` : "—"}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {venue.name}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={[styles.rating, { color: colors.text }]}>{venue.rating}</Text>
            <Text style={[styles.reviewCount, { color: colors.textSecondary }]}>
              ({venue.reviewCount})
            </Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={colors.textSecondary} />
          <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
            {venue.location}
          </Text>
        </View>

        <View style={styles.tagsRow}>
          {venue.fieldSizes.map((size) => (
            <View
              key={size}
              style={[
                styles.tag,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>{size}</Text>
            </View>
          ))}
          <View
            style={[
              styles.tag,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>
              {venue.openHours}
            </Text>
          </View>
        </View>
        <VenueAmenitiesRow amenities={venue.amenities} max={4} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  imageArea: {
    height: 160,
    padding: 0,
  },
  imageBg: {
    flex: 1,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 12,
  },
  imageBgStyle: {
    opacity: 0.95,
  },
  topBadges: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  openBadge: {
    backgroundColor: "rgba(15,157,88,0.15)",
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.3)",
  },
  closedBadge: {
    backgroundColor: "rgba(255,59,48,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Cairo_600SemiBold" },
  fieldIcon: { alignSelf: "center", marginTop: -8 },
  priceTag: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priceText: { color: "#000", fontSize: 12, fontFamily: "Cairo_700Bold" },
  info: { padding: 14, gap: 6 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 16, fontFamily: "Cairo_700Bold", flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  rating: { fontSize: 13, fontFamily: "Cairo_600SemiBold" },
  reviewCount: { fontSize: 11, fontFamily: "Cairo_400Regular" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 12, fontFamily: "Cairo_400Regular", flex: 1 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontFamily: "Cairo_400Regular" },
});
