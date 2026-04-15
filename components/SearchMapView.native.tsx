import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
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

// 🔥 Error Boundary يمنع crash نهائي
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// 🎯 شكل الماركر
function VenueMarker({ name }: { name: string }) {
  return (
    <View style={markerStyles.container}>
      <View style={markerStyles.label}>
        <Text style={markerStyles.labelText} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={markerStyles.pin}>
        <Ionicons name="football" size={12} color="#fff" />
      </View>
      <View style={markerStyles.tail} />
    </View>
  );
}

export default function SearchMapView({
  venues,
  bottomPadding,
  venueExtraParams,
}: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // 🔥 fallback إذا الخريطة فشلت
  const fallbackUI = useMemo(
    () => (
      <View style={styles.fallbackContainer}>
        <Ionicons name="map-outline" size={36} color={Colors.textTertiary} />
        <Text style={styles.fallbackTitle}>Map not available</Text>
        <Text style={styles.fallbackText}>
          We could not render the map. You can continue using the app safely.
        </Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <MapErrorBoundary fallback={fallbackUI}>
        <MapView
          style={styles.map}
          initialRegion={MOSUL_REGION}
          showsUserLocation={false} // تجنب مشاكل الصلاحيات
          showsMyLocationButton={false}
          moveOnMarkerPress={false}
        >
          {venues.length > 0 ? (
            venues
              .filter((v) => v?.lat && v?.lon)
              .map((venue) => (
              <Marker
                key={venue.id}
                coordinate={{
                  latitude: Number(venue.lat),
                  longitude: Number(venue.lon),
                }}
                onPress={() => {
                  prefetchVenueDetailQuery(queryClient, venue.id);
                  setSelectedVenue(venue);
                }}
                tracksViewChanges={false}
              >
                <VenueMarker name={venue.name} />
              </Marker>
            ))
          ) : (
            <Marker
              coordinate={{
                latitude: MOSUL_REGION.latitude,
                longitude: MOSUL_REGION.longitude,
              }}
              title="Sample marker"
              description="Map preview"
            />
          )}
        </MapView>
      </MapErrorBoundary>

      {selectedVenue && (
        <View
          style={[
            styles.bottomSheet,
            { bottom: insets.bottom + bottomPadding + 10 },
          ]}
        >
          <Pressable
            style={styles.sheetContent}
            onPressIn={() =>
              prefetchVenueDetailQuery(queryClient, selectedVenue.id)
            }
            onPress={() =>
              router.push({
                pathname: "/venue/[id]",
                params: { id: selectedVenue.id, ...venueExtraParams },
              })
            }
          >
            <View
              style={[
                styles.venueColorIcon,
                { backgroundColor: selectedVenue.imageColor },
              ]}
            >
              <Ionicons
                name="football"
                size={22}
                color="rgba(255,255,255,0.7)"
              />
            </View>

            <View style={styles.venueInfo}>
              <Text style={styles.venueName}>
                {selectedVenue.name}
              </Text>
              <Text style={styles.venueLocation}>
                {selectedVenue.location}
              </Text>

              <View style={styles.venueMeta}>
                <Text style={styles.venuePrice}>
                  {formatIqd(selectedVenue.pricePerHour)}/hr
                </Text>
              </View>
            </View>

            <View style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>احجز</Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.closeBtn}
            onPress={() => setSelectedVenue(null)}
          >
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// 🎨 Styles
const markerStyles = StyleSheet.create({
  container: { alignItems: "center" },
  label: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  labelText: {
    color: "#fff",
    fontSize: 12,
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

  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fallbackTitle: {
    color: Colors.text,
    fontSize: 16,
  },
  fallbackText: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },

  bottomSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  sheetContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  venueColorIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  venueInfo: { flex: 1 },

  venueName: { color: Colors.text, fontSize: 14 },
  venueLocation: { color: Colors.textSecondary, fontSize: 12 },
  venueMeta: { marginTop: 4 },

  venuePrice: { color: Colors.primary, fontSize: 13 },

  bookBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  bookBtnText: { color: "#000", fontSize: 12 },

  closeBtn: {
    padding: 10,
  },
});