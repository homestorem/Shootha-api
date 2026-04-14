import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { VenueListCard } from "@/components/VenueListCard";
import { SkeletonVenueCard } from "@/components/SkeletonCard";
import { fetchVenues } from "@/lib/app-data";
import { haversineKm } from "@/lib/distance";
import { useLocation } from "@/context/LocationContext";
import SearchMapView from "@/components/SearchMapView";
import * as Location from "expo-location";
import { AppBrand } from "@/components/AppBrand";
import { NotificationsButton } from "@/components/NotificationsButton";
import { AppBackground } from "@/components/AppBackground";
import { useLang } from "@/context/LanguageContext";
const FILTERS = [
  { id: "all", labelKey: "search.filters.all" },
  { id: "5v5", labelKey: "search.filters.5v5" },
  { id: "6x6", labelKey: "search.filters.6x6" },
  { id: "7v7", labelKey: "search.filters.7v7" },
  { id: "11v11", labelKey: "search.filters.11v11" },
  { id: "openNow", labelKey: "search.filters.openNow" },
];
const SORT_OPTIONS = [
  { id: "topRated", labelKey: "search.sort.topRated" },
  { id: "lowestPrice", labelKey: "search.sort.lowestPrice" },
  { id: "highestPrice", labelKey: "search.sort.highestPrice" },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLang();
  const { latitude, longitude, hasPermission } = useLocation();
  useEffect(() => {
  if (Platform.OS === "web") return;
  (async () => {

    let { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") return;

    const location = await Location.getCurrentPositionAsync({});

    const geo = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (geo.length > 0) {
      setCity(geo[0].city || "");
      setDistrict(geo[0].district || geo[0].subregion || "");
    }

  })();
}, []);
  const [city, setCity] = useState("");
const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("topRated");
  const [showSort, setShowSort] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const {
    data: sbVenues = [],
    isLoading: sbLoading,
    isError: venuesError,
    error: venuesErrorObj,
    refetch: refetchVenues,
  } = useQuery({
    queryKey: ["venues", "fields"],
    queryFn: fetchVenues,
    staleTime: 30000,
  });
  const isLoading = sbLoading;

  const venuesWithDistance = useMemo(() => {
    if (hasPermission !== true) return sbVenues.map((v) => ({ ...v }));
    return sbVenues.map((v) => ({
      ...v,
      distanceKm: haversineKm(latitude, longitude, v.lat, v.lon),
    }));
  }, [sbVenues, latitude, longitude, hasPermission]);

  const filtered = useMemo(() => {
    let venues = [...venuesWithDistance];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      venues = venues.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        v.district.toLowerCase().includes(q)
      );
    }

    if (activeFilter === "openNow") {
      venues = venues.filter(v => v.isOpen);
    } else if (activeFilter !== "all") {
      venues = venues.filter(v => {
        const sizes = v.fieldSizes;
        if (activeFilter === "5v5") return sizes.some(s => s === "5 ضد 5" || s === "5x5");
        if (activeFilter === "6x6") return sizes.includes("6x6");
        if (activeFilter === "7v7") return sizes.includes("7 ضد 7");
        if (activeFilter === "11v11") return sizes.includes("11 ضد 11");
        return true;
      });
    }

    if (sortBy === "topRated") {
      venues.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "lowestPrice") {
      venues.sort((a, b) => a.pricePerHour - b.pricePerHour);
    } else if (sortBy === "highestPrice") {
      venues.sort((a, b) => b.pricePerHour - a.pricePerHour);
    }

    return venues;
  }, [query, activeFilter, sortBy, venuesWithDistance]);

  return (
    <AppBackground>
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: "transparent" }]}>
<View style={styles.headerSection}>

{/* الهيدر العلوي */}
<View style={styles.headerTop}>

<View>

<AppBrand size={24} />
<Text style={[styles.pageTitle,{color:colors.text}]}>{t("search.exploreFields")}</Text>

<Text style={[styles.userLocation,{color:"#FFFFFF"}]}>
📍 {city} {district ? `- ${district}` : ""}
</Text>

</View>

<NotificationsButton />

</View>


{/* أزرار التبديل بين القائمة والخريطة */}
<View style={styles.titleRow}>

<View style={[styles.viewToggle,{backgroundColor:colors.card,borderColor:colors.border}]}>
  
<Pressable
style={[styles.toggleBtn,viewMode==="list"&&styles.toggleBtnActive]}
onPress={()=>setViewMode("list")}
>
<Ionicons
name="list"
size={15}
color={viewMode==="list"?Colors.primary:Colors.textTertiary}
/>

<Text style={[styles.toggleText,viewMode==="list"&&styles.toggleTextActive]}>
{t("search.list")}
</Text>
</Pressable>

<Pressable
style={[styles.toggleBtn,viewMode==="map"&&styles.toggleBtnActive]}
onPress={()=>setViewMode("map")}
>
<Ionicons
name="map"
size={15}
color={viewMode==="map"?Colors.primary:Colors.textTertiary}
/>

<Text style={[styles.toggleText,viewMode==="map"&&styles.toggleTextActive]}>
{t("search.map")}
</Text>
</Pressable>

</View>

</View>


        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t("search.searchPlaceholder")}
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {FILTERS.map(f => (
            <Pressable
              key={f.id}
              style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.id)}
            >
              <Text style={[styles.filterText, activeFilter === f.id && styles.filterTextActive]}>
                {t(f.labelKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {viewMode === "list" ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {venuesError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("search.loadFailedTitle")}</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {venuesErrorObj instanceof Error
                  ? venuesErrorObj.message
                  : t("search.loadFailedBody")}
              </Text>
              <Pressable
                style={[styles.retryBtn, { borderColor: colors.border }]}
                onPress={() => refetchVenues()}
              >
                <Text style={[styles.retryBtnText, { color: colors.primary }]}>{t("common.retry")}</Text>
              </Pressable>
            </View>
          ) : isLoading ? (
            <>
              <SkeletonVenueCard />
              <SkeletonVenueCard />
              <SkeletonVenueCard />
            </>
          ) : (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>{t("search.resultsCount", { count: filtered.length })}</Text>
                <Pressable style={styles.sortBtn} onPress={() => setShowSort(!showSort)}>
                  <Ionicons name="funnel-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.sortBtnText}>{t(`search.sort.${sortBy}`)}</Text>
                  <Ionicons name={showSort ? "chevron-up" : "chevron-down"} size={13} color={Colors.textSecondary} />
                </Pressable>
              </View>

              {showSort && (
                <View style={[styles.sortDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {SORT_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.id}
                      style={[styles.sortOption, sortBy === opt.id && styles.sortOptionActive]}
                      onPress={() => { setSortBy(opt.id); setShowSort(false); }}
                    >
                      <Text style={[styles.sortOptionText, sortBy === opt.id && styles.sortOptionTextActive]}>
                        {t(opt.labelKey)}
                      </Text>
                      {sortBy === opt.id && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}

              {venuesWithDistance.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="football-outline" size={52} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("home.noVenuesTitle")}</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t("search.noVenuesBody")}
                  </Text>
                </View>
              ) : filtered.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("search.noResultsTitle")}</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t("search.noResultsBody")}</Text>
                </View>
              ) : (
                filtered.map(venue => <VenueListCard key={venue.id} venue={venue} />)
              )}
            </>
          )}
        </ScrollView>
      ) : venuesError ? (
        <View style={[styles.emptyState, { flex: 1, justifyContent: "center" }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("search.loadFailedTitle")}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {venuesErrorObj instanceof Error
              ? venuesErrorObj.message
              : t("search.loadFailedBody")}
          </Text>
          <Pressable
            style={[styles.retryBtn, { borderColor: colors.border }]}
            onPress={() => refetchVenues()}
          >
            <Text style={[styles.retryBtnText, { color: colors.primary }]}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.mapTab}>
          <SearchMapView venues={filtered} bottomPadding={bottomPadding} />
        </View>
      )}
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: "Cairo_700Bold",
  },
  pageTitle: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 2,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toggleBtnActive: {
    backgroundColor: "rgba(15,157,88,0.12)",
  },
  toggleText: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  toggleTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
    textAlign: "right",
  },
  filtersRow: {
    gap: 8,
    paddingBottom: 4,
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(15,157,88,0.15)",
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
  },
  filterTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  mapTab: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingTop: 8,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultsCount: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
  },
  sortDropdown: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortOptionActive: {
    backgroundColor: "rgba(15,157,88,0.08)",
  },
  sortOptionText: {
    color: Colors.text,
    fontFamily: "Cairo_400Regular",
    fontSize: 14,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryBtnText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
  },
  headerTop:{
direction:"ltr",
flexDirection:"row",
justifyContent:"space-between",
alignItems:"center"
},

headerActions:{
flexDirection:"row",
gap:10
},

circleBtn:{
width:40,
height:40,
borderRadius:20,
alignItems:"center",
justifyContent:"center",
borderWidth:1
},

userLocation:{
fontSize:12,
fontFamily:"Cairo_400Regular",
marginTop:2
},
});
