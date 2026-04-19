/**
 * محفظة اللاعب: خادم Express (JWT) أو Firestore مباشرةً عند عدم وجود JWT.
 * الخصم الذري: Admin SDK على الخادم، أو runTransaction من العميل عند الضبط.
 */
import { firebaseConfig } from "@/lib/firebaseConfig";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";
import {
  debitWalletFirestoreTransaction,
  fetchWalletFromFirestore,
  isFirebaseClientWalletEnabled,
  redeemPrepaidCardFirestoreTransaction,
} from "@/lib/wallet-firestore";
import type { WalletTransaction } from "@/lib/wallet-types";
import { normalizePrepaidCardCode } from "@/lib/prepaid-code";
import type { VoucherRedeemerProfile } from "@/lib/voucher-redeemer-profile";

export type { WalletTransaction };
export type { VoucherRedeemerProfile };

export type WalletFetchOptions = {
  /** مطابق لـ `AuthUser.id` (مستند users في Firestore) */
  userId?: string | null;
};

export type RedeemPrepaidCardOptions = WalletFetchOptions & {
  redeemer?: VoucherRedeemerProfile | null;
};

function apiBase(): string {
  return getResolvedApiBaseUrl();
}

function newIdempotencyKey(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* */
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export async function fetchWallet(
  token: string | null,
  limit = 20,
  opts?: WalletFetchOptions,
): Promise<{ balance: number; transactions: WalletTransaction[] }> {
  const base = apiBase();
  const lim = Math.min(100, Math.max(1, limit));
  const uid = String(opts?.userId ?? "").trim();

  if (base && token) {
    const res = await fetch(`${base}/api/wallet?limit=${lim}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { message?: string }).message ?? "تعذر تحميل المحفظة");
    }
    return (await res.json()) as { balance: number; transactions: WalletTransaction[] };
  }

  if (uid && isFirebaseConfigured() && isFirebaseClientWalletEnabled()) {
    return fetchWalletFromFirestore(uid, lim);
  }

  return { balance: 0, transactions: [] };
}

export type PayFromWalletOptions = WalletFetchOptions & {
  bookingId?: string | null;
  idempotencyKey?: string;
};

export async function payFromWallet(
  token: string | null,
  amount: number,
  label: string,
  opts?: PayFromWalletOptions,
): Promise<{ balance: number; transactionId?: string }> {
  const base = apiBase();
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("المبلغ غير صالح");
  const uid = String(opts?.userId ?? "").trim();
  const idem = String(opts?.idempotencyKey ?? "").trim() || newIdempotencyKey();

  if (base && token) {
    const res = await fetch(`${base}/api/wallet/pay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: amt,
        label,
        bookingId: opts?.bookingId ?? null,
        idempotencyKey: idem,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((j as { message?: string }).message ?? "تعذر الخصم من المحفظة");
    }
    return {
      balance: Number((j as { balance?: number }).balance ?? 0),
      transactionId: (j as { transactionId?: string }).transactionId,
    };
  }

  if (uid && isFirebaseConfigured() && isFirebaseClientWalletEnabled()) {
    const r = await debitWalletFirestoreTransaction({
      userId: uid,
      amount: amt,
      label,
      bookingId: opts?.bookingId ?? null,
      idempotencyKey: idem,
    });
    return { balance: r.balance, transactionId: r.transactionId };
  }

  throw new Error("المحفظة غير مُتاحة — سجّل الدخول عبر الخادم أو فعّل Firebase.");
}

export async function redeemPrepaidCard(
  token: string | null,
  code: string,
  opts?: RedeemPrepaidCardOptions,
): Promise<{ amount: number; balance: number }> {
  const base = apiBase();

  if (base && token) {
    const normCode = normalizePrepaidCardCode(code);
    const res = await fetch(`${base}/api/wallet/redeem`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ code: normCode }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((j as { message?: string }).message ?? "تعذر تفعيل البطاقة");
    }
    return {
      amount: Number((j as { amount?: number }).amount ?? 0),
      balance: Number((j as { balance?: number }).balance ?? 0),
    };
  }

  const uid = String(opts?.userId ?? "").trim();
  if (uid && isFirebaseConfigured() && isFirebaseClientWalletEnabled()) {
    const out = await redeemPrepaidCardFirestoreTransaction({
      userId: uid,
      code,
      redeemer: opts?.redeemer,
    });
    return { amount: out.amount, balance: out.balance };
  }

  throw new Error("شحن البطاقات غير مُتاح — تأكد من تسجيل الدخول وربط Firebase/الخادم.");
}

export { formatIqd } from "./format-currency";
