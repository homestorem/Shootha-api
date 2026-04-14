import React from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { Colors } from "@/constants/colors";
import { useStoreCart } from "@/context/StoreCartContext";
import { useAuth } from "@/context/AuthContext";
import { fetchStoreById, fetchProductById } from "@/lib/firestore-marketplace";
import { useQuery } from "@tanstack/react-query";
import { formatIqd } from "@/lib/format-currency";

export default function StoreCartScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, storeId, total, setItemQty, removeItem } = useStoreCart();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Math.max(insets.bottom, 12);

  const storeQuery = useQuery({
    queryKey: ["store", id],
    enabled: Boolean(id),
    queryFn: () => fetchStoreById(String(id)),
  });
  const store = storeQuery.data;
  const cartItems = store && storeId === store.id ? items : [];

  const placeOrder = async () => {
    if (!store || !user || user.id === "guest") {
      Alert.alert("تنبيه", "سجل الدخول أولاً لإكمال الطلب.");
      return;
    }
    if (!cartItems.length) {
      Alert.alert("تنبيه", "السلة فارغة");
      return;
    }
    router.push((`/store/checkout/${String(id)}` as never));
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#F7F8FA" }]}>
      <View style={[styles.headerRow, { paddingTop: topPad + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>السلة</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {cartItems.map((it) => (
          <CartLine
            key={it.productId}
            item={it}
            storeId={String(id)}
            onRemove={() => removeItem(it.productId)}
            onSetQty={(q) => {
              fetchProductById(it.productId).then((p) => {
                if (!p || !store) return;
                setItemQty(store.id, store.name, p, q);
              });
            }}
          />
        ))}
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
        <Pressable style={styles.orderBtn} onPress={placeOrder}>
          <Text style={styles.orderBtnTxt}>اطلب الآن</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CartLine({
  item,
  onRemove,
  onSetQty,
}: {
  item: { productId: string; name: string; price: number; qty: number; image?: string };
  storeId: string;
  onRemove: () => void;
  onSetQty: (qty: number) => void;
}) {
  const { colors, isDark } = useTheme();
  const lineBg = isDark ? "#141414" : "#FFFFFF";
  const btnBg = isDark ? "#2C2C2C" : "#FFFFFF";
  const btnBorder = isDark ? "#3D3D3D" : "#E0E0E0";

  return (
    <View style={[styles.lineCard, { backgroundColor: lineBg, borderColor: colors.border }]}>
      <Image source={{ uri: item.image || "https://via.placeholder.com/90x90" }} style={styles.lineImage} />
      <View style={{ flex: 1 }}>
        <View style={styles.lineTop}>
          <View style={{ flex: 1, paddingEnd: 8 }}>
            <Text style={[styles.lineName, { color: colors.text }]}>{item.name}</Text>
            <Text style={styles.lineCat}>نوع رياضي</Text>
            <Text style={[styles.linePrice, { color: colors.textSecondary }]}>{formatIqd(item.price)}</Text>
          </View>
          <Pressable onPress={onRemove} hitSlop={10} style={styles.trashHit}>
            <Ionicons name="trash-outline" size={22} color="#E53935" />
          </Pressable>
        </View>
        <View style={styles.qtyRow}>
          <View style={styles.qtyStepper}>
            <Pressable style={[styles.smallBtn, { backgroundColor: btnBg, borderColor: btnBorder }]} onPress={() => onSetQty(Math.max(1, item.qty - 1))}>
              <Text style={[styles.smallBtnTxt, { color: colors.text }]}>−</Text>
            </Pressable>
            <Text style={[styles.qtyVal, { color: colors.text }]}>{item.qty}</Text>
            <Pressable style={[styles.smallBtn, { backgroundColor: btnBg, borderColor: btnBorder }]} onPress={() => onSetQty(item.qty + 1)}>
              <Text style={[styles.smallBtnTxt, { color: colors.text }]}>+</Text>
            </Pressable>
          </View>
          <Text style={[styles.lineTotal, { color: colors.text }]} numberOfLines={1}>
            Line total: {formatIqd(item.price * item.qty)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontFamily: "Cairo_600SemiBold", lineHeight: 24 },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  lineCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  lineTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  trashHit: { padding: 2 },
  lineImage: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#EEE" },
  lineName: { fontSize: 15, fontFamily: "Cairo_600SemiBold", lineHeight: 22 },
  lineCat: { fontSize: 12, fontFamily: "Cairo_400Regular", color: Colors.primary, lineHeight: 18, marginTop: 2 },
  linePrice: { fontSize: 14, fontFamily: "Cairo_600SemiBold", lineHeight: 20, marginTop: 4 },
  qtyRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  qtyStepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  smallBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnTxt: { fontSize: 18, lineHeight: 22, fontFamily: "Cairo_600SemiBold" },
  qtyVal: { minWidth: 28, textAlign: "center", fontSize: 16, fontFamily: "Cairo_600SemiBold" },
  lineTotal: { fontSize: 13, fontFamily: "Cairo_600SemiBold", flex: 1 },
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
  orderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 140,
    height: 48,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBtnTxt: { color: "#fff", fontSize: 15, fontFamily: "Cairo_600SemiBold", lineHeight: 22 },
  total: { fontSize: 14, fontFamily: "Cairo_600SemiBold", flex: 1, flexShrink: 1 },
});
