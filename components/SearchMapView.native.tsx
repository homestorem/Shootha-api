import React, { useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import type { Venue } from "@/context/BookingsContext";
import { useLocation } from "@/context/LocationContext";
import { prefetchVenueDetailQuery } from "@/lib/app-data";

type Props = {
  venues: Venue[];
  bottomPadding: number;
  embedded?: boolean;
  venueExtraParams?: Record<string, string>;
};

function buildLeafletHtml(params: {
  venues: Venue[];
  user: { lat: number; lon: number };
  embedded: boolean;
}) {
  const payload = JSON.stringify({
    venues: params.venues.map((v) => ({
      id: v.id,
      name: v.name,
      lat: v.lat,
      lon: v.lon,
      imageColor: (v as any).imageColor ?? Colors.primary,
    })),
    user: params.user,
    embedded: params.embedded,
  });

  // NOTE: Uses CDN assets to keep native bundle small.
  // In production you can switch to local assets if needed.
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body { height: 100%; margin: 0; background: transparent; }
      #map { height: 100%; width: 100%; }
      .leaflet-container { background: #0b0b0d; }
      .venue-pill {
        background: rgba(18,18,18,0.92);
        color: rgba(255,255,255,0.92);
        border: 1px solid rgba(255,255,255,0.12);
        padding: 8px 10px;
        border-radius: 12px;
        font-family: -apple-system, system-ui, Segoe UI, Roboto, Arial, sans-serif;
        font-size: 12px;
        max-width: 220px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .venue-dot {
        width: 10px; height: 10px; border-radius: 999px; display: inline-block;
        margin-left: 8px; vertical-align: middle;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const payload = ${payload};
      const { venues, user } = payload;

      const map = L.map("map", {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const userIcon = L.divIcon({
        className: "user-dot",
        html: '<div style="width:16px;height:16px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 12px rgba(37,99,235,0.55)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const userMarker = L.marker([user.lat, user.lon], { icon: userIcon }).addTo(map);
      userMarker.bindPopup('<div class="venue-pill">موقعك الحالي</div>');

      const bounds = L.latLngBounds([[user.lat, user.lon]]);

      function venueIcon(color) {
        const safe = String(color || "#0f9d58").replace(/"/g, "");
        return L.divIcon({
          className: "venue-icon",
          html: '<div style="width:18px;height:18px;border-radius:10px;background:' + safe + ';border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,0.35)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
      }

      venues.forEach((v) => {
        const m = L.marker([v.lat, v.lon], { icon: venueIcon(v.imageColor) }).addTo(map);
        bounds.extend([v.lat, v.lon]);
        const title = String(v.name || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        m.bindPopup('<div class="venue-pill"><span class="venue-dot" style="background:'+ (v.imageColor || "#0f9d58") +'"></span>' + title + '</div>');
        m.on("click", () => {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: "venue_click", id: v.id }));
          } catch {}
        });
      });

      if (venues.length > 0) {
        map.fitBounds(bounds.pad(0.22));
      } else {
        map.setView([user.lat, user.lon], 13);
      }

      // Fix initial size issues inside React Native layouts.
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 300);
    </script>
  </body>
</html>`;
}

export default function SearchMapViewNative({
  venues,
  bottomPadding,
  embedded = false,
  venueExtraParams,
}: Props) {
  const queryClient = useQueryClient();
  const { latitude, longitude, isLocating } = useLocation();
  const webRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);

  const html = useMemo(() => {
    return buildLeafletHtml({
      venues,
      user: { lat: latitude, lon: longitude },
      embedded,
    });
  }, [venues, latitude, longitude, embedded]);

  const goVenue = useCallback(
    (id: string) => {
      prefetchVenueDetailQuery(queryClient, id);
      router.push({
        pathname: "/venue/[id]",
        params: { id, ...(venueExtraParams ?? {}) },
      });
    },
    [queryClient, venueExtraParams],
  );

  const onMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event?.nativeEvent?.data ?? "{}");
        if (data?.type === "venue_click" && typeof data.id === "string") {
          goVenue(data.id);
        }
      } catch {
        // ignore
      }
    },
    [goVenue],
  );

  const showLoading = isLocating || !loaded;
  const shellMinHeight = embedded ? 140 : 220;
  const paddingBottom = embedded ? bottomPadding + 16 : bottomPadding + 110;

  return (
    <View style={styles.container}>
      <View style={[styles.mapShell, { minHeight: shellMinHeight }]}>
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://localhost/" }}
          onLoadEnd={() => setLoaded(true)}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={styles.webview}
          // Helps Android with transparency / flashes
          androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
        />
        {showLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>جاري تحميل الخريطة…</Text>
          </View>
        ) : null}
      </View>
      {/* Keep bottom padding behavior aligned with existing layout expectations */}
      <View style={{ height: embedded ? 0 : paddingBottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapShell: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#0b0b0d",
  },
  webview: { backgroundColor: "transparent" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  loadingText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
});