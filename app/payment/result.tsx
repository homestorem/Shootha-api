import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import {
  confirmBookingPaymentInFirestore,
  failPendingBookingPaymentInFirestore,
} from "@/lib/firestore-bookings";
import { generatePaymentInvoice } from "@/lib/payment-invoice";
import { triggerWaylPaymentAndRedirect, validateWaylTransaction } from "@/lib/wayl-api";
import { useRandomMatch } from "@/context/RandomMatchContext";
import { useStoreCart } from "@/context/StoreCartContext";
import {
  confirmMarketplaceOrderPayment,
  failMarketplacePendingOrder,
} from "@/lib/firestore-marketplace";

type ResultStatus = "success" | "failure";
type PaymentType = "stadium" | "match" | "product";

function moneyIQD(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} IQD`;
}

export default function PaymentResultScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { joinMatch } = useRandomMatch();
  const { clearCart } = useStoreCart();
  const params = useLocalSearchParams<{
    status?: string;
    paymentType?: string;
    bookingId?: string;
    orderId?: string;
    matchId?: string;
    playerName?: string;
    amount?: string;
    venueName?: string;
    transactionId?: string;
    transaction_id?: string;
    payment_id?: string;
    description?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    error?: string;
  }>();

  const initialStatus: ResultStatus = params.status === "success" ? "success" : "failure";
  const paymentType: PaymentType =
    params.paymentType === "product" || params.paymentType === "match"
      ? params.paymentType
      : "stadium";
  const amount = Number(params.amount ?? "0");
  const [status, setStatus] = useState<ResultStatus>(initialStatus);
  const [loading, setLoading] = useState(initialStatus === "success");
  const [invoiceId, setInvoiceId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const bookingId = String(params.bookingId ?? "");
  const orderId = String(params.orderId ?? "");
  const matchId = String(params.matchId ?? "");
  const venueName = String(params.venueName ?? "Shootha payment");
  const transactionId = String(
    params.transactionId ?? params.transaction_id ?? params.payment_id ?? "",
  );

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (initialStatus !== "success" || !user?.id) {
        setLoading(false);
        return;
      }
      try {
        if (transactionId) {
          const verified = await validateWaylTransaction(transactionId);
          if (!verified.paid || verified.status !== "PAID") {
            throw new Error("Payment validation failed. Transaction is not PAID.");
          }
        } else {
          console.warn(
            "[Wayl] Missing transactionId in callback; continuing confirmation without validate endpoint.",
          );
        }
        let invoiceCategory: "booking" | "purchase" | "match" = "booking";
        let invoiceRefId = bookingId;

        if (paymentType === "product") {
          if (!orderId) throw new Error("Missing order id for product payment");
          await confirmMarketplaceOrderPayment(orderId, transactionId);
          clearCart();
          invoiceCategory = "purchase";
          invoiceRefId = orderId;
        } else if (paymentType === "match") {
          if (!matchId) throw new Error("Missing match id for match payment");
          const playerName = String(params.playerName ?? user.name ?? "Player");
          const joined = joinMatch(matchId, playerName);
          if (!joined) throw new Error("Match is full. Could not reserve your spot.");
          invoiceCategory = "match";
          invoiceRefId = `match:${matchId}`;
        } else {
          if (!bookingId) throw new Error("Missing booking id for stadium payment");
          await confirmBookingPaymentInFirestore(bookingId, { transactionId });
          invoiceCategory = "booking";
          invoiceRefId = bookingId;
        }

        const invoice = await generatePaymentInvoice({
          bookingId: invoiceRefId,
          userId: user.id,
          amount,
          venueName,
          transactionId,
          currency: "IQD",
          category: invoiceCategory,
        });
        if (!mounted) return;
        setInvoiceId(invoice.invoiceId);
      } catch (e) {
        if (!mounted) return;
        if (paymentType === "stadium" && bookingId) {
          await failPendingBookingPaymentInFirestore(bookingId, "wayl_validation_failed").catch(
            () => undefined,
          );
        }
        if (paymentType === "product" && orderId) {
          await failMarketplacePendingOrder(orderId, "wayl_validation_failed").catch(
            () => undefined,
          );
        }
        setErrorMsg(
          e instanceof Error ? e.message : "Payment succeeded but post-processing failed",
        );
        setStatus("failure");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, [
    initialStatus,
    paymentType,
    bookingId,
    orderId,
    matchId,
    user?.id,
    user?.name,
    amount,
    venueName,
    transactionId,
    params.playerName,
    joinMatch,
    clearCart,
  ]);

  const failureMessage = useMemo(() => {
    if (errorMsg) return errorMsg;
    if (params.error) return String(params.error);
    return "Your transaction was not completed. Please try again.";
  }, [params.error, errorMsg]);

  const onTryAgain = async () => {
    const retryAmount = Number(params.amount ?? "0");
    if (!Number.isFinite(retryAmount) || retryAmount <= 0) {
      router.replace("/(tabs)/index");
      return;
    }
    await triggerWaylPaymentAndRedirect({
      amount: retryAmount,
      description: String(params.description ?? "Shootha payment"),
      customer_details: {
        name: String(params.customerName ?? user?.name ?? "Customer"),
        phone: String(params.customerPhone ?? user?.phone ?? ""),
        email: String(params.customerEmail ?? ""),
      },
      success_url: ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "success",
          paymentType,
          bookingId,
          orderId,
          matchId,
          amount: String(params.amount ?? "0"),
          venueName: String(params.venueName ?? ""),
          playerName: String(params.playerName ?? ""),
        },
      }),
      cancel_url: ExpoLinking.createURL("/payment/result", {
        queryParams: {
          status: "failure",
          paymentType,
          bookingId,
          orderId,
          matchId,
          amount: String(params.amount ?? "0"),
          venueName: String(params.venueName ?? ""),
          description: String(params.description ?? ""),
          customerName: String(params.customerName ?? ""),
          customerPhone: String(params.customerPhone ?? ""),
          customerEmail: String(params.customerEmail ?? ""),
          playerName: String(params.playerName ?? ""),
        },
      }),
      metadata: {
        type: paymentType,
        bookingId,
        orderId,
        matchId,
      },
    });
  };

  const topPad = insets.top + 24;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color="#0F6A43" />
        <Text style={styles.loadingText}>Validating transaction...</Text>
      </View>
    );
  }

  if (status === "success") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={42} color="#0F6A43" />
        </View>
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <View style={styles.summaryCard}>
          <SummaryLine label="Amount Paid" value={moneyIQD(amount)} />
          <SummaryLine label="Transaction ID" value={transactionId || "N/A"} />
          <SummaryLine label="Category" value={paymentType} />
          <SummaryLine label="Reference" value={bookingId || orderId || matchId || "N/A"} />
          {invoiceId ? <SummaryLine label="Invoice ID" value={invoiceId} /> : null}
        </View>
        <Pressable
          style={styles.primaryBtn}
          onPress={() =>
            invoiceId
              ? router.push((`/invoice/${invoiceId}` as never))
              : paymentType === "product"
                ? router.replace("/store/order-success")
                : paymentType === "match"
                  ? router.push((`/random-match/${matchId}` as never))
                  : router.push((`/booking/${bookingId}` as never))
          }
        >
          <Text style={styles.primaryBtnText}>View Invoice</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() =>
            paymentType === "product"
              ? router.replace(
                  (`/store/order-success?orderId=${encodeURIComponent(orderId)}&invoiceId=${encodeURIComponent(invoiceId)}` as never),
                )
              : paymentType === "match"
                ? router.push((`/random-match/${matchId}` as never))
                : router.replace("/(tabs)/bookings")
          }
        >
          <Text style={styles.secondaryBtnText}>
            {paymentType === "product"
              ? "Track Order"
              : paymentType === "match"
                ? "Go to Match Details"
                : "Go to My Bookings"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.failIconWrap}>
        <Ionicons name="close" size={34} color="#C65A57" />
      </View>
      <Text style={styles.failTitle}>Payment Failed</Text>
      <Text style={styles.failSub}>{failureMessage}</Text>
      <Pressable style={styles.primaryBtn} onPress={() => void onTryAgain()}>
        <Text style={styles.primaryBtnText}>Try Again</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/index")}>
        <Text style={styles.secondaryBtnText}>Return to Home</Text>
      </Pressable>
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "#D8E8DF",
    backgroundColor: "#F6FBF8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  failIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "#F2D8D6",
    backgroundColor: "#FFF8F7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  successTitle: {
    fontSize: 30,
    fontFamily: "Cairo_700Bold",
    color: "#112019",
    marginTop: 26,
    marginBottom: 24,
  },
  failTitle: {
    fontSize: 30,
    fontFamily: "Cairo_700Bold",
    color: "#2A1716",
    marginTop: 26,
  },
  failSub: {
    fontSize: 14,
    color: "#8A6462",
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
    lineHeight: 24,
  },
  summaryCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ECEFED",
    padding: 18,
    gap: 10,
    marginBottom: 24,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#728079",
    fontFamily: "Cairo_400Regular",
  },
  summaryValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#112019",
    fontFamily: "Cairo_600SemiBold",
  },
  primaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 13,
    backgroundColor: "#0F6A43",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E7EBE9",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  secondaryBtnText: {
    color: "#1E2A24",
    fontSize: 15,
    fontFamily: "Cairo_600SemiBold",
  },
  loadingText: {
    marginTop: 16,
    color: "#57635D",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  warningText: {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    color: "#9A6B3E",
    fontFamily: "Cairo_400Regular",
    marginBottom: 16,
  },
});
