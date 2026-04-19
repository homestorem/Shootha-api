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
  Modal,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useBookings, formatPrice, formatDate, formatDurationAr } from "@/context/BookingsContext";
import {
  useRandomMatch,
  RANDOM_MATCH_MAX_PLAYERS,
  type RandomMatchItem,
} from "@/context/RandomMatchContext";
import { useLang } from "@/context/LanguageContext";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { Colors } from "@/constants/colors";
import { fetchWallet, payFromWallet, formatIqd } from "@/lib/wallet-api";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import {
  isFirebaseBookingsEnabled,
  createPendingBookingInFirestore,
  confirmBookingPaymentInFirestore,
  failPendingBookingPaymentInFirestore,
} from "@/lib/firestore-bookings";
import { getLocationForBooking, requireLocationForBooking } from "@/lib/bookingLocation";
import { isBookingWallStartInPastForLocalCalendarDate } from "@/lib/booking-datetime-guard";

export default function BookingPayWalletScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token, isGuest, user, refreshPlayerFromFirestore } = useAuth();
  const { latitude: ctxLat, longitude: ctxLon, hasPermission: locPermission } = useLocation();
  const { promptLogin } = useGuestPrompt();
  const { updateBooking } = useBookings();
  const { addMatch } = useRandomMatch();
  const queryClient = useQueryClient();
  const { t } = useLang();

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
  const [showSuccessShare, setShowSuccessShare] = useState(false);
  const [shareBundle, setShareBundle] = useState<{
    venueId: string;
    venueName: string;
    fieldSize: string;
    date: string;
    time: string;
    duration: number;
    price: number;
    bookingId: string;
    match: RandomMatchItem | null;
  } | null>(null);

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

  const handleShareBooking = async () => {
    if (!shareBundle) return;
    const { venueName, fieldSize, date, time, duration, price } = shareBundle;
    const dateStr = formatDate(date);
    const message = t("booking.shareMessage", {
      venue: venueName,
      date: dateStr,
      time,
      duration: formatDurationAr(duration),
      field: fieldSize?.trim() ? fieldSize : "—",
      price: formatPrice(price),
    });
    try {
      await Share.share({
        message,
        title: t("booking.shareTitle"),
      });
    } catch {
      /* إلغاء المشاركة */
    }
  };

  const closeSuccessAndGoBookings = () => {
    setShowSuccessShare(false);
    setShareBundle(null);
    router.replace("/(tabs)/bookings");
  };

  const sufficient = balance !== null && balance >= payableAmount;
  const shortfall = balance !== null ? Math.max(0, payableAmount - balance) : null;

  const resolveCoordsForBooking = useCallback(async (): Promise<{ lat: number; lon: number }> => {
    if (Platform.OS === "web") {
      return { lat: ctxLat, lon: ctxLon };
    }
    const precise = await getLocationForBooking();
    if (precise) return precise;
    if (
      locPermission === true &&
      Number.isFinite(ctxLat) &&
      Number.isFinite(ctxLon)
    ) {
      return { lat: ctxLat, lon: ctxLon };
    }
    return requireLocationForBooking();
  }, [ctxLat, ctxLon, locPermission]);

  const onPay = async () => {
    if (!allowWallet) {
      promptLogin();
      return;
    }
    if (!validParams || !params.venueId || !params.venueName || !params.date || !params.time) {
      Alert.alert("بيانات ناقصة", "ارجع لصفحة الملعب وأعد اختيار الحجز.");
      return;
    }
    if (isBookingWallStartInPastForLocalCalendarDate(String(params.date), String(params.time))) {
      Alert.alert(
        "الوقت غير صالح",
        "لا يمكن حجز وقت قد مضى. ارجع لصفحة الملعب واختر وقتاً قادماً.",
      );
      return;
    }
    if (!sufficient) {
      Alert.alert("رصيد غير كافٍ", "شحن المحفظة بالمبلغ المطلوب ثم أعد المحاولة.");
      return;
    }
    if (!user?.id || user.id === "guest" || user.role === "guest") {
      promptLogin();
      return;
    }
    if (!isFirebaseBookingsEnabled()) {
      Alert.alert("تنبيه", "Firebase غير مُضبط — لا يمكن حفظ الحجز في السحابة.");
      return;
    }
    let playerId = (user.playerId ?? "").trim();
    if (!playerId) {
      const synced = await refreshPlayerFromFirestore();
      playerId = (synced ?? "").trim();
    }
    if (!playerId) {
      Alert.alert("تنبيه", "جارٍ مزامنة معرّف حسابك. انتظر قليلاً ثم أعد المحاولة.");
      return;
    }
    if (String(params.venueId).startsWith("exp-")) {
      Alert.alert("تنبيه", "الملاعب التجريبية لا تدعم الحفظ في السحابة.");
      return;
    }

    const label = `دفع حجز — ${params.venueName} — ${params.date} ${params.time}`;

    setPaying(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* */
    }

    let pendingId: string | null = null;
    try {
      const coords = await resolveCoordsForBooking();
      pendingId = await createPendingBookingInFirestore({
        venueId: params.venueId,
        playerUserId: user.id,
        playerId,
        playerName: user.name ?? "لاعب",
        phone: user.phone ?? "",
        date: params.date,
        startTime: params.time,
        duration: durationNum,
        totalPrice: amountNum,
        venueName: params.venueName,
        fieldSize: params.fieldSize ?? "",
        appPaymentMethod: "wallet",
        paymentPaid: false,
        playerLat: coords.lat,
        playerLon: coords.lon,
        ...(fromRandomMatchFlow ? { skipTimeConflictCheck: true } : {}),
      });

      await payFromWallet(walletToken, payableAmount, label, {
        userId: user.id,
        bookingId: pendingId,
        idempotencyKey: `pay-booking:${pendingId}:${payableAmount}`,
      });

      await confirmBookingPaymentInFirestore(pendingId);

      if (params.venueId && !String(params.venueId).startsWith("exp-")) {
        queryClient.invalidateQueries({ queryKey: ["venue-day", params.venueId] });
      }
      let matchItem: RandomMatchItem | null = null;
      if (params.fromRandomMatch === "1") {
        matchItem = addMatch({
          venueId: params.venueId,
          venueName: params.venueName,
          time: params.time,
          date: params.date,
          totalPrice: amountNum,
          bookingId: pendingId,
          pricingMode: rmPricing === "full" ? "full_prepaid" : "split",
          organizerName: user?.name,
          durationHours: durationNum,
          fieldSize: params.fieldSize,
        });
        updateBooking(pendingId, { randomMatchId: matchItem.id });
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* */
      }
      setShareBundle({
        venueId: params.venueId,
        venueName: params.venueName,
        fieldSize: params.fieldSize ?? "",
        date: params.date,
        time: params.time,
        duration: durationNum,
        price: amountNum,
        bookingId: pendingId,
        match: matchItem,
      });
      setShowSuccessShare(true);
    } catch (e) {
      if (pendingId) {
        await failPendingBookingPaymentInFirestore(pendingId, "wallet_pay_failed").catch(() => {});
      }
      Alert.alert("تعذر إتمام الحجز", e instanceof Error ? e.message : "حاول مرة أخرى.");
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

      <Modal visible={showSuccessShare} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>تم الحجز بنجاح!</Text>
            <Text style={[styles.successSub, { color: colors.textSecondary }]}>
              تم خصم {formatPrice(payableAmount)} من المحفظة. يمكنك مشاركة تفاصيل الحجز مع من تريد.
            </Text>
            <Pressable style={[styles.shareMatchBtn, { backgroundColor: colors.primary }]} onPress={handleShareBooking}>
              <Ionicons name="share-social" size={22} color="#000" />
              <Text style={styles.shareMatchBtnText}>مشاركة تفاصيل الحجز</Text>
            </Pressable>
            <Pressable
              style={[styles.successDoneBtn, { borderColor: colors.border }]}
              onPress={closeSuccessAndGoBookings}
            >
              <Text style={[styles.successDoneText, { color: colors.text }]}>عرض حجوزاتي</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
  },
  successIconWrap: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  shareMatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  shareMatchBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  successDoneBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  successDoneText: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
});
