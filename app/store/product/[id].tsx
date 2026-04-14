import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { formatIqd } from "@/lib/format-currency";
import { Colors } from "@/constants/colors";
import { fetchProductById, fetchStoreById } from "@/lib/firestore-marketplace";
import { useStoreCart } from "@/context/StoreCartContext";

function ratingLine(rating: number, secondaryColor: string) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  if (r <= 0) {
    return <Text style={{ color: secondaryColor, fontSize: 12, fontFamily: "Cairo_400Regular" }}>لا تقييمات بعد</Text>;
  }
  const filled = "★".repeat(r);
  const empty = "☆".repeat(5 - r);
  return (
    <Text style={{ color: secondaryColor, fontSize: 12, fontFamily: "Cairo_400Regular" }}>
      {filled}
      {empty} ({rating.toFixed(1)})
    </Text>
  );
}

export default function ProductDetailsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, storeId } = useLocalSearchParams<{ id: string; storeId?: string }>();
  const sid = String(storeId || "");
  const { setItemQty, getItemQty } = useStoreCart();
  const [qty, setQty] = useState(1);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Math.max(insets.bottom, 12);

  const productQuery = useQuery({
    queryKey: ["store-product", id],
    enabled: Boolean(id),
    queryFn: () => fetchProductById(String(id)),
  });
  const storeQuery = useQuery({
    queryKey: ["store", sid],
    enabled: Boolean(sid),
    queryFn: () => fetchStoreById(sid),
  });

  const p = productQuery.data;
  const total = useMemo(() => Math.round((p?.price || 0) * qty), [p?.price, qty]);

  const qtyBtnBg = isDark ? "#2C2C2C" : "#FFFFFF";
  const qtyBtnBorder = isDark ? "#3D3D3D" : "#E0E0E0";

  if (productQuery.isPending) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? "#000" : "#fff", paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!p) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#fff", paddingTop: topPad }]}>
        <Text style={[styles.empty, { color: colors.text }]}>المنتج غير متاح</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#fff" }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 6,
            paddingBottom: bottomInset + 108,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>المنتج</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.heroWrap}>
          <Image source={{ uri: p.images[0] || "https://via.placeholder.com/600x420" }} style={styles.hero} />
          <Pressable style={[styles.heartBtn, { backgroundColor: isDark ? "rgba(40,40,40,0.92)" : "rgba(255,255,255,0.95)" }]}>
            <Ionicons name="heart-outline" size={20} color="#BFBFBF" />
          </Pressable>
        </View>
        <View style={styles.body}>
          {storeQuery.data ? (
            <View style={[styles.storeRow, { borderColor: colors.border, backgroundColor: isDark ? "#141414" : "#FAFAFA" }]}>
              <Image source={{ uri: storeQuery.data.logo || storeQuery.data.coverImage }} style={styles.storeLogo} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.storeName, { color: colors.text }]}>{storeQuery.data.name}</Text>
                {ratingLine(storeQuery.data.rating, colors.textSecondary)}
              </View>
            </View>
          ) : null}
          <Text style={[styles.name, { color: colors.text }]}>{p.name}</Text>
          <Text style={[styles.category, { color: Colors.primary }]}>{p.category || "نوع رياضي"}</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            {p.description || "لا يوجد وصف لهذا المنتج"}
          </Text>

          <View
            style={[
              styles.qtyBox,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? "#141414" : "#F3F4F6",
              },
            ]}
          >
            <View style={styles.priceLine}>
              <Text style={[styles.price, { color: colors.text }]}>{formatIqd(p.price)}</Text>
              <Text style={[styles.qtyLabel, { color: colors.textSecondary }]}>السعر</Text>
            </View>
            <View style={styles.qtyControls}>
              <Pressable
                style={[styles.qtyBtn, { backgroundColor: qtyBtnBg, borderWidth: 1, borderColor: qtyBtnBorder }]}
                onPress={() => setQty((x) => x + 1)}
              >
                <Text style={[styles.qtyBtnTxt, { color: colors.text }]}>+</Text>
              </Pressable>
              <Text style={[styles.qtyValue, { color: colors.text, backgroundColor: qtyBtnBg, borderColor: qtyBtnBorder }]}>{qty}</Text>
              <Pressable
                style={[styles.qtyBtn, { backgroundColor: qtyBtnBg, borderWidth: 1, borderColor: qtyBtnBorder }]}
                onPress={() => setQty((x) => Math.max(1, x - 1))}
              >
                <Text style={[styles.qtyBtnTxt, { color: colors.text }]}>−</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: colors.border,
            backgroundColor: isDark ? "#0D0D0D" : "#FFFFFF",
            paddingBottom: bottomInset + 10,
            paddingTop: 12,
          },
        ]}
      >
        <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
          Total: {formatIqd(total)}
        </Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            const st = storeQuery.data;
            if (!st) {
              Alert.alert("تنبيه", "المتجر غير متاح حالياً");
              return;
            }
            const result = setItemQty(st.id, st.name, p, qty);
            if (!result.ok) {
              Alert.alert("تنبيه", "لا يمكن إضافة منتجات من متجرين مختلفين");
              return;
            }
            Alert.alert("تم", `أُضيف للسلة. الكمية الحالية: ${getItemQty(p.id)}`);
          }}
        >
          <Text style={styles.addBtnTxt}>أضف للسلة</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 0 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTitle: { fontSize: 17, fontFamily: "Cairo_600SemiBold", lineHeight: 24 },
  heroWrap: { position: "relative", width: "100%" },
  hero: { width: "100%", height: 260, backgroundColor: "#EFEFEF" },
  heartBtn: {
    position: "absolute",
    top: 12,
    start: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 }, android: { elevation: 3 } }),
  },
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 6 },
  storeRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  storeLogo: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#DDD" },
  storeName: { fontSize: 15, fontFamily: "Cairo_600SemiBold", lineHeight: 22 },
  name: { fontSize: 20, fontFamily: "Cairo_600SemiBold", lineHeight: 28, marginTop: 4 },
  category: { fontSize: 13, lineHeight: 20, fontFamily: "Cairo_400Regular" },
  desc: { fontSize: 13, lineHeight: 21, fontFamily: "Cairo_400Regular", marginTop: 2 },
  price: { fontSize: 17, fontFamily: "Cairo_600SemiBold", lineHeight: 24 },
  qtyBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 12, marginTop: 10 },
  priceLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qtyLabel: { fontSize: 13, fontFamily: "Cairo_400Regular" },
  qtyControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyBtn: { width: 48, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { fontSize: 22, fontFamily: "Cairo_600SemiBold", lineHeight: 26 },
  qtyValue: {
    minWidth: 100,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Cairo_600SemiBold",
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: "row",
    direction: "ltr",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 8 } }),
  },
  total: { fontSize: 14, fontFamily: "Cairo_600SemiBold", lineHeight: 20, flex: 1, flexShrink: 1 },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    minWidth: 148,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Cairo_600SemiBold", lineHeight: 22 },
  empty: { marginTop: 50, textAlign: "center", fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
