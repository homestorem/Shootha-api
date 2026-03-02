import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Venue } from "@/context/BookingsContext";

interface Props {
  venues: Venue[];
  bottomPadding: number;
}

export default function SearchMapView({ venues, bottomPadding }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.webNote}>
        <Ionicons name="phone-portrait-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.webNoteText}>الخريطة التفاعلية متاحة على التطبيق المحمول</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {venues.map(venue => (
          <Pressable
            key={venue.id}
            style={styles.card}
            onPress={() => router.push(`/venue/${venue.id}`)}
          >
            <View style={[styles.colorDot, { backgroundColor: venue.imageColor }]}>
              <Ionicons name="football" size={16} color="rgba(255,255,255,0.7)" />
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{venue.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: venue.isOpen ? Colors.primary : Colors.destructive }]} />
              </View>
              <Text style={styles.location}>{venue.location}</Text>
              <View style={styles.coordRow}>
                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.coords}>
                  {venue.lat.toFixed(4)}, {venue.lon.toFixed(4)}
                </Text>
              </View>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.price}>{(venue.pricePerHour / 1000).toFixed(0)}k</Text>
              <Text style={styles.priceUnit}>د.ع/س</Text>
            </View>
          </Pressable>
        ))}
        {venues.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>لا توجد ملاعب تطابق الفلتر</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webNoteText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  list: { paddingHorizontal: 20, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  colorDot: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: Colors.text, fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  location: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  coordRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  coords: { color: Colors.textTertiary, fontSize: 11, fontFamily: "Cairo_400Regular" },
  priceBadge: { alignItems: "center" },
  price: { color: Colors.primary, fontSize: 16, fontFamily: "Cairo_700Bold" },
  priceUnit: { color: Colors.textTertiary, fontSize: 10, fontFamily: "Cairo_400Regular" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { color: Colors.textTertiary, fontSize: 14, fontFamily: "Cairo_400Regular" },
});
