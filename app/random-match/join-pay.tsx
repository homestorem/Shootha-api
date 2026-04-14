import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useRandomMatch } from "@/context/RandomMatchContext";
import { formatPrice } from "@/context/BookingsContext";
import { Colors } from "@/constants/colors";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import { triggerWaylPaymentAndRedirect } from "@/lib/wayl-api";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatCardInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 16);
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 4) {
    parts.push(d.slice(i, i + 4));
  }
  return parts.join(" ");
}

function formatExpiry(raw: string): string {
  const d = digitsOnly(raw).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** دفع حصة انضمام لمباراة عشوائية (تجريبي) */
export default function RandomMatchJoinPayScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { matches } = useRandomMatch();
  const { user } = useAuth();
  const { guestRestricted, promptLogin } = useGuestPrompt();
  const params = useLocalSearchParams<{
    matchId?: string;
    amount?: string;
    venueName?: string;
  }>();

  const match = useMemo(
    () => matches.find((m) => m.id === params.matchId),
    [matches, params.matchId],
  );

  const amountNum = useMemo(() => {
    const n = parseFloat(String(params.amount ?? "0"));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [params.amount]);

  const accountName = (user?.name?.trim() || "").trim();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [paying, setPaying] = useState(false);

  const valid = !!params.matchId && amountNum > 0 && !!match;

  const onPay = async () => {
    if (guestRestricted) {
      promptLogin();
      return;
    }
    if (!valid || !params.matchId) {
      Alert.alert("بيانات ناقصة", "ارجع لصفحة المباراة وحاول مجدداً.");
      return;
    }
    const num = digitsOnly(cardNumber);
    if (num.length < 15) {
      Alert.alert("رقم البطاقة", "أدخل رقم البطاقة كاملاً.");
      return;
    }
    const exp = digitsOnly(expiry);
    if (exp.length !== 4) {
      Alert.alert("الصلاحية", "أدخل الشهر والسنة (MM/YY).");
      return;
    }
    const m = parseInt(exp.slice(0, 2), 10);
    if (m < 1 || m > 12) {
      Alert.alert("الصلاحية", "الشهر غير صالح.");
      return;
    }
    const cv = digitsOnly(cvv);
    if (cv.length < 3) {
      Alert.alert("رمز الأمان", "أدخل CVV.");
      return;
    }
    if (accountName.length < 2) {
      Alert.alert("الاسم", "يجب أن يكون لديك اسم في الحساب للانضمام.");
      return;
    }

    setPaying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const successUrl =
        `shootha://payment/result?status=success&paymentType=match` +
        `&matchId=${encodeURIComponent(String(params.matchId))}` +
        `&amount=${encodeURIComponent(String(amountNum))}` +
        `&venueName=${encodeURIComponent(String(match.venueName))}` +
        `&playerName=${encodeURIComponent(accountName)}`;

      const cancelUrl =
        `shootha://payment/result?status=failure&paymentType=match` +
        `&matchId=${encodeURIComponent(String(params.matchId))}` +
        `&amount=${encodeURIComponent(String(amountNum))}` +
        `&venueName=${encodeURIComponent(String(match.venueName))}` +
        `&playerName=${encodeURIComponent(accountName)}`;

      console.log("FINAL AMOUNT SENT:", amountNum);
      await triggerWaylPaymentAndRedirect({
        amount: amountNum,
        description: `Join random match at ${match.venueName}`,
        customer_details: {
          name: accountName,
          phone: String(user?.phone ?? ""),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: "match",
          matchId: params.matchId,
          playerName: accountName,
        },
      });
    } catch (e) {
      Alert.alert("تعذر الدفع", e instanceof Error ? e.message : "حاول مرة أخرى.");
    } finally {
      setPaying(false);
    }
  };

  const topPad = Platform.OS === "web" ? 16 : insets.top;

  if (!valid || !match) {
    return (
      <View style={[styles.center, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.errTitle, { color: colors.text }]}>لا يمكن إتمام الدفع</Text>
        <Text style={[styles.errSub, { color: colors.textSecondary }]}>ارجع لقائمة المباريات واختر مباراة صالحة.</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>دفع حصة الانضمام</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.amountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Total Amount</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>{formatPrice(amountNum)}</Text>
          <Text style={[styles.venueLine, { color: colors.text }]} numberOfLines={2}>
            {match.venueName}
          </Text>
        </View>

        <Text style={[styles.note, { color: colors.textTertiary }]}>
          Your seat is confirmed only after successful card payment (Pay Now).
        </Text>

        <View style={[styles.nameRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.labelInline, { color: colors.textSecondary }]}>الاسم (من حسابك)</Text>
          <Text style={[styles.nameLocked, { color: colors.text }]}>
            {accountName.length > 0 ? accountName : "— غير متوفر —"}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>رقم البطاقة</Text>
        <TextInput
          value={cardNumber}
          onChangeText={(t) => setCardNumber(formatCardInput(t))}
          placeholder="0000 0000 0000 0000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={19}
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        />

        <View style={styles.row2}>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>الصلاحية</Text>
            <TextInput
              value={expiry}
              onChangeText={(t) => setExpiry(formatExpiry(t))}
              placeholder="MM/YY"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={5}
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            />
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>CVV</Text>
            <TextInput
              value={cvv}
              onChangeText={(t) => setCvv(digitsOnly(t).slice(0, 4))}
              placeholder="•••"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            />
          </View>
        </View>

        <Pressable
          style={[styles.payBtn, { backgroundColor: Colors.primary }, paying && { opacity: 0.75 }]}
          onPress={onPay}
          disabled={paying}
        >
          {paying ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={20} color="#000" />
              <Text style={styles.payBtnText}>Pay Now {formatPrice(amountNum)}</Text>
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
  note: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  nameRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  labelInline: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 6,
  },
  nameLocked: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    marginBottom: 8,
  },
  row2: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
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
});
