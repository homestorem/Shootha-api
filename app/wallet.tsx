import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { fetchWallet, redeemPrepaidCard, formatIqd, type WalletTransaction } from "@/lib/wallet-api";
import { Colors } from "@/constants/colors";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, token, isGuest } = useAuth();

  /** لاعب مسجّل، أو ضيف عند تفعيل الوصول الكامل */
  const allowWallet =
    (!!user && !isGuest) || (GUEST_FULL_ACCESS && isGuest);
  const walletToken: string | null = isGuest ? null : token;

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async () => {
    if (!allowWallet) {
      setBalance(null);
      setTransactions([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchWallet(walletToken, 30, {
        userId: !isGuest && user?.id && user.id !== "guest" ? user.id : undefined,
      });
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "تعذر تحميل المحفظة";
      Alert.alert("خطأ", msg);
      setBalance(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowWallet, walletToken, isGuest, user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = () => {
    if (!allowWallet) return;
    setRefreshing(true);
    load();
  };

  const onRedeem = async () => {
    if (!allowWallet) return;
    const trimmed = code.trim();
    if (trimmed.length < 8) {
      Alert.alert("تنبيه", "أدخل رقم البطاقة كاملاً (8 أحرف على الأقل)");
      return;
    }
    setRedeeming(true);
    try {
      const { balance: next, amount } = await redeemPrepaidCard(walletToken, trimmed, {
        userId: !isGuest && user?.id && user.id !== "guest" ? user.id : undefined,
      });
      setBalance(next);
      setCode("");
      try {
        const data = await fetchWallet(walletToken, 30, {
          userId: !isGuest && user?.id && user.id !== "guest" ? user.id : undefined,
        });
        setTransactions(data.transactions);
      } catch {
        /* القائمة تُحدَّث لاحقاً عند السحب للتحديث */
      }
      Alert.alert("تم الشحن", `أُضيف ${formatIqd(amount)} إلى رصيدك.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "تعذر تنفيذ العملية";
      Alert.alert("فشل الشحن", msg);
    } finally {
      setRedeeming(false);
    }
  };

  if (!allowWallet) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 10 },
        ]}
      >
        <Text style={[styles.guestTitle, { color: colors.text }]}>المحفظة</Text>
        <Text style={[styles.guestHint, { color: colors.textSecondary }]}>
          سجّل الدخول لعرض رصيدك وشحن بطاقات الرصيد.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.walletTitle, { color: colors.textSecondary }]}>رصيد المحفظة</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />
        ) : (
          <Text style={[styles.walletBalance, { color: colors.text }]}>
            {balance !== null ? formatIqd(balance) : "—"}
          </Text>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>شحن بطاقة رصيد</Text>
      <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
        أدخل الرمز المطبوع على بطاقة الشحن (أرقام وحروف).
      </Text>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="رمز البطاقة"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!redeeming}
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
      />

      <Pressable
        onPress={onRedeem}
        disabled={redeeming || loading}
        style={({ pressed }) => [
          styles.payBtn,
          pressed && { opacity: 0.85 },
          (redeeming || loading) && { opacity: 0.6 },
        ]}
      >
        {redeeming ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payText}>تفعيل البطاقة وإضافة الرصيد</Text>
        )}
      </Pressable>

      {transactions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 28 }]}>
            آخر العمليات
          </Text>
          {transactions.map((tx) => {
            const isCredit = tx.type === "redeem";
            return (
              <View
                key={tx.id}
                style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.txLeft}>
                  <Ionicons
                    name={isCredit ? "add-circle-outline" : "remove-circle-outline"}
                    size={22}
                    color={isCredit ? Colors.primary : "#e74c3c"}
                  />
                  <View>
                    <Text style={[styles.txLabel, { color: colors.text }]}>{tx.label}</Text>
                    <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                      {new Date(tx.createdAt).toLocaleString("ar-IQ")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: isCredit ? Colors.primary : "#e74c3c" }]}>
                  {isCredit ? "+" : "−"}
                  {formatIqd(tx.amount)}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  guestHint: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  walletCard: {
    borderRadius: 20,
    padding: 25,
    marginBottom: 24,
    borderWidth: 1,
  },
  walletTitle: {
    fontSize: 14,
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  payBtn: {
    backgroundColor: "#2ecc71",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  payText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  txLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
});
