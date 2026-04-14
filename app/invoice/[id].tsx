import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import { getPaymentInvoiceDetails, type PaymentInvoiceDetails } from "@/lib/payment-invoice";
import { formatIqd } from "@/lib/format-currency";

function asDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toWhatsAppPhone(raw: string): string {
  const cleaned = String(raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  return cleaned;
}

export default function InvoiceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharingWa, setSharingWa] = useState(false);
  const [invoice, setInvoice] = useState<PaymentInvoiceDetails | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const details = await getPaymentInvoiceDetails(String(id ?? ""));
        if (mounted) setInvoice(details);
      } catch (e) {
        Alert.alert("Invoice", e instanceof Error ? e.message : "Unable to load invoice");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const fee = useMemo(() => {
    if (!invoice) return 0;
    return Math.round(invoice.amount * 0.015);
  }, [invoice]);
  const grandTotal = (invoice?.amount || 0) + fee;

  const receiptHtml = useMemo(() => {
    if (!invoice) return "";
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 28px; color: #13201a;">
          <div style="border: 1px solid #e9edea; border-radius: 14px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
              <div style="font-size: 22px; font-weight: 700;">Shootha Payment Receipt</div>
              <div style="font-size: 12px; border: 1px solid #d6e2db; border-radius: 999px; padding: 6px 10px;">
                LOGO
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; row-gap: 10px; column-gap: 18px; margin-bottom: 26px; font-size: 13px;">
              <div><b>Invoice ID:</b> ${invoice.invoiceId}</div>
              <div><b>Booking ID:</b> ${invoice.bookingId}</div>
              <div><b>Stadium Name:</b> ${invoice.venueName}</div>
              <div><b>Player Name:</b> ${invoice.playerName || "-"}</div>
              <div><b>Date/Time:</b> ${invoice.bookingDate || "-"} ${invoice.bookingTime || ""}</div>
              <div><b>Transaction ID:</b> ${invoice.transactionId || "-"}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 26px;">
              <tr>
                <th style="text-align: left; font-size: 12px; color: #6c7872; padding: 10px 0; border-bottom: 1px solid #edf0ee;">Item</th>
                <th style="text-align: right; font-size: 12px; color: #6c7872; padding: 10px 0; border-bottom: 1px solid #edf0ee;">Amount</th>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f2f4f3;">Amount (${invoice.currency})</td>
                <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #f2f4f3;">${formatIqd(invoice.amount)}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f2f4f3;">Wayl Transaction Fee</td>
                <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #f2f4f3;">${formatIqd(fee)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0; font-weight: 700;">Grand Total</td>
                <td style="padding: 14px 0; text-align: right; font-weight: 700;">${formatIqd(grandTotal)}</td>
              </tr>
            </table>
            <div style="text-align: center; color: #6f7b75; font-size: 12px;">
              Thank you for using Shootha<br/>
              ${asDateTime(invoice.createdAtIso)}
            </div>
          </div>
        </body>
      </html>
    `;
  }, [invoice, fee, grandTotal]);

  const onDownloadPdf = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const file = await Print.printToFileAsync({ html: receiptHtml });
      if (Platform.OS === "web") {
        window.open(file.uri, "_blank");
      } else {
        await Share.share({
          title: "Shootha Payment Receipt",
          message: `Receipt PDF: ${file.uri}`,
          url: file.uri,
        });
      }
    } catch (e) {
      Alert.alert("PDF", e instanceof Error ? e.message : "Could not create PDF");
    } finally {
      setDownloading(false);
    }
  };

  const onShareWhatsApp = async () => {
    if (!invoice) return;
    setSharingWa(true);
    try {
      const phone = toWhatsAppPhone(invoice.ownerPhone);
      const text =
        `Shootha Payment Receipt\n` +
        `Invoice: ${invoice.invoiceId}\n` +
        `Booking: ${invoice.bookingId}\n` +
        `Stadium: ${invoice.venueName}\n` +
        `Total: ${formatIqd(grandTotal)}\n` +
        `Timestamp: ${asDateTime(invoice.createdAtIso)}`;
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("WhatsApp is not available on this device");
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("WhatsApp", e instanceof Error ? e.message : "Could not share receipt");
    } finally {
      setSharingWa(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color="#0F6A43" size="large" />
        <Text style={styles.loadingText}>Loading receipt...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.errorTitle}>Invoice not found</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1A2821" />
        </Pressable>
        <Text style={styles.headerTitle}>Shootha Payment Receipt</Text>
        <View style={styles.logoPill}>
          <Text style={styles.logoPillText}>LOGO</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 26 }} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptCard}>
          <Line label="Booking ID" value={invoice.bookingId} />
          <Line label="Stadium Name" value={invoice.venueName} />
          <Line label="Date / Time" value={`${invoice.bookingDate} ${invoice.bookingTime}`} />
          <Line label="Player Name" value={invoice.playerName || "-"} />
          <Line label="Transaction ID" value={invoice.transactionId || "-"} />
          <Line label="Invoice Category" value={invoice.category.toUpperCase()} />
        </View>

        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Pricing</Text>
          <Line label="Amount (IQD)" value={formatIqd(invoice.amount)} />
          <Line label="Wayl Transaction Fee" value={formatIqd(fee)} />
          <View style={styles.divider} />
          <Line label="Grand Total" value={formatIqd(grandTotal)} strong />
        </View>

        <View style={styles.footerBox}>
          <Text style={styles.footerTitle}>Thank you for using Shootha</Text>
          <Text style={styles.footerTime}>{asDateTime(invoice.createdAtIso)}</Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => void onDownloadPdf()} disabled={downloading}>
          <Ionicons name="download-outline" size={18} color="#FFF" />
          <Text style={styles.primaryBtnText}>{downloading ? "Preparing PDF..." : "Download PDF"}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => void onShareWhatsApp()} disabled={sharingWa}>
          <Ionicons name="logo-whatsapp" size={18} color="#1A2821" />
          <Text style={styles.secondaryBtnText}>
            {sharingWa ? "Opening WhatsApp..." : "Share via WhatsApp"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },
  center: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E9EEEB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    color: "#102019",
    fontFamily: "Cairo_700Bold",
  },
  logoPill: {
    borderWidth: 1,
    borderColor: "#D7E3DC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logoPillText: {
    fontSize: 10,
    color: "#4E5E56",
    fontFamily: "Cairo_600SemiBold",
  },
  receiptCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDF0EE",
    padding: 16,
    gap: 11,
    marginBottom: 14,
  },
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDF0EE",
    padding: 16,
    gap: 11,
    marginBottom: 18,
  },
  tableTitle: {
    fontSize: 14,
    color: "#12221B",
    fontFamily: "Cairo_700Bold",
    marginBottom: 2,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  lineLabel: {
    fontSize: 13,
    color: "#6D7B73",
    fontFamily: "Cairo_400Regular",
  },
  lineValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#14231C",
    fontFamily: "Cairo_600SemiBold",
  },
  strong: {
    fontFamily: "Cairo_700Bold",
    color: "#102019",
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
  },
  footerBox: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
  },
  footerTitle: {
    fontSize: 13,
    color: "#3B4A43",
    fontFamily: "Cairo_600SemiBold",
  },
  footerTime: {
    fontSize: 12,
    color: "#78867F",
    fontFamily: "Cairo_400Regular",
  },
  actions: {
    gap: 10,
    paddingBottom: 14,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#0F6A43",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9EEEB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    color: "#1A2821",
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  loadingText: {
    marginTop: 10,
    color: "#66746D",
    fontFamily: "Cairo_400Regular",
  },
  errorTitle: {
    fontSize: 18,
    color: "#1A2821",
    fontFamily: "Cairo_700Bold",
    marginBottom: 14,
  },
});
