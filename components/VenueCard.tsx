import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { Venue, formatPrice } from "@/context/BookingsContext";

interface VenueCardProps {
  venue: Venue;
}

export function VenueCard({ venue }: VenueCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => router.push({ pathname: "/venue/[id]", params: { id: venue.id } })}
    >
      <View style={[styles.imageArea, { backgroundColor: venue.imageColor }]}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topBadges}>
          <View style={[styles.badge, venue.isOpen ? styles.openBadge : styles.closedBadge]}>
            <View style={[styles.dot, { backgroundColor: venue.isOpen ? Colors.primary : Colors.destructive }]} />
            <Text style={styles.badgeText}>{venue.isOpen ? "متاح" : "مغلق"}</Text>
          </View>
        </View>
        <View style={styles.fieldIcon}>
          <Ionicons name="football" size={32} color="rgba(46,204,113,0.4)" />
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(venue.pricePerHour)}/س</Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.rating}>{venue.rating}</Text>
            <Text style={styles.reviewCount}>({venue.reviewCount})</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={Colors.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>{venue.location}</Text>
        </View>

        <View style={styles.tagsRow}>
          {venue.fieldSizes.map((size) => (
            <View key={size} style={styles.tag}>
              <Text style={styles.tagText}>{size}</Text>
            </View>
          ))}
          <View style={styles.tag}>
            <Ionicons name="time-outline" size={11} color={Colors.textSecondary} />
            <Text style={styles.tagText}>{venue.openHours}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageArea: {
    height: 160,
    justifyContent: "space-between",
    padding: 12,
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
    backgroundColor: "rgba(46,204,113,0.15)",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.3)",
  },
  closedBadge: {
    backgroundColor: "rgba(255,59,48,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
  fieldIcon: {
    alignSelf: "center",
    marginTop: -8,
  },
  priceTag: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priceText: {
    color: "#000",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  info: {
    padding: 14,
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  reviewCount: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    flex: 1,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  tag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
});
