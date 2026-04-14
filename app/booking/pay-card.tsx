import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import {
  formatPrice,
  formatDurationAr,
} from "@/context/BookingsContext";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { Colors } from "@/constants/colors";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { createPendingBookingInFirestore, isFirebaseBookingsEnabled } from "@/lib/firestore-bookings";
import { triggerWaylPaymentAndRedirect } from "@/lib/wayl-api";
import { RANDOM_MATCH_MAX_PLAYERS } from "@/context/RandomMatchContext";

export default function BookingPayCardScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isGuest, user } = useAuth();
  const { promptLogin } = useGuestPrompt();
  const queryClient = useQueryClient();

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
    return Number.isFinite(n) ? n : 0;
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

  const [paying, setPaying] = useState(false);
  /** مباراة عشوائية: دفع كامل (انضمام مجاني) أو تقسيم الحصص على اللاحقين */
  const [rmPricing, setRmPricing] = useState<"split" | "full">("split");
  const fromRandomMatchFlow = params.fromRandomMatch === "1";
  const ownerShareAmount = useMemo(() => {
    if (!fromRandomMatchFlow) return amountNum;
    return Math.max(1, Math.round(amountNum / RANDOM_MATCH_MAX_PLAYERS));
  }, [amountNum, fromRandomMatchFlow]);
  const payableAmount = fromRandomMatchFlow && rmPricing === "split" ? ownerShareAmount : amountNum;

  const onPay = async () => {
    if (isGuest && !GUEST_FULL_ACCESS) {
      promptLogin();
      return;
    }
    if (!validParams || !params.venueId || !params.venueName || !params.date || !params.time) {
      Alert.alert("بيانات ناقصة", "ارجع لصفحة الملعب وأعد اختيار الحجز.");
      return;
    }
    setPaying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!isFirebaseBookingsEnabled()) {
        throw new Error("Firebase is not configured for payment booking flow.");
      }
      if (!user || user.id === "guest") {
        throw new Error("Please login to continue.");
      }

      const bookingId = await createPendingBookingInFirestore({
        venueId: params.venueId,
        playerUserId: user.id,
        playerId: (user.playerId ?? "").trim() || user.id,
        playerName: user.name ?? "Player",
        phone: user.phone ?? "",
        date: params.date,
        startTime: params.time,
        duration: durationNum,
        totalPrice: amountNum,
        venueName: params.venueName,
        fieldSize: params.fieldSize ?? "",
        appPaymentMethod: "card_online",
        paymentPaid: false,
      });

      const successUrl = ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "success",
          paymentType: "stadium",
          bookingId,
          amount: String(payableAmount),
          venueName: String(params.venueName),
        },
      });

      const cancelUrl = ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "failure",
          paymentType: "stadium",
          bookingId,
          amount: String(payableAmount),
          venueName: String(params.venueName),
          description: `Booking at ${params.venueName}`,
          customerName: String(user.name ?? "Customer"),
          customerPhone: String(user.phone ?? ""),
        },
      });

      console.log("FINAL AMOUNT SENT:", payableAmount);
      await triggerWaylPaymentAndRedirect({
        amount: payableAmount,
        description: `Booking at ${params.venueName} (${params.date} ${params.time})`,
        customer_details: {
          name: String(user.name ?? "Customer"),
          phone: String(user.phone ?? ""),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: "stadium",
          bookingId,
          venueName: params.venueName,
          date: params.date,
          time: params.time,
          pricingMode: fromRandomMatchFlow ? rmPricing : "full",
          totalBookingAmount: amountNum,
          ownerPaidAmount: payableAmount,
        },
      });

      if (params.venueId && !String(params.venueId).startsWith("exp-")) {
        queryClient.invalidateQueries({ queryKey: ["venue-day", params.venueId] });
      }
    } catch (e) {
      Alert.alert("تعذر الحجز", e instanceof Error ? e.message : "حاول مرة أخرى.");
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
        <Text style={[styles.errSub, { color: colors.textSecondary }]}>ارجع للملعب واختر الوقت ثم الدفع بالبطاقة.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Card checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Total Amount (charged)</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>{formatPrice(payableAmount)}</Text>
          <Text style={[styles.venueLine, { color: colors.text }]} numberOfLines={2}>
            {params.venueName}
          </Text>
          <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
            {params.date} — {params.time} — {formatDurationAr(durationNum)}
          </Text>
        </View>

        {fromRandomMatchFlow && (
          <View style={{ marginBottom: 16, gap: 10 }}>
            <Text style={[styles.rmSectionTitle, { color: colors.text }]}>طريقة المشاركة</Text>
            <Text style={[styles.rmSectionSub, { color: colors.textSecondary }]}>
              أنت تدفع إجمالي الحجز الآن. اختر كيف تُعرض المباراة للمندمجين.
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
                  من يضمّ للمباراة من التطبيق لا يدفع (انضمام مجاني).
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
                  يُعرض حصة كل لاعب؛ المندمج يدفع حصته إلكترونياً عند الانضمام.
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
            { backgroundColor: Colors.primary },
            paying && { opacity: 0.75 },
          ]}
          onPress={onPay}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={20} color="#000" />
              <Text style={styles.payBtnText}>Pay Now {formatPrice(payableAmount)}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 20,
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
  amountCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  amountValue: {
    fontSize: 28,
    fontFamily: "Cairo_700Bold",
    marginTop: 6,
  },
  venueLine: {
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 12,
  },
  metaLine: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginTop: 4,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  payBtnText: {
    color: "#000",
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
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
