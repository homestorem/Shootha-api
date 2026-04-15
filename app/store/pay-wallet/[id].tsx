import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useStoreCart } from "@/context/StoreCartContext";
import { Colors } from "@/constants/colors";
import { createMarketplaceOrder } from "@/lib/firestore-marketplace";
import { decodeCheckoutPayload } from "@/lib/store-checkout";
import { fetchWallet, payFromWallet, formatIqd } from "@/lib/wallet-api";

export default function StorePayWalletScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token, isGuest } = useAuth();
  const { clearCart } = useStoreCart();
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const checkout = decodeCheckoutPayload(payload);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const walletToken = isGuest ? null : token;
  const amount = useMemo(() => checkout?.total ?? 0, [checkout?.total]);

  const loadBalance = useCallback(async () => {
    try {
      const x = await fetchWallet(walletToken, 5, {
        userId: user?.id && user.id !== "guest" ? user.id : undefined,
      });
      setBalance(x.balance);
    } catch {
      setBalance(null);
    }
  }, [walletToken, user?.id]);

  React.useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const onPay = async () => {
    if (!checkout || !user || user.id === "guest") {
      Alert.alert("تنبيه", "يجب تسجيل الدخول للدفع من المحفظة.");
      return;
    }
    setLoading(true);
    try {
      console.log("FINAL AMOUNT SENT:", amount);
      await payFromWallet(walletToken, amount, `طلب متجر ${checkout.storeName}`, {
        userId: user.id,
        bookingId: null,
        idempotencyKey: `store:${checkout.storeId}:${Date.now()}`,
      });
      await createMarketplaceOrder({
        userId: user.id,
        storeId: checkout.storeId,
        storeName: checkout.storeName,
        items: checkout.items,
        subtotal: checkout.subtotal,
        deliveryFee: checkout.deliveryFee,
        total: checkout.total,
        paymentMethod: "wallet",
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        customerAddress: checkout.addressText,
        customerLocation: typeof checkout.lat === "number" && typeof checkout.lon === "number" ? { lat: checkout.lat, lon: checkout.lon } : null,
        notes: checkout.notes,
      });
      clearCart();
      Alert.alert("تم الدفع", "تم إنشاء الطلب بنجاح.", [{ text: "ممتاز", onPress: () => router.replace("/(tabs)/store") }]);
    } catch (e) {
      Alert.alert("تعذر الدفع", e instanceof Error ? e.message : "فشل الدفع من المحفظة");
    } finally {
      setLoading(false);
    }
  };

  if (!checkout) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>بيانات الدفع غير متاحة</Text></View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: topPad + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>الدفع من المحفظة</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.row, { color: colors.textSecondary }]}>الرصيد الحالي: {balance === null ? "—" : formatIqd(balance)}</Text>
        <Text style={[styles.row, { color: colors.text }]}>Total Amount: {formatIqd(amount)}</Text>
      </View>

      <Pressable style={[styles.payBtn, loading && { opacity: 0.7 }]} onPress={onPay} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payTxt}>تأكيد الدفع من المحفظة</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 17, fontFamily: "Cairo_600SemiBold" },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { fontSize: 14, fontFamily: "Cairo_400Regular", marginBottom: 6 },
  payBtn: { backgroundColor: Colors.primary, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center" },
  payTxt: { color: "#fff", fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
