import React, { useMemo, useState } from "react";
import { Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { formatIqd } from "@/lib/format-currency";
import { useStoreCart } from "@/context/StoreCartContext";
import { fetchProductsByStoreId, fetchStoreById, type ProductItem } from "@/lib/firestore-marketplace";

function normalizeCategory(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function StoreDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { addItem, clearAndSetStore, items, storeId } = useStoreCart();
  const [queryText, setQueryText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Math.max(insets.bottom, 8);
  const storeQuery = useQuery({
    queryKey: ["store", id],
    enabled: Boolean(id),
    queryFn: () => fetchStoreById(String(id)),
  });
  const productsQuery = useQuery({
    queryKey: ["store-products", id],
    enabled: Boolean(id),
    queryFn: () => fetchProductsByStoreId(String(id)),
  });

  const store = storeQuery.data;
  const products = productsQuery.data ?? [];

  const categories = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of products) {
      const label = p.category?.trim();
      if (!label) continue;
      set.set(normalizeCategory(label), label);
    }
    return [{ id: "all", label: "الكل" }, ...Array.from(set.entries()).map(([id, label]) => ({ id, label }))];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== "all") {
      list = list.filter((p) => normalizeCategory(p.category || "") === activeCategory);
    }
    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter((p) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, queryText]);

  const onAdd = (p: ProductItem) => {
    if (!store) return;
    const r = addItem(store.id, store.name, p);
    if (!r.ok) {
      Alert.alert("تنبيه", "لا يمكن الطلب من متجرين مختلفين بنفس الطلب", [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تفريغ السلة",
          style: "destructive",
          onPress: () => {
            clearAndSetStore(store.id, store.name);
            addItem(store.id, store.name, p);
          },
        },
      ]);
      return;
    }
  };

  const cartCount = store && storeId === store.id ? items.reduce((s, i) => s + i.qty, 0) : 0;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#fff", paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>المتجر</Text>
        <Pressable
          onPress={() => router.push((`/store/cart/${String(id)}` as any))}
          style={styles.headerCartBtn}
        >
          <Ionicons name="cart-outline" size={22} color={Colors.primary} />
          {cartCount > 0 ? (
            <View style={styles.headerCartBadge}>
              <Text style={styles.headerCartBadgeTxt}>{cartCount > 9 ? "9+" : String(cartCount)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {store ? (
        <View style={[styles.storeCard, { borderColor: colors.border, backgroundColor: isDark ? "#111" : "#fff" }]}>
          <Image source={{ uri: store.logo || store.coverImage }} style={styles.storeLogo} />
          <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>
          <Text style={[styles.storeMeta, { color: Colors.primary }]}>{store.category}</Text>
          <Text style={[styles.storeRate, { color: colors.textSecondary }]}>[ 0 تقييم ] ★★★★★</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 20 }]}
        ListHeaderComponent={
          <View>
            <FlatList
              data={categories}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.chip, activeCategory === item.id && styles.chipActive]}
                  onPress={() => setActiveCategory(item.id)}
                >
                  <Text style={[styles.chipTxt, activeCategory === item.id && styles.chipTxtActive]}>{item.label}</Text>
                </Pressable>
              )}
            />
            <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: isDark ? "#111" : "#fff" }]}>
              <Pressable style={styles.searchBtn}>
                <Ionicons name="search" size={20} color="#fff" />
              </Pressable>
              <TextInput
                placeholder="ابحث عن منتج"
                placeholderTextColor={colors.textTertiary}
                value={queryText}
                onChangeText={setQueryText}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.productCard, { borderColor: colors.border, backgroundColor: isDark ? "#111" : "#fff" }]}
            onPress={() =>
              router.push({
                pathname: "/store/product/[id]",
                params: { id: item.id, storeId: String(id) },
              })
            }
          >
            <Ionicons name="heart" size={20} color="#BFBFBF" style={styles.heartIcon} />
            <Image source={{ uri: item.images[0] || "https://via.placeholder.com/260x180" }} style={styles.productImg} />
            <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.productCat, { color: Colors.primary }]}>{item.category}</Text>
            <View style={styles.priceRow}>
              <Pressable
                style={[styles.inlineCartBtn, { borderColor: Colors.primary }]}
                onPress={(e) => {
                  e.stopPropagation();
                  onAdd(item);
                }}
              >
                <Ionicons name="cart" size={14} color={Colors.primary} />
              </Pressable>
              <Text style={[styles.productPrice, { color: colors.text }]}>{formatIqd(item.price)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontFamily: "Cairo_600SemiBold", lineHeight: 32 },
  headerCartBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCartBadge: { position: "absolute", top: 4, right: 4, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center" },
  headerCartBadgeTxt: { color: "#fff", fontSize: 8, fontFamily: "Cairo_700Bold" },
  storeCard: { borderWidth: 1, borderRadius: 16, marginHorizontal: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  storeLogo: { width: 80, height: 80, borderRadius: 12, marginBottom: 8 },
  storeName: { fontSize: 22, fontFamily: "Cairo_600SemiBold", lineHeight: 30 },
  storeMeta: { fontSize: 15, fontFamily: "Cairo_400Regular", lineHeight: 22 },
  storeRate: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  listContent: { paddingHorizontal: 10 },
  chipsRow: { gap: 8, paddingHorizontal: 4, paddingBottom: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#EFF7F4" },
  chipActive: { backgroundColor: Colors.primary },
  chipTxt: { color: "#222", fontSize: 13, fontFamily: "Cairo_400Regular" },
  chipTxtActive: { color: "#fff", fontFamily: "Cairo_600SemiBold" },
  searchWrap: { borderWidth: 1, borderRadius: 12, marginHorizontal: 4, marginBottom: 10, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  searchBtn: { width: 58, height: 58, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  searchInput: { flex: 1, height: 58, paddingHorizontal: 12, fontSize: 16, fontFamily: "Cairo_400Regular", textAlign: "right" },
  gridRow: { justifyContent: "space-between" },
  productCard: { width: "49%", borderWidth: 1, borderRadius: 10, marginBottom: 8, padding: 8 },
  heartIcon: { alignSelf: "flex-end", marginBottom: 2 },
  productImg: { width: "100%", height: 140, borderRadius: 8, backgroundColor: "#EEE" },
  productName: { marginTop: 6, fontSize: 16, lineHeight: 22, textAlign: "center", fontFamily: "Cairo_600SemiBold" },
  productCat: { textAlign: "center", fontSize: 13, lineHeight: 19, fontFamily: "Cairo_400Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  inlineCartBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  productPrice: { fontSize: 18, lineHeight: 24, fontFamily: "Cairo_600SemiBold" },
});
