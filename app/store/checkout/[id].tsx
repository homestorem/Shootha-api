import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { formatIqd } from "@/lib/format-currency";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { useStoreCart } from "@/context/StoreCartContext";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreById } from "@/lib/firestore-marketplace";
import { STORE_DELIVERY_FEE, encodeCheckoutPayload } from "@/lib/store-checkout";

export default function StoreCheckoutScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, storeId, total } = useStoreCart();
  const [notes, setNotes] = useState("");
  const [addressText, setAddressText] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Math.max(insets.bottom, 12);

  const storeQuery = useQuery({
    queryKey: ["store", id],
    enabled: Boolean(id),
    queryFn: () => fetchStoreById(String(id)),
  });
  const store = storeQuery.data;
  const cartItems = store && storeId === store.id ? items : [];

  const subtotal = Math.round(total);
  const deliveryFee = STORE_DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  const customerName = user?.name?.trim() || "";
  const customerPhone = user?.phone?.trim() || "";

  const onConfirm = () => {
    if (!store || !cartItems.length) {
      Alert.alert("تنبيه", "السلة فارغة.");
      return;
    }
    if (!customerName || !customerPhone) {
      Alert.alert("تنبيه", "يرجى إكمال الاسم ورقم الهاتف من الملف الشخصي.");
      return;
    }
    if (!addressText.trim()) {
      Alert.alert("تنبيه", "أدخل عنوان التوصيل.");
      return;
    }
    const payload = encodeCheckoutPayload({
      storeId: store.id,
      storeName: store.name,
      customerName,
      customerPhone,
      addressText: addressText.trim(),
      notes: notes.trim(),
      items: cartItems,
      subtotal,
      deliveryFee,
      total: grandTotal,
    });
    router.push((`/store/payment/${store.id}?payload=${payload}` as never));
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#F7F8FA" }]}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 6, paddingHorizontal: 16, paddingBottom: bottomInset + 110 }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>فاتورة الطلب</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>المنتجات المضافة</Text>
          {cartItems.map((it) => (
            <View key={it.productId} style={styles.row}>
              <Text style={[styles.rowValue, { color: colors.text }]}>{formatIqd(it.price * it.qty)}</Text>
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {it.name} × {it.qty}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>بيانات الزبون</Text>
          <View style={styles.row}>
            <Text style={[styles.rowValue, { color: colors.text }]}>{customerName || "-"}</Text>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>الاسم</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowValue, { color: colors.text }]}>{customerPhone || "-"}</Text>
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>رقم الهاتف</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>عنوان التوصيل</Text>
          <TextInput
            value={addressText}
            onChangeText={setAddressText}
            placeholder="المنطقة، أقرب معلم، تفاصيل العنوان..."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.addressInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "#1A1A1A" : "#FAFAFA" }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>ملاحظات</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="أضف ملاحظة للطلب (اختياري)"
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "#1A1A1A" : "#FAFAFA" }]}
          />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: isDark ? "#0D0D0D" : "#fff", borderTopColor: colors.border, paddingBottom: bottomInset + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.totalRow, { color: colors.textSecondary }]}>Subtotal: {formatIqd(subtotal)}</Text>
          <Text style={[styles.totalRow, { color: colors.textSecondary }]}>Delivery: {formatIqd(deliveryFee)}</Text>
          <Text style={[styles.grand, { color: colors.text }]}>Total: {formatIqd(grandTotal)}</Text>
        </View>
        <Pressable style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmTxt}>تأكيد ومتابعة الدفع</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerTitle: { fontSize: 17, fontFamily: "Cairo_600SemiBold" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginBottom: 10 },
  secTitle: { fontSize: 14, fontFamily: "Cairo_600SemiBold", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 },
  rowLabel: { fontSize: 13, fontFamily: "Cairo_400Regular", flexShrink: 1, textAlign: "right" },
  rowValue: { fontSize: 13, fontFamily: "Cairo_600SemiBold", flexShrink: 1 },
  addressInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 88,
    textAlignVertical: "top",
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
  },
  notes: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minHeight: 82, textAlignVertical: "top", fontFamily: "Cairo_400Regular", fontSize: 13 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, direction: "ltr", flexDirection: "row", alignItems: "center", gap: 12 },
  totalRow: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  grand: { fontSize: 14, fontFamily: "Cairo_600SemiBold", marginTop: 2 },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: 12, minWidth: 150, height: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  confirmTxt: { color: "#fff", fontSize: 13, fontFamily: "Cairo_600SemiBold" },
});
