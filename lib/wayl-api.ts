import { Linking } from "react-native";
import * as ExpoLinking from "expo-linking";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";

export type WaylCustomerDetails = {
  name: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

export type CreateWaylCheckoutParams = {
  amount: number;
  description: string;
  customer_details: WaylCustomerDetails;
  success_url?: string;
  failure_url?: string;
  cancel_url?: string;
  metadata?: Record<string, unknown>;
};

function getApiBaseOrThrow(): string {
  const base = getResolvedApiBaseUrl();
  if (!base) {
    throw new Error("Server base URL is not configured. Set EXPO_PUBLIC_API_URL.");
  }
  return base;
}

export async function verifyWaylKey(): Promise<{ valid: boolean; message: string }> {
  const base = getApiBaseOrThrow();
  const res = await fetch(`${base}/api/payments/wayl/verify-key`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as {
    valid?: boolean;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || `Wayl key verification failed (${res.status})`);
  }
  return {
    valid: Boolean(data.valid),
    message: data.message || "Wayl API key is valid",
  };
}

export async function createWaylCheckoutSession(
  params: CreateWaylCheckoutParams,
): Promise<{ checkoutUrl: string }> {
  console.log("FINAL AMOUNT SENT:", params.amount);
  const base = getApiBaseOrThrow();
  const res = await fetch(`${base}/api/payments/wayl/checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      amount: params.amount,
      description: params.description,
      customer_details: params.customer_details,
      success_url: params.success_url,
      failure_url: params.failure_url,
      cancel_url: params.cancel_url,
      metadata: params.metadata,
      bookingId:
        typeof params.metadata?.bookingId === "string" ? params.metadata.bookingId : undefined,
    }),
  });

  const raw = await res.text();
  let data: {
    checkoutUrl?: string;
    message?: string;
    details?: unknown;
  } = {};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    data = { message: raw.slice(0, 500) || `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const detail =
      data.details !== undefined ? ` ${typeof data.details === "string" ? data.details : JSON.stringify(data.details)}` : "";
    throw new Error(
      (data.message || `Failed to create Wayl checkout session (${res.status})`) + detail,
    );
  }
  if (!data.checkoutUrl) {
    throw new Error("Server response missing checkoutUrl");
  }
  return { checkoutUrl: data.checkoutUrl };
}

export async function validateWaylTransaction(
  transactionId: string,
): Promise<{ paid: boolean; status: string }> {
  const base = getApiBaseOrThrow();
  const res = await fetch(`${base}/api/payments/wayl/validate-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    paid?: boolean;
    status?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || `Failed to validate transaction (${res.status})`);
  }
  return {
    paid: Boolean(data.paid),
    status: String(data.status ?? ""),
  };
}

export async function triggerWaylPaymentAndRedirect(
  params: CreateWaylCheckoutParams,
): Promise<{ checkoutUrl: string }> {
  const successUrl =
    params.success_url ||
    ExpoLinking.createURL("/payment/result", {
      queryParams: { status: "success" },
    });
  const failureUrl =
    params.failure_url ||
    params.cancel_url ||
    ExpoLinking.createURL("/payment/result", {
      queryParams: { status: "failure" },
    });

  const { checkoutUrl } = await createWaylCheckoutSession({
    ...params,
    success_url: successUrl,
    failure_url: failureUrl,
    cancel_url: failureUrl,
  });
  const supported = await Linking.canOpenURL(checkoutUrl);
  if (!supported) {
    throw new Error("Cannot open Wayl checkout URL on this device.");
  }
  await Linking.openURL(checkoutUrl);
  return { checkoutUrl };
}
