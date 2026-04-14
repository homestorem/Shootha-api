import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Venue } from "@/context/BookingsContext";
import { prefetchVenueDetailQuery } from "@/lib/app-data";
import { formatIqd } from "@/lib/format-currency";

interface Props {
  venues: Venue[];
  bottomPadding: number;
  /** عند التضمين في الصفحة الرئيسية: تقليل الحشو السفلي للقائمة */
  embedded?: boolean;
  /** يُمرَّر لصفحة الملعب مع `id` */
  venueExtraParams?: Record<string, string>;
}

export default function SearchMapView({ venues, bottomPadding, embedded, venueExtraParams }: Props) {
  const queryClient = useQueryClient();
  const listPadBottom = embedded ? bottomPadding + 16 : bottomPadding + 110;
  return (
    <View style={styles.container}>
      <View style={styles.webNote}>
        <Ionicons name="phone-portrait-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.webNoteText}>الخريطة التفاعلية متاحة على التطبيق المحمول</Text>
      </View>
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={[styles.list, { paddingBottom: listPadBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {venues.map(venue => (
          <Pressable
            key={venue.id}
            style={styles.card}
            onPressIn={() => prefetchVenueDetailQuery(queryClient, venue.id)}
            onPress={() =>
              router.push({
                pathname: "/venue/[id]",
                params: { id: venue.id, ...venueExtraParams },
              })
            }
          >
            <View style={[styles.colorDot, { backgroundColor: venue.imageColor }]}>
              <Ionicons name="football" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{venue.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: venue.isOpen ? Colors.primary : Colors.destructive }]} />
              </View>
              <Text style={styles.location}>{venue.location}</Text>
              {venue.amenities.length > 0 && (
                <Text style={styles.amenitiesLine} numberOfLines={1}>
                  الخدمات: {venue.amenities.slice(0, 4).join("، ")}
                  {venue.amenities.length > 4 ? ` +${venue.amenities.length - 4}` : ""}
                </Text>
              )}
              <View style={styles.coordRow}>
                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.coords}>
                  {venue.lat.toFixed(4)}, {venue.lon.toFixed(4)}
                </Text>
              </View>
            </View>
            <View style={styles.priceBadge}>
              <Text style={styles.price} numberOfLines={1}>
                {formatIqd(venue.pricePerHour)}
              </Text>
              <Text style={styles.priceUnit}>/hr</Text>
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
  amenitiesLine: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
  coordRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  coords: { color: Colors.textTertiary, fontSize: 11, fontFamily: "Cairo_400Regular" },
  priceBadge: { alignItems: "center" },
  price: { color: Colors.primary, fontSize: 16, fontFamily: "Cairo_700Bold" },
  priceUnit: { color: Colors.textTertiary, fontSize: 10, fontFamily: "Cairo_400Regular" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { color: Colors.textTertiary, fontSize: 14, fontFamily: "Cairo_400Regular" },
});
