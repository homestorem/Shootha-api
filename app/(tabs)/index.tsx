import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { VenueCard } from "@/components/VenueCard";
import { SkeletonVenueCard } from "@/components/SkeletonCard";
import SearchMapView from "@/components/SearchMapView";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { fetchVenues } from "@/lib/app-data";
import * as Location from "expo-location";
import { AppBrand } from "@/components/AppBrand";
import { NotificationsButton } from "@/components/NotificationsButton";
import { AppBackground } from "@/components/AppBackground";
import { ModernButton } from "@/components/ModernButton";
import { GlassWelcomeCard } from "@/components/GlassWelcomeCard";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { haversineKm } from "@/lib/distance";
import { PremiumAdsBanner } from "@/components/PremiumAdCarousel";
import { useLang } from "@/context/LanguageContext";
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, isGuest } = useAuth();
  const { t } = useLang();
  const { pushIfLoggedIn } = useGuestPrompt();
  const { hasPermission, latitude, longitude, requestLocation } = useLocation();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const { data: sbVenues = [], isLoading: sbLoading } = useQuery({
    queryKey: ["venues", "fields"],
    queryFn: fetchVenues,
    staleTime: 30000,
  });
  const isLoading = sbLoading;

  /** يحدّث السياق (lat/lng) ويُظهر الملاعب مرتبة بالقرب؛ الويب يُحمَّل من LocationProvider. */
  useEffect(() => {
    if (Platform.OS === "web") return;
    void requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (hasPermission !== true) return;
    (async () => {
      try {
        const geo = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (geo.length > 0) {
          setCity(geo[0].city || "");
          setDistrict(geo[0].district || geo[0].subregion || "");
        }
      } catch {
        /* العنوان اختياري */
      }
    })();
  }, [hasPermission, latitude, longitude]);

  const nearbyVenues = useMemo(() => {
    if (sbVenues.length === 0) return [];
    if (hasPermission !== true) return [...sbVenues];
    return [...sbVenues].sort(
      (a, b) =>
        haversineKm(latitude, longitude, a.lat, a.lon) -
        haversineKm(latitude, longitude, b.lat, b.lon),
    );
  }, [sbVenues, hasPermission, latitude, longitude]);

  const topVenues = nearbyVenues.slice(0, 5);
  const mapVenues = nearbyVenues;
  return (
    <AppBackground>
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <AppBrand size={28} />
            <Text style={[styles.userLocation, { color: "#FFFFFF" }]}>
              {city} {district ? `- ${district}` : ""}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIcon}
              onPress={() => pushIfLoggedIn("/leaderboard")}
            >
              <Ionicons name="trophy" size={24} color={colors.headerIcon} />
            </Pressable>

            <NotificationsButton />
          </View>
        </View>

        <PremiumAdsBanner />

        <GlassWelcomeCard
          userName={
            (isGuest && !GUEST_FULL_ACCESS) || !user || !user.name?.trim()
              ? t("profile.guestName")
              : user.name
          }
          locationLines={
            hasPermission === false
              ? t("home.locationPermissionHint")
              : city
                ? `${t("home.locationCityHintPrefix")} ${city}${district ? ` - ${district}` : ""}`
                : t("home.locationGeneralHint")
          }
        />

        <View style={styles.matchActions}>
          <View style={styles.matchActionsRow}>
            <ModernButton
              title={t("home.randomCreate")}
              icon="shuffle-outline"
              variant="primary"
              onPress={() => pushIfLoggedIn("/random-match-create")}
            />
            <ModernButton
              title={t("home.randomJoin")}
              icon="people-outline"
              variant="secondary"
              pulseGlow={false}
              onPress={() => pushIfLoggedIn("/random-match-join")}
            />
          </View>
        </View>

        <View style={styles.mapSection}>
          <View style={[styles.mapContainer, { borderColor: colors.border }]}>
            <SearchMapView
              venues={mapVenues}
              bottomPadding={bottomPadding}
              embedded
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("home.nearbyVenues")}</Text>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.seeAll}>{t("common.seeAll")}</Text>
          </Pressable>
        </View>

        {isLoading && nearbyVenues.length === 0 ? (
          <>
            <SkeletonVenueCard />
            <SkeletonVenueCard />
          </>
        ) : topVenues.length === 0 ? (
          <View style={styles.emptyVenues}>
            <Ionicons name="football-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("home.noVenuesTitle")}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t("home.noVenuesBody")}
            </Text>
          </View>
        ) : (
          topVenues.map(venue => (
            <VenueCard key={venue.id} venue={venue} />
          ))
        )}
      </ScrollView>
    </View>
    </AppBackground>
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
    direction: "ltr",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
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
  emptyVenues: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
    marginHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  headerActions: {
    direction: "ltr",
    flexDirection: "row",
    gap: 10,
  },

  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerIcon: {
    padding: 6,
  },
  matchActions: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  matchActionsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  mapSection: {
    marginHorizontal: 10,
    marginBottom: 10,
    gap: 5,
  },
  mapContainer: {
    height: 176,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  userLocation: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
});
