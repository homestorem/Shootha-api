import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { createPendingMarketplaceOrder } from "@/lib/firestore-marketplace";
import { decodeCheckoutPayload } from "@/lib/store-checkout";
import { triggerWaylPaymentAndRedirect } from "@/lib/wayl-api";
import { formatIqd } from "@/lib/format-currency";

export default function StorePayCardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const checkout = decodeCheckoutPayload(payload);

  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 16 : insets.top;

  const onContinue = async () => {
    if (!checkout || !user || user.id === "guest") return;
    setLoading(true);
    try {
      const orderId = await createPendingMarketplaceOrder({
        userId: user.id,
        storeId: checkout.storeId,
        storeName: checkout.storeName,
        items: checkout.items,
        subtotal: checkout.subtotal,
        deliveryFee: checkout.deliveryFee,
        total: checkout.total,
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        customerAddress: checkout.addressText,
        customerLocation: typeof checkout.lat === "number" && typeof checkout.lon === "number" ? { lat: checkout.lat, lon: checkout.lon } : null,
        notes: checkout.notes,
      });

      const successUrl = ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "success",
          paymentType: "product",
          orderId,
          amount: String(checkout.total),
          venueName: checkout.storeName,
          description: `Store purchase from ${checkout.storeName}`,
          customerName: checkout.customerName,
          customerPhone: checkout.customerPhone,
        },
      });
      const cancelUrl = ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "failure",
          paymentType: "product",
          orderId,
          amount: String(checkout.total),
          venueName: checkout.storeName,
          description: `Store purchase from ${checkout.storeName}`,
          customerName: checkout.customerName,
          customerPhone: checkout.customerPhone,
        },
      });

      console.log("FINAL AMOUNT SENT:", checkout.total);
      await triggerWaylPaymentAndRedirect({
        amount: checkout.total,
        description: `Store purchase from ${checkout.storeName}`,
        customer_details: {
          name: checkout.customerName,
          phone: checkout.customerPhone,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: "product",
          orderId,
          storeId: checkout.storeId,
        },
      });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر إنشاء الطلب");
    } finally {
      setLoading(false);
    }
  };

  if (!checkout) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>بيانات الدفع غير متاحة</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>الدفع بالبطاقة</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={[styles.amount, { color: colors.text }]}>Total Amount: {formatIqd(checkout.total)}</Text>
        <Text style={[styles.info, { color: colors.textSecondary }]}>
          سيتم تحويلك إلى بوابة الدفع الآمنة لإدخال معلومات البطاقة.
        </Text>
        <Pressable style={[styles.payBtn, loading && { opacity: 0.7 }]} disabled={loading} onPress={onContinue}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payTxt}>متابعة إلى بوابة الدفع</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontFamily: "Cairo_600SemiBold" },
  amount: { fontSize: 15, fontFamily: "Cairo_600SemiBold", marginBottom: 12 },
  info: { fontSize: 14, fontFamily: "Cairo_400Regular", marginBottom: 14, lineHeight: 22 },
  payBtn: { backgroundColor: Colors.primary, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center", marginTop: 4 },
  payTxt: { color: "#fff", fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
