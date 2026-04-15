import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useStoreCart } from "@/context/StoreCartContext";
import { createMarketplaceOrder } from "@/lib/firestore-marketplace";
import { decodeCheckoutPayload, encodeCheckoutPayload } from "@/lib/store-checkout";
import { Colors } from "@/constants/colors";
import { formatIqd } from "@/lib/format-currency";

type Method = "cash" | "card" | "wallet";

export default function StorePaymentScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { clearCart } = useStoreCart();
  const { id, payload: payloadParam } = useLocalSearchParams<{ id: string; payload?: string | string[] }>();
  const payloadStr = Array.isArray(payloadParam) ? payloadParam[0] : payloadParam;
  const [method, setMethod] = useState<Method>("card");
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Math.max(insets.bottom, 12);
  const checkout = useMemo(() => decodeCheckoutPayload(payloadStr), [payloadStr]);

  useEffect(() => {
    if (checkout) {
      setCustomerName(checkout.customerName);
      setCustomerPhone(checkout.customerPhone);
    }
  }, [checkout]);

  const submitCash = async () => {
    if (!checkout || !user || user.id === "guest") {
      Alert.alert("تنبيه", "تعذر تحميل بيانات الطلب.");
      return;
    }
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      Alert.alert("تنبيه", "أدخل الاسم ورقم الهاتف.");
      return;
    }
    setSubmitting(true);
    try {
      await createMarketplaceOrder({
        userId: user.id,
        storeId: checkout.storeId,
        storeName: checkout.storeName,
        items: checkout.items,
        subtotal: checkout.subtotal,
        deliveryFee: checkout.deliveryFee,
        total: checkout.total,
        paymentMethod: "cash",
        customerName: name,
        customerPhone: phone,
        customerAddress: checkout.addressText,
        customerLocation:
          typeof checkout.lat === "number" && typeof checkout.lon === "number"
            ? { lat: checkout.lat, lon: checkout.lon }
            : null,
        notes: checkout.notes,
      });
      clearCart();
      Alert.alert("تم تأكيد الطلب", "طريقة الدفع: نقداً عند الاستلام", [
        { text: "حسناً", onPress: () => router.replace("/(tabs)/store") },
      ]);
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  const onPayNow = () => {
    if (!checkout) {
      Alert.alert("تنبيه", "بيانات الطلب غير صالحة.");
      return;
    }
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name || !phone) {
      Alert.alert("تنبيه", "أدخل الاسم ورقم الهاتف.");
      return;
    }
    if (method === "cash") {
      void submitCash();
      return;
    }
    const encoded = encodeCheckoutPayload({
      ...checkout,
      customerName: name,
      customerPhone: phone,
    });
    if (method === "card") {
      router.push((`/store/pay-card/${String(id)}?payload=${encoded}` as never));
      return;
    }
    router.push((`/store/pay-wallet/${String(id)}?payload=${encoded}` as never));
  };

  if (!checkout) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? "#000" : "#fff", paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.text }]}>تعذر فتح صفحة الدفع</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#000" : "#F7F8FA" }]}>
      <ScrollView contentContainerStyle={{ paddingTop: topPad + 6, paddingHorizontal: 16, paddingBottom: bottomInset + 110 }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>الدفع</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>فاتورة الدفع</Text>
          <Info label="المتجر" value={checkout.storeName} colors={colors} />
          <InvoiceField
            label="الزبون"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="الاسم الكامل"
            colors={colors}
            isDark={isDark}
          />
          <InvoiceField
            label="الهاتف"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="رقم الجوال"
            colors={colors}
            isDark={isDark}
            keyboardType="phone-pad"
          />
          <Info label="العنوان" value={checkout.addressText} colors={colors} />
          {!!checkout.notes && <Info label="الملاحظات" value={checkout.notes} colors={colors} />}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Info label="Subtotal" value={formatIqd(checkout.subtotal)} colors={colors} />
          <Info label="Delivery" value={formatIqd(checkout.deliveryFee)} colors={colors} />
          <Info label="Total" value={formatIqd(checkout.total)} colors={colors} strong />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? "#121212" : "#fff", borderColor: colors.border }]}>
          <Text style={[styles.secTitle, { color: colors.text }]}>اختر طريقة الدفع</Text>
          <PayOption label="نقداً عند الاستلام" active={method === "cash"} textColor={colors.text} onPress={() => setMethod("cash")} />
          <PayOption label="Wayl Checkout" active={method === "card"} textColor={colors.text} onPress={() => setMethod("card")} />
          <PayOption label="من المحفظة" active={method === "wallet"} textColor={colors.text} onPress={() => setMethod("wallet")} />
        </View>
      </ScrollView>

      <View style={[styles.bottom, { backgroundColor: isDark ? "#0D0D0D" : "#fff", borderTopColor: colors.border, paddingBottom: bottomInset + 8 }]}>
        <Text style={[styles.amount, { color: colors.text }]}>Total Amount: {formatIqd(checkout.total)}</Text>
        <Pressable style={[styles.payBtn, submitting && { opacity: 0.7 }]} disabled={submitting} onPress={onPayNow}>
          <Text style={styles.payTxt}>ادفع الآن</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Info({
  label,
  value,
  colors,
  strong = false,
}: {
  label: string;
  value: string;
  colors: { text: string; textSecondary: string };
  strong?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoVal, { color: colors.text }, strong && { fontFamily: "Cairo_700Bold" }]}>{value}</Text>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function InvoiceField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  isDark,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: { text: string; textSecondary: string; border: string; textTertiary?: string };
  isDark: boolean;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View style={styles.invoiceFieldRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary, alignSelf: "flex-start", marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary ?? "#999"}
        keyboardType={keyboardType}
        style={[
          styles.invoiceInput,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? "#1A1A1A" : "#FAFAFA",
          },
        ]}
      />
    </View>
  );
}

function PayOption({
  label,
  active,
  onPress,
  textColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  textColor: string;
}) {
  return (
    <Pressable style={[styles.option, active && styles.optionActive]} onPress={onPress}>
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? Colors.primary : "#A3A3A3"} />
      <Text style={[styles.optionTxt, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 17, fontFamily: "Cairo_600SemiBold" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginBottom: 10 },
  secTitle: { fontSize: 14, fontFamily: "Cairo_600SemiBold", marginBottom: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  infoLabel: { fontSize: 12, fontFamily: "Cairo_400Regular" },
  infoVal: { fontSize: 13, fontFamily: "Cairo_600SemiBold", flex: 1, textAlign: "left" },
  invoiceFieldRow: { marginBottom: 10 },
  invoiceInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
    width: "100%",
  },
  divider: { height: 1, marginVertical: 8 },
  option: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, minHeight: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  optionActive: { borderColor: Colors.primary, backgroundColor: "#ECFDF5" },
  optionTxt: { fontSize: 13, fontFamily: "Cairo_600SemiBold", color: "#111827" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", direction: "ltr", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 10 },
  amount: { fontSize: 14, fontFamily: "Cairo_600SemiBold" },
  payBtn: { backgroundColor: Colors.primary, borderRadius: 12, minWidth: 130, height: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  payTxt: { color: "#fff", fontSize: 14, fontFamily: "Cairo_600SemiBold" },
});
