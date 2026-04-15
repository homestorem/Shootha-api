import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  useBookings,
  formatPrice,
  formatDate,
  formatDurationAr,
  type Booking,
} from "@/context/BookingsContext";
import { useRandomMatch, RANDOM_MATCH_MAX_PLAYERS } from "@/context/RandomMatchContext";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { Colors } from "@/constants/colors";
import { fetchWallet, payFromWallet, formatIqd } from "@/lib/wallet-api";
import { useGuestPrompt } from "@/context/GuestPromptContext";

export default function BookingPayWalletScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token, isGuest, user } = useAuth();
  const { promptLogin } = useGuestPrompt();
  const { addBooking } = useBookings();
  const { addMatch } = useRandomMatch();
  const queryClient = useQueryClient();

  const allowWallet =
    (!!user && !isGuest) || (GUEST_FULL_ACCESS && isGuest);
  const walletToken: string | null = isGuest ? null : token;

  const params = useLocalSearchParams<{
    amount?: string;
    venueId?: string;
    venueName?: string;
    date?: string;
    time?: string;
    duration?: string;
    fieldSize?: string;
    fromRandomMatch?: string;
  }>();

  const amountNum = useMemo(() => {
    const n = parseFloat(String(params.amount ?? "0"));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [params.amount]);
  const durationNum = useMemo(() => {
    const n = parseFloat(String(params.duration ?? "1"));
    return Number.isFinite(n) ? n : 1;
  }, [params.duration]);

  const validParams =
    !!params.venueId &&
    !!params.venueName &&
    !!params.date &&
    !!params.time &&
    amountNum > 0;

  const invoiceRef = useMemo(() => `INV-${Date.now().toString(36).toUpperCase()}`, []);

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [rmPricing, setRmPricing] = useState<"split" | "full">("split");

  const fromRandomMatchFlow = params.fromRandomMatch === "1";
  const ownerShareAmount = useMemo(() => {
    if (!fromRandomMatchFlow) return amountNum;
    return Math.max(1, Math.round(amountNum / RANDOM_MATCH_MAX_PLAYERS));
  }, [amountNum, fromRandomMatchFlow]);
  const payableAmount =
    fromRandomMatchFlow && rmPricing === "split" ? ownerShareAmount : amountNum;

  const loadBalance = useCallback(async () => {
    if (!allowWallet) {
      setBalance(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchWallet(walletToken, 5, {
        userId: user?.id && user.id !== "guest" ? user.id : undefined,
      });
      setBalance(data.balance);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowWallet, walletToken, user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadBalance();
    }, [loadBalance]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBalance();
  };

  const sufficient = balance !== null && balance >= payableAmount;
  const shortfall = balance !== null ? Math.max(0, payableAmount - balance) : null;

  const onPay = async () => {
    if (!allowWallet) {
      promptLogin();
      return;
    }
    if (!validParams || !params.venueId || !params.venueName || !params.date || !params.time) {
      Alert.alert("بيانات ناقصة", "ارجع لصفحة الملعب وأعد اختيار الحجز.");
      return;
    }
    if (!sufficient) {
      Alert.alert("رصيد غير كافٍ", "شحن المحفظة بالمبلغ المطلوب ثم أعد المحاولة.");
      return;
    }

    const label = `دفع حجز — ${params.venueName} — ${params.date} ${params.time}`;

    setPaying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      console.log("FINAL AMOUNT SENT:", payableAmount);
      await payFromWallet(walletToken, payableAmount, label, {
        userId: user?.id && user.id !== "guest" ? user.id : undefined,
        bookingId: null,
        idempotencyKey: invoiceRef,
      });
    } catch (e) {
      setPaying(false);
      Alert.alert("تعذر الخصم", e instanceof Error ? e.message : "حاول مرة أخرى.");
      return;
    }

    const newBooking: Booking = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
      venueId: params.venueId,
      venueName: params.venueName,
      fieldSize: params.fieldSize ?? "",
      date: params.date,
      time: params.time,
      duration: durationNum,
      price: amountNum,
      status: "upcoming",
      players: [{ id: "p_me", name: "أنا", paid: true }],
      createdAt: new Date().toISOString(),
    };

    try {
      await addBooking(newBooking, {
        paymentMethod: "wallet",
        paymentPaid: true,
      });
      if (params.venueId && !String(params.venueId).startsWith("exp-")) {
        queryClient.invalidateQueries({ queryKey: ["venue-day", params.venueId] });
      }
      if (params.fromRandomMatch === "1") {
        addMatch({
          venueId: params.venueId,
          venueName: params.venueName,
          time: params.time,
          date: params.date,
          totalPrice: amountNum,
          pricingMode: rmPricing === "full" ? "full_prepaid" : "split",
          organizerName: user?.name,
          durationHours: durationNum,
          fieldSize: params.fieldSize,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم الدفع والحجز", `تم خصم ${formatPrice(payableAmount)} من المحفظة وتأكيد حجزك.`, [
        { text: "حسناً", onPress: () => router.replace("/(tabs)/bookings") },
      ]);
    } catch {
      Alert.alert(
        "تنبيه",
        "تم الخصم من المحفظة لكن تعذر حفظ الحجز. راجع حجوزاتك أو الدعم.",
      );
    } finally {
      setPaying(false);
    }
  };

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  if (!validParams) {
    return (
      <View style={[styles.center, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.errTitle, { color: colors.text }]}>بيانات الحجز غير مكتملة</Text>
        <Text style={[styles.errSub, { color: colors.textSecondary }]}>ارجع للملعب واختر الوقت ثم الدفع بالمحفظة.</Text>
      </View>
    );
  }

  if (!allowWallet) {
    return (
      <View style={[styles.center, { paddingTop: topPad, backgroundColor: colors.background, paddingHorizontal: 24 }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.surface, alignSelf: "flex-start" }]} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.errTitle, { color: colors.text }]}>المحفظة</Text>
        <Text style={[styles.errSub, { color: colors.textSecondary }]}>سجّل الدخول لاستخدام المحفظة الإلكترونية.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad + 8,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الدفع بالمحفظة</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* رصيد */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>رصيد المحفظة الحالي</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 10 }} color={Colors.primary} />
        ) : (
          <Text style={[styles.balanceBig, { color: colors.text }]}>{balance !== null ? formatIqd(balance) : "—"}</Text>
        )}
        {balance !== null && !loading && (
          <View
            style={[
              styles.suffRow,
              { backgroundColor: sufficient ? "rgba(46,204,113,0.12)" : "rgba(231,76,60,0.12)" },
            ]}
          >
            <Ionicons
              name={sufficient ? "checkmark-circle" : "alert-circle"}
              size={20}
              color={sufficient ? "#2ecc71" : "#e74c3c"}
            />
            <Text style={[styles.suffText, { color: sufficient ? "#27ae60" : "#c0392b" }]}>
              {sufficient ? "الرصيد كافٍ لإتمام الدفع" : `الرصيد غير كافٍ — يُفقد ${formatPrice(shortfall ?? 0)}`}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.rechargeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push("/wallet")}
      >
        <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
        <Text style={[styles.rechargeText, { color: colors.text }]}>شحن المحفظة</Text>
        <Ionicons name="chevron-back" size={18} color={colors.textTertiary} />
      </Pressable>

      {/* فاتورة */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>فاتورة الدفع</Text>
      <View style={[styles.invoice, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.invoiceHeader}>
          <Text style={[styles.invoiceRef, { color: colors.textSecondary }]}>رقم الفاتورة</Text>
          <Text style={[styles.invoiceRefVal, { color: colors.text }]}>{invoiceRef}</Text>
        </View>
        <Text style={[styles.invoiceDate, { color: colors.textTertiary }]}>
          {new Date().toLocaleString("ar-IQ")}
        </Text>

        <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

        <InvoiceRow label="الملعب" value={params.venueName!} colors={colors} />
        <InvoiceRow label="تاريخ الحجز" value={formatDate(params.date!)} colors={colors} />
        <InvoiceRow label="وقت البداية" value={params.time!} colors={colors} />
        <InvoiceRow label="المدة" value={formatDurationAr(durationNum)} colors={colors} />
        {!!params.fieldSize && (
          <InvoiceRow label="حجم الملعب" value={params.fieldSize} colors={colors} />
        )}

        <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total Amount</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>{formatPrice(payableAmount)}</Text>
        </View>
      </View>

      {params.fromRandomMatch === "1" && (
        <View style={{ marginBottom: 16, gap: 10 }}>
          <Text style={[styles.rmSectionTitle, { color: colors.text }]}>طريقة المشاركة</Text>
          <Text style={[styles.rmSectionSub, { color: colors.textSecondary }]}>
            أنت تدفع إجمالي الحجز من المحفظة. اختر كيف تُعرض المباراة للمندمجين.
          </Text>
          <Pressable
            onPress={() => setRmPricing("full")}
            style={[
              styles.rmOption,
              { borderColor: colors.border, backgroundColor: colors.surface },
              rmPricing === "full" && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <Ionicons
              name={rmPricing === "full" ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={rmPricing === "full" ? colors.primary : colors.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rmOptionTitle, { color: colors.text }]}>Full Payment</Text>
              <Text style={[styles.rmOptionSub, { color: colors.textSecondary }]}>
                الانضمام من التطبيق مجاني للآخرين.
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setRmPricing("split")}
            style={[
              styles.rmOption,
              { borderColor: colors.border, backgroundColor: colors.surface },
              rmPricing === "split" && { borderColor: colors.primary, borderWidth: 2 },
            ]}
          >
            <Ionicons
              name={rmPricing === "split" ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={rmPricing === "split" ? colors.primary : colors.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rmOptionTitle, { color: colors.text }]}>Split Payment</Text>
              <Text style={[styles.rmOptionSub, { color: colors.textSecondary }]}>
                يدفع كل منضم حصته إلكترونياً عند الانضمام.
              </Text>
            </View>
          </Pressable>
          {rmPricing === "split" && (
            <Text style={[styles.rmSectionSub, { color: colors.textSecondary }]}>
              Your share now: {formatPrice(ownerShareAmount)} of total {formatPrice(amountNum)}.
            </Text>
          )}
        </View>
      )}

      <Pressable
        style={[
          styles.payBtn,
          { backgroundColor: sufficient ? Colors.primary : colors.disabled },
          (paying || loading || !sufficient) && { opacity: 0.85 },
        ]}
        onPress={onPay}
        disabled={paying || loading || !sufficient}
      >
        {paying ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="wallet" size={20} color="#000" />
            <Text style={styles.payBtnText}>Pay {formatPrice(payableAmount)} from wallet</Text>
          </>
        )}
      </Pressable>

      {!sufficient && balance !== null && !loading && (
        <Text style={[styles.hintBelow, { color: colors.textSecondary }]}>
          زِد رصيدك عبر «شحن المحفظة» أو استخدم بطاقة رصيد حتى يصبح الرصيد كافياً.
        </Text>
      )}
    </ScrollView>
  );
}

function InvoiceRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { text: string; textSecondary: string; border: string };
}) {
  return (
    <View style={styles.invoiceLine}>
      <Text style={[styles.invoiceLineLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.invoiceLineVal, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  errTitle: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    marginTop: 16,
    textAlign: "center",
  },
  errSub: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  balanceBig: {
    fontSize: 26,
    fontFamily: "Cairo_700Bold",
    marginTop: 8,
  },
  suffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
  },
  suffText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  rechargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 22,
  },
  rechargeText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
    marginBottom: 10,
  },
  invoice: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceRef: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  invoiceRefVal: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  invoiceDate: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: "Cairo_400Regular",
  },
  invoiceDivider: {
    height: 1,
    marginVertical: 12,
  },
  invoiceLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  invoiceLineLabel: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    maxWidth: "40%",
  },
  invoiceLineVal: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    flex: 1,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  payBtnText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  hintBelow: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: "center",
    fontFamily: "Cairo_400Regular",
  },
  rmSectionTitle: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  rmSectionSub: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    lineHeight: 20,
  },
  rmOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rmOptionTitle: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  rmOptionSub: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    lineHeight: 18,
    marginTop: 4,
  },
});
