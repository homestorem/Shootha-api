/**
 * Client Firestore wallet — runTransaction لخصم/إيداع ذري مع سجل في walletTransactions.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { firebaseConfig } from "@/lib/firebaseConfig";
import { WALLET_LEDGER_COLLECTION } from "@/lib/wallet-ledger-constants";
import type { WalletTransaction } from "@/lib/wallet-types";

export function isFirebaseClientWalletEnabled(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
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

export async function fetchWalletFromFirestore(
  userId: string,
  max = 20,
): Promise<{ balance: number; transactions: WalletTransaction[] }> {
  const uid = String(userId ?? "").trim();
  if (!uid || !isFirebaseClientWalletEnabled()) {
    return { balance: 0, transactions: [] };
  }
  const db = getFirestoreDb();
  const wRef = doc(db, "wallets", uid);
  const wSnap = await getDoc(wRef);
  const balance = wSnap.exists() ? Math.round(Number((wSnap.data() as { user_balance?: number }).user_balance ?? 0)) : 0;
  const lim = Math.min(100, Math.max(1, max));
  let list: WalletTransaction[] = [];
  try {
    const q = query(
      collection(db, WALLET_LEDGER_COLLECTION),
      where("userId", "==", uid),
      orderBy("timestamp", "desc"),
      limit(lim),
    );
    const snap = await getDocs(q);
    list = snap.docs.map((d) => mapTxDoc(d.id, d.data()));
  } catch {
    const q2 = query(collection(db, WALLET_LEDGER_COLLECTION), where("userId", "==", uid), limit(lim * 4));
    const snap = await getDocs(q2);
    list = snap.docs
      .map((d) => mapTxDoc(d.id, d.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, lim);
  }

  try {
    const legacySnap = await getDocs(
      query(collection(db, "wallets", uid, "transactions"), orderBy("timestamp", "desc"), limit(lim)),
    );
    const legacy = legacySnap.docs.map((d) => mapTxDoc(d.id, d.data()));
    const byId = new Map<string, WalletTransaction>();
    for (const r of legacy) byId.set(r.id, { ...r, userId: r.userId || uid });
    for (const r of list) byId.set(r.id, r);
    list = Array.from(byId.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, lim);
  } catch {
    /* لا يوجد سجل قديم */
  }

  return { balance, transactions: list };
}

function mapTxDoc(id: string, d: Record<string, unknown>): WalletTransaction {
  const ts = d.timestamp as { toDate?: () => Date } | undefined;
  const createdAt =
    ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : new Date().toISOString();
  const typ = String(d.type ?? "debit").toLowerCase();
  const uiType: WalletTransaction["type"] =
    typ === "credit" || typ === "redeem" ? "redeem" : "payment";
  const uid = String(d.userId ?? d.walletUserId ?? "").trim();
  return {
    id,
    userId: uid,
    type: uiType,
    amount: Math.round(Number(d.amount ?? 0)),
    balanceAfter: Math.round(Number(d.balanceAfter ?? 0)),
    label: String(d.label ?? ""),
    createdAt,
    status: String(d.status ?? "completed"),
    bookingId: (d.bookingId as string | null | undefined) ?? null,
  };
}

export async function debitWalletFirestoreTransaction(opts: {
  userId: string;
  amount: number;
  label: string;
  bookingId?: string | null;
  idempotencyKey?: string;
}): Promise<{ balance: number; transactionId: string; duplicate: boolean }> {
  const uid = String(opts.userId ?? "").trim();
  const amt = Math.round(Number(opts.amount));
  if (!uid || !isFirebaseClientWalletEnabled()) {
    throw new Error("المحفظة السحابية غير مُتاحة");
  }
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("المبلغ غير صالح");

  const db = getFirestoreDb();
  const key = String(opts.idempotencyKey ?? "").trim() || newIdempotencyKey();
  const wRef = doc(db, "wallets", uid);
  const ledgerRef = doc(db, WALLET_LEDGER_COLLECTION, key);

  return runTransaction(db, async (transaction) => {
    const wSnap = await transaction.get(wRef);
    const ledgerSnap = await transaction.get(ledgerRef);
    if (ledgerSnap.exists()) {
      const bal = wSnap.exists()
        ? Math.round(Number((wSnap.data() as { user_balance?: number }).user_balance ?? 0))
        : 0;
      return { balance: bal, transactionId: key, duplicate: true };
    }
    const balance = wSnap.exists()
      ? Math.round(Number((wSnap.data() as { user_balance?: number }).user_balance ?? 0))
      : 0;
    if (balance < amt) {
      throw new Error("INSUFFICIENT_FUNDS");
    }
    const next = balance - amt;
    const ts = serverTimestamp();
    if (!wSnap.exists()) {
      transaction.set(wRef, { user_balance: next, updatedAt: ts });
    } else {
      transaction.update(wRef, { user_balance: next, updatedAt: ts });
    }
    transaction.set(ledgerRef, {
      transactionId: key,
      userId: uid,
      walletUserId: uid,
      amount: amt,
      type: "debit",
      status: "completed",
      timestamp: ts,
      bookingId: opts.bookingId ?? null,
      label: opts.label,
      balanceAfter: next,
    });
    return { balance: next, transactionId: key, duplicate: false };
  });
}

export async function creditWalletFirestoreTransaction(opts: {
  userId: string;
  amount: number;
  label: string;
  idempotencyKey: string;
}): Promise<{ balance: number; duplicate: boolean }> {
  const uid = String(opts.userId ?? "").trim();
  const amt = Math.round(Number(opts.amount));
  const key = String(opts.idempotencyKey ?? "").trim();
  if (!uid || !key || !isFirebaseClientWalletEnabled()) {
    throw new Error("المحفظة السحابية غير مُتاحة");
  }
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("المبلغ غير صالح");

  const db = getFirestoreDb();
  const wRef = doc(db, "wallets", uid);
  const ledgerRef = doc(db, WALLET_LEDGER_COLLECTION, key);

  return runTransaction(db, async (transaction) => {
    const wSnap = await transaction.get(wRef);
    const ledgerSnap = await transaction.get(ledgerRef);
    if (ledgerSnap.exists()) {
      const bal = wSnap.exists()
        ? Math.round(Number((wSnap.data() as { user_balance?: number }).user_balance ?? 0))
        : 0;
      return { balance: bal, duplicate: true };
    }
    const balance = wSnap.exists()
      ? Math.round(Number((wSnap.data() as { user_balance?: number }).user_balance ?? 0))
      : 0;
    const next = balance + amt;
    const ts = serverTimestamp();
    transaction.set(wRef, { user_balance: next, updatedAt: ts }, { merge: true });
    transaction.set(ledgerRef, {
      transactionId: key,
      userId: uid,
      walletUserId: uid,
      amount: amt,
      type: "credit",
      status: "completed",
      timestamp: ts,
      bookingId: null,
      label: opts.label,
      balanceAfter: next,
    });
    return { balance: next, duplicate: false };
  });
}
