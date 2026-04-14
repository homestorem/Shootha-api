import "leaflet/dist/leaflet.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import type { Venue } from "@/context/BookingsContext";
import { useLocation } from "@/context/LocationContext";
import { calculateDistance } from "@/lib/distance";
import { prefetchVenueDetailQuery } from "@/lib/app-data";

interface Props {
  venues: Venue[];
  bottomPadding: number;
  embedded?: boolean;
  venueExtraParams?: Record<string, string>;
}

const DEFAULT_ZOOM = 12;
const FLY_ZOOM = 14;

function FlyToVenue({ venueId, byId }: { venueId: string | null; byId: Map<string, Venue> }) {
  const map = useMap();
  useEffect(() => {
    if (!venueId) return;
    const v = byId.get(venueId);
    if (!v) return;
    map.flyTo([v.lat, v.lon], FLY_ZOOM, { duration: 0.45 });
  }, [venueId, byId, map]);
  return null;
}

function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const t =
      typeof window !== "undefined"
        ? window.setTimeout(() => map.invalidateSize(), 250)
        : 0;
    return () => {
      cancelAnimationFrame(raf);
      if (typeof window !== "undefined") window.clearTimeout(t);
    };
  }, [map]);
  return null;
}

const userMarkerIcon = L.divIcon({
  className: "leaflet-user-pos-icon",
  html: `<div style="width:16px;height:16px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 12px rgba(37,99,235,0.55)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function venueDivIcon(venue: Venue, selected: boolean): L.DivIcon {
  const label = escapeHtml(venue.name.length > 22 ? `${venue.name.slice(0, 20)}…` : venue.name);
  const ring = selected
    ? "0 0 0 3px #fff, 0 4px 14px rgba(0,0,0,.35)"
    : "0 2px 8px rgba(0,0,0,.28)";
  const w = selected ? 36 : 32;
  const h = selected ? 44 : 40;
  return L.divIcon({
    className: "leaflet-venue-icon",
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(${ring})">
      <div style="background:${venue.imageColor};color:#fff;border-radius:10px;padding:5px 8px;font-size:11px;font-weight:700;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:Cairo,system-ui,sans-serif">${label}</div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${venue.imageColor};margin-top:-1px"></div>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

export default function SearchMapView({
  venues,
  bottomPadding,
  embedded,
  venueExtraParams,
}: Props) {
  const queryClient = useQueryClient();
  const { latitude, longitude, isLocating } = useLocation();
  const [domReady, setDomReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setDomReady(true);
  }, []);

  const sortedVenues = useMemo(() => {
    return [...venues]
      .map((v) => ({
        ...v,
        distanceKm: calculateDistance(latitude, longitude, v.lat, v.lon),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [venues, latitude, longitude]);

  const venueById = useMemo(() => {
    const m = new Map<string, Venue>();
    for (const v of sortedVenues) m.set(v.id, v);
    return m;
  }, [sortedVenues]);

  const venueIconCache = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    for (const v of sortedVenues) {
      m.set(v.id, venueDivIcon(v, v.id === selectedId));
    }
    return m;
  }, [sortedVenues, selectedId]);

  const goVenue = useCallback(
    (id: string) => {
      prefetchVenueDetailQuery(queryClient, id);
      router.push({
        pathname: "/venue/[id]",
        params: { id, ...venueExtraParams },
      });
    },
    [queryClient, venueExtraParams],
  );

  const winH = Dimensions.get("window").height;
  const mapHeight = embedded ? undefined : Math.min(420, Math.round(winH * 0.38));
  const listPadBottom = embedded ? bottomPadding + 16 : bottomPadding + 110;

  const showMap = domReady && !isLocating;

  return (
    <View style={styles.container}>
      {!showMap ? (
        <View
          style={[
            styles.loadingBox,
            embedded ? styles.loadingEmbedded : { minHeight: mapHeight ?? 220 },
          ]}
        >
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحديد موقعك وتحميل الخريطة…</Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.mapShell,
              embedded ? { flex: 1, minHeight: 140, width: "100%" } : { height: mapHeight, width: "100%" },
            ]}
          >
            <MapContainer
              center={[latitude, longitude]}
              zoom={DEFAULT_ZOOM}
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                borderRadius: embedded ? 12 : 14,
              }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <InvalidateSizeOnMount />
              <FlyToVenue venueId={selectedId} byId={venueById} />
              <Marker position={[latitude, longitude]} icon={userMarkerIcon}>
                <Popup>
                  <View style={styles.popupInner}>
                    <Text style={styles.popupTitle}>موقعك الحالي</Text>
                  </View>
                </Popup>
              </Marker>
              {sortedVenues.map((venue) => (
                <Marker
                  key={venue.id}
                  position={[venue.lat, venue.lon]}
                  icon={
                    venueIconCache.get(venue.id) ??
                    venueDivIcon(venue, venue.id === selectedId)
                  }
                  eventHandlers={{
                    click: () => setSelectedId(venue.id),
                  }}
                >
                  <Popup>
                    <View style={styles.popupInner}>
                      <Text style={styles.popupTitle}>{venue.name}</Text>
                      <Text style={styles.popupMeta}>
                        يبعد عنك {venue.distanceKm.toFixed(1)} كم
                      </Text>
                      <Pressable style={styles.popupBtn} onPress={() => goVenue(venue.id)}>
                        <Text style={styles.popupBtnText}>تفاصيل الملعب</Text>
                      </Pressable>
                    </View>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </View>

          {!embedded && (
            <ScrollView
              nestedScrollEnabled
              style={styles.list}
              contentContainerStyle={{ paddingBottom: listPadBottom, gap: 10, paddingTop: 12 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.listHeading}>الأقرب إليك</Text>
              {sortedVenues.map((venue) => (
                <Pressable
                  key={venue.id}
                  style={[styles.card, selectedId === venue.id && styles.cardSelected]}
                  onPress={() => {
                    setSelectedId(venue.id);
                    goVenue(venue.id);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: venue.imageColor }]}>
                    <Ionicons name="football" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{venue.name}</Text>
                    <Text style={styles.loc}>{venue.location}</Text>
                    <Text style={styles.dist}>يبعد عنك {venue.distanceKm.toFixed(1)} كم</Text>
                  </View>
                  <Ionicons name="chevron-back" size={18} color={Colors.textTertiary} />
                </Pressable>
              ))}
              {sortedVenues.length === 0 && (
                <View style={styles.empty}>
                  <Ionicons name="map-outline" size={40} color={Colors.textTertiary} />
                  <Text style={styles.emptyText}>لا توجد ملاعب تطابق الفلتر</Text>
                </View>
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingBox: {
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  loadingEmbedded: { flex: 1, minHeight: 160 },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  mapShell: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: { flex: 1, marginTop: 4 },
  listHeading: {
    paddingHorizontal: 20,
    marginBottom: 4,
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  card: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  cardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: "rgba(15,157,88,0.06)",
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 3 },
  name: { color: Colors.text, fontSize: 15, fontFamily: "Cairo_600SemiBold" },
  loc: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Cairo_400Regular" },
  dist: { color: Colors.primary, fontSize: 13, fontFamily: "Cairo_600SemiBold", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { color: Colors.textTertiary, fontSize: 14, fontFamily: "Cairo_400Regular" },
  popupInner: { minWidth: 140, maxWidth: 220, gap: 6, paddingVertical: 4 },
  popupTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    color: Colors.text,
    textAlign: "right",
  },
  popupMeta: {
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "right",
  },
  popupBtn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  popupBtnText: { color: "#fff", fontFamily: "Cairo_600SemiBold", fontSize: 13 },
});
