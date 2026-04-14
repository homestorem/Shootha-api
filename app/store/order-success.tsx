import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { fetchMarketplaceOrderSummary } from "@/lib/firestore-marketplace";
import { formatIqd } from "@/lib/format-currency";

export default function OrderSuccessScreen() {
  const params = useLocalSearchParams<{ orderId?: string; invoiceId?: string }>();
  const orderId = String(params.orderId ?? "").trim();
  const invoiceId = String(params.invoiceId ?? "").trim();
  const { data: order } = useQuery({
    queryKey: ["order-summary", orderId],
    queryFn: () => fetchMarketplaceOrderSummary(orderId),
    enabled: Boolean(orderId),
    staleTime: 15000,
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark" size={42} color="#0F6A43" />
      </View>
      <Text style={styles.title}>Order Confirmed</Text>
      <Text style={styles.sub}>
        Your Shootha Store purchase has been confirmed successfully.
      </Text>
      {order ? (
        <View style={styles.metaCard}>
          <Text style={styles.metaLine}>Order: {order.id}</Text>
          <Text style={styles.metaLine}>Status: {order.status}</Text>
          <Text style={styles.metaLine}>Total: {formatIqd(order.total)}</Text>
        </View>
      ) : null}
      {invoiceId ? (
        <Pressable
          style={[styles.secondaryBtn, { marginBottom: 10 }]}
          onPress={() => router.push((`/invoice/${invoiceId}` as never))}
        >
          <Text style={styles.secondaryTxt}>View Invoice</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(tabs)/store")}>
        <Text style={styles.primaryTxt}>Back to Store</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
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
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontFamily: "Cairo_700Bold",
    color: "#112019",
  },
  sub: {
    marginTop: 12,
    textAlign: "center",
    color: "#697871",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    lineHeight: 23,
    marginBottom: 24,
  },
  metaCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E7EBE9",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  metaLine: {
    color: "#415049",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  primaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 13,
    backgroundColor: "#0F6A43",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTxt: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  secondaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E8DF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryTxt: {
    color: "#0F6A43",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
});
