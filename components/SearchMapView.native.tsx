import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Venue } from "@/context/BookingsContext";
import { prefetchVenueDetailQuery } from "@/lib/app-data";
import { formatIqd } from "@/lib/format-currency";

const MOSUL_REGION = {
  latitude: 36.335,
  longitude: 43.119,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

interface Props {
  venues: Venue[];
  bottomPadding: number;
  venueExtraParams?: Record<string, string>;
}

function VenueMarker({ name }: { name: string }) {
  return (
    <View style={markerStyles.container}>
      <View style={markerStyles.label}>
        <Text style={markerStyles.labelText} numberOfLines={1}>{name}</Text>
      </View>
      <View style={markerStyles.pin}>
        <Ionicons name="football" size={12} color="#fff" />
      </View>
      <View style={markerStyles.tail} />
    </View>
  );
}

export default function SearchMapView({ venues, bottomPadding, venueExtraParams }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={MOSUL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {venues.map(venue => (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.lat, longitude: venue.lon }}
            onPress={() => {
              prefetchVenueDetailQuery(queryClient, venue.id);
              setSelectedVenue(venue);
            }}
          >
            <VenueMarker name={venue.name} />
          </Marker>
        ))}
      </MapView>

      {selectedVenue && (
        <View style={[styles.bottomSheet, { bottom: insets.bottom + bottomPadding + 10 }]}>
          <Pressable
            style={styles.sheetContent}
            onPressIn={() => prefetchVenueDetailQuery(queryClient, selectedVenue.id)}
            onPress={() =>
              router.push({
                pathname: "/venue/[id]",
                params: { id: selectedVenue.id, ...venueExtraParams },
              })
            }
          >
            <View style={[styles.venueColorIcon, { backgroundColor: selectedVenue.imageColor }]}>
              <Ionicons name="football" size={22} color="rgba(255,255,255,0.7)" />
            </View>
            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>{selectedVenue.name}</Text>
              <Text style={styles.venueLocation}>{selectedVenue.location}</Text>
              {selectedVenue.amenities.length > 0 && (
                <Text style={styles.venueAmenities} numberOfLines={2}>
                  الخدمات: {selectedVenue.amenities.join("، ")}
                </Text>
              )}
              <View style={styles.venueMeta}>
                <View style={[styles.openDot, { backgroundColor: selectedVenue.isOpen ? Colors.primary : Colors.destructive }]} />
                <Text style={styles.venueStatus}>{selectedVenue.isOpen ? "مفتوح" : "مغلق"}</Text>
                <Text style={styles.venuePrice}>
                  {formatIqd(selectedVenue.pricePerHour)}/hr
                </Text>
                {selectedVenue.fieldSizes.length > 0 && (
                  <Text style={styles.venueSize}>{selectedVenue.fieldSizes[0]}</Text>
                )}
              </View>
            </View>
            <View style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>احجز</Text>
            </View>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={() => setSelectedVenue(null)}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: { alignItems: "center" },
  label: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  labelText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  pin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.primary,
    marginTop: -1,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  sheetContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  venueColorIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  venueInfo: { flex: 1, gap: 3 },
  venueName: { color: Colors.text, fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  venueLocation: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  venueAmenities: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
  venueMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  venueStatus: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  venuePrice: { color: Colors.primary, fontSize: 12, fontFamily: "Cairo_600SemiBold" },
  venueSize: { color: Colors.textTertiary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  bookBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bookBtnText: { color: "#000", fontSize: 13, fontFamily: "Cairo_700Bold" },
  closeBtn: { padding: 14, alignSelf: "flex-start" },
});
