import React, { useMemo, useState } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  Pressable,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useLang } from "@/context/LanguageContext";
import { AppBrand } from "@/components/AppBrand";
import { StoreAdsBanner } from "@/components/StoreAdsBanner";
import {
  fetchActiveStores,
  fetchMarketplaceCategories,
  filterBySearch,
  type ProductItem,
} from "@/lib/firestore-marketplace";
import { fetchProductsByStoreId } from "@/lib/firestore-marketplace";
import { useStoreCart } from "@/context/StoreCartContext";

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t, textAlign, writingDirection } = useLang();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { items, storeId, clearCart } = useStoreCart();

  const cartCount = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  const promptClearCart = () => {
    if (cartCount === 0) return;
    Alert.alert(t("store.clearCartTitle"), t("store.clearCartMessage"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("store.clearCartAction"), style: "destructive", onPress: () => clearCart() },
    ]);
  };

  const openCart = () => {
    if (!storeId) {
      Alert.alert(t("store.cartTitle"), t("store.emptyCart"));
      return;
    }
    router.push(`/store/cart/${storeId}` as never);
  };

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: fetchActiveStores,
  });

  const productsQuery = useQuery({
    queryKey: ["store-products-preview", storesQuery.data?.map((x) => x.id).join("|") || "none"],
    enabled: Boolean(storesQuery.data?.length),
    queryFn: async () => {
      const stores = storesQuery.data ?? [];
      const lists = await Promise.all(stores.slice(0, 8).map((s) => fetchProductsByStoreId(s.id)));
      return lists.flat();
    },
  });
  const categoriesQuery = useQuery({
    queryKey: ["store-categories"],
    queryFn: fetchMarketplaceCategories,
  });

  const searchable = useMemo(() => {
    return filterBySearch(storesQuery.data ?? [], productsQuery.data ?? [], search);
  }, [storesQuery.data, productsQuery.data, search]);

  const categoryOptions = useMemo(() => {
    const fromCollection = (categoriesQuery.data ?? []).map((c) => ({
      id: normalizeCategoryKey(c.name || c.id),
      label: c.name,
    }));
    if (fromCollection.length > 0) return fromCollection;
    const stores = storesQuery.data ?? [];
    const products = productsQuery.data ?? [];
    const map = new Map<string, string>();
    for (const s of stores) {
      const label = s.category?.trim();
      if (!label) continue;
      map.set(normalizeCategoryKey(label), label);
    }
    for (const p of products) {
      const label = p.category?.trim();
      if (!label) continue;
      map.set(normalizeCategoryKey(label), label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [categoriesQuery.data, storesQuery.data, productsQuery.data]);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === "all") return searchable;
    const activeLabel = categoryOptions.find((x) => x.id === activeCategory)?.label ?? "";
    const byCategory = (value: string) => {
      const current = normalizeCategoryKey(value);
      if (current === activeCategory) return true;
      if (!activeLabel) return false;
      const v = value.trim().toLowerCase();
      const a = activeLabel.trim().toLowerCase();
      return v.includes(a) || a.includes(v);
    };
    return {
      stores: searchable.stores.filter((s) => byCategory(s.category)),
      products: searchable.products.filter((p) => byCategory(p.category)),
    };
  }, [searchable, activeCategory, categoryOptions]);

  const featuredProducts = useMemo(
    () =>
      (categoryFiltered.products as ProductItem[])
        .slice()
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 8),
    [categoryFiltered.products],
  );
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          backgroundColor: isDark ? "#000" : "#F8F9FA",
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrap}>
          <View style={styles.topHeader}>
            <AppBrand size={28} />
            <View style={styles.headerActions}>
              {cartCount > 0 ? (
                <Pressable style={styles.trashBtn} onPress={promptClearCart} hitSlop={10}>
                  <Ionicons name="trash-outline" size={22} color={colors.headerIcon} />
                </Pressable>
              ) : null}
              <Pressable style={styles.cartBtn} onPress={openCart}>
                <Ionicons name="cart-outline" size={24} color={colors.headerIcon} />
                {cartCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeTxt}>{cartCount > 9 ? "9+" : String(cartCount)}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          <StoreAdsBanner />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            <Pressable
              key="all"
              style={[
                styles.categoryChip,
                { backgroundColor: colors.card },
                activeCategory === "all" ? styles.categoryChipActive : null,
              ]}
              onPress={() => setActiveCategory("all")}
            >
              <Ionicons name="grid-outline" size={24} color={Colors.primary} />
              <Text style={[styles.categoryTxt, { color: colors.text }]} numberOfLines={1}>
                {t("search.filters.all")}
              </Text>
            </Pressable>
            {categoryOptions.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: colors.card },
                  activeCategory === cat.id ? styles.categoryChipActive : null,
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Ionicons name="pricetag-outline" size={24} color={Colors.primary} />
                <Text style={[styles.categoryTxt, { color: colors.text }]} numberOfLines={1}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={[
              styles.searchInput,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.card,
                textAlign,
                writingDirection,
              },
            ]}
            placeholder={t("store.searchPlaceholder")}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("store.verifiedStores")}</Text>
            <Text style={[styles.seeAll, { color: Colors.primary }]}>{t("common.seeAll")}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {(categoryFiltered.stores.length ? categoryFiltered.stores : activeCategory === "all" ? storesQuery.data ?? [] : []).map((store) => (
              <Pressable
                key={store.id}
                style={[styles.storeCard, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() =>
                  router.push({
                    pathname: "/store/[id]",
                    params: { id: store.id },
                  })
                }
              >
                <Image source={{ uri: store.logo || store.coverImage }} style={styles.storeLogo} />
                <Text style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>
                  {store.name}
                </Text>
                <Text style={[styles.storeCat, { color: colors.textSecondary }]} numberOfLines={1}>
                  {store.category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {((categoryFiltered.stores.length ? categoryFiltered.stores : activeCategory === "all" ? storesQuery.data ?? [] : []).length === 0) ? (
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t("store.noStores")}</Text>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("store.mostPopular")}</Text>
            <Text style={[styles.seeAll, { color: Colors.primary }]}>{t("common.seeAll")}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {featuredProducts.map((p) => (
              <View key={p.id} style={[styles.productCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Image source={{ uri: p.images[0] || "https://via.placeholder.com/180x120" }} style={styles.productImage} />
                <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.productPrice}>{Math.round(p.price).toLocaleString()} {t("common.iqd")}</Text>
              </View>
            ))}
          </ScrollView>
          {featuredProducts.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t("store.noFeaturedProducts")}</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrap: {
    paddingHorizontal: 14,
    gap: 12,
  },
  scrollContent: {
    paddingBottom: 22,
  },
  topHeader: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trashBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 2,
    borderRadius: 7,
    backgroundColor: Colors.destructive,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  cartBadgeTxt: {
    color: "#fff",
    fontSize: 8,
    fontFamily: "Cairo_700Bold",
  },
  categoriesRow: {
    gap: 10,
    paddingVertical: 6,
  },
  categoryChip: {
    width: 86,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  categoryChipActive: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "rgba(15,157,88,0.14)",
  },
  categoryTxt: {
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  hScroll: {
    gap: 10,
    paddingBottom: 8,
    paddingTop: 6,
  },
  storeCard: {
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  storeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  storeName: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
  },
  storeCat: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  productCard: {
    width: 160,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  productImage: {
    width: "100%",
    height: 94,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  productName: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  productPrice: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    marginTop: 2,
  },
});
