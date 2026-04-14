import type { CartLine } from "@/lib/firestore-marketplace";

export const STORE_DELIVERY_FEE = 5000;

export type StoreCheckoutPayload = {
  storeId: string;
  storeName: string;
  customerName: string;
  customerPhone: string;
  addressText: string;
  lat?: number;
  lon?: number;
  notes?: string;
  items: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export function encodeCheckoutPayload(payload: StoreCheckoutPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeCheckoutPayload(raw?: string | string[]): StoreCheckoutPayload | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(v)) as StoreCheckoutPayload;
    if (!parsed?.storeId || !parsed?.storeName || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}
