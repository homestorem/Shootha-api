/**
 * Firestore wallet (Admin SDK) — atomic debits/credits via runTransaction.
 * الرصيد: wallets/{userId} — السجل: walletTransactions/{idempotencyKey} مع حقل userId.
 */
import * as admin from "firebase-admin";
import * as fs from "node:fs";

const WALLET_LEDGER_COLLECTION = "walletTransactions";

let adminInitialized = false;

function ensureAdminApp(): void {
  if (admin.apps.length > 0) {
    adminInitialized = true;
    return;
  }
  if (adminInitialized) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (pathEnv && fs.existsSync(pathEnv)) {
    const c = JSON.parse(fs.readFileSync(pathEnv, "utf8")) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(c) });
  } else if (json) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json) as admin.ServiceAccount),
    });
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH required for Firestore wallet",
    );
  }
  adminInitialized = true;
}

/** تهيئة تطبيق Admin (مشتركة مع مسارات مثل custom-token للدعم). */
export function ensureFirebaseAdminApp(): void {
  ensureAdminApp();
}

export function isWalletFirestoreConfigured(): boolean {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  return Boolean(json || (pathEnv && fs.existsSync(pathEnv)));
}

function getDb(): admin.firestore.Firestore {
  ensureAdminApp();
  return admin.firestore();
}

export type WalletTxRow = {
  id: string;
  userId: string;
  amount: number;
  type: "redeem" | "payment";
  balanceAfter: number;
  label: string;
  createdAt: string;
  status?: string;
  bookingId?: string | null;
};

function txSnapToRow(id: string, d: admin.firestore.DocumentData): WalletTxRow {
  const ts = d.timestamp as admin.firestore.Timestamp | undefined;
  const createdAt =
    ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : new Date().toISOString();
  const raw = String(d.type ?? "debit").toLowerCase();
  const uiType: "redeem" | "payment" = raw === "credit" || raw === "redeem" ? "redeem" : "payment";
  const uid = String(d.userId ?? d.walletUserId ?? "").trim();
  return {
    id,
    userId: uid,
    amount: Math.round(Number(d.amount ?? 0)),
    type: uiType,
    balanceAfter: Math.round(Number(d.balanceAfter ?? 0)),
    label: String(d.label ?? ""),
    createdAt,
    status: String(d.status ?? "completed"),
    bookingId: d.bookingId ?? null,
  };
}

async function fetchLedgerForUser(
  db: admin.firestore.Firestore,
  userId: string,
  lim: number,
): Promise<WalletTxRow[]> {
  const wRef = db.collection("wallets").doc(userId);
  let rows: WalletTxRow[] = [];
  try {
    const qs = await db
      .collection(WALLET_LEDGER_COLLECTION)
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(lim)
      .get();
    rows = qs.docs.map((docSnap) => txSnapToRow(docSnap.id, docSnap.data()));
  } catch {
    const all = await db
      .collection(WALLET_LEDGER_COLLECTION)
      .where("userId", "==", userId)
      .limit(lim * 4)
      .get();
    rows = all.docs
      .map((docSnap) => txSnapToRow(docSnap.id, docSnap.data()))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, lim);
  }

  /** سجلات قديمة تحت wallets/.../transactions */
  try {
    const legacy = await wRef.collection("transactions").orderBy("timestamp", "desc").limit(lim).get();
    const legacyRows = legacy.docs.map((docSnap) => txSnapToRow(docSnap.id, docSnap.data()));
    const byId = new Map<string, WalletTxRow>();
    for (const r of legacyRows) byId.set(r.id, { ...r, userId: r.userId || userId });
    for (const r of rows) byId.set(r.id, r);
    return Array.from(byId.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, lim);
  } catch {
    return rows;
  }
}

export async function getWalletAdmin(
  userId: string,
  limit: number,
): Promise<{ balance: number; transactions: WalletTxRow[] }> {
  const db = getDb();
  const wRef = db.collection("wallets").doc(userId);
  const wSnap = await wRef.get();
  const balance = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
  const lim = Math.min(100, Math.max(1, limit));
  const transactions = await fetchLedgerForUser(db, userId, lim);
  return { balance, transactions };
}

export async function adminDebitWallet(opts: {
  userId: string;
  amount: number;
  bookingId?: string | null;
  label?: string;
  idempotencyKey: string;
}): Promise<{ balance: number; transactionId: string; duplicate: boolean }> {
  const { userId, amount, bookingId, label, idempotencyKey } = opts;
  const uid = String(userId ?? "").trim();
  const key = String(idempotencyKey ?? "").trim();
  if (!uid || !key) throw new Error("معرّف المستخدم أو مفتاح التزامن ناقص");
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("المبلغ غير صالح");

  const db = getDb();
  const wRef = db.collection("wallets").doc(uid);
  const ledgerRef = db.collection(WALLET_LEDGER_COLLECTION).doc(key);

  return db.runTransaction(async (tx) => {
    const wSnap = await tx.get(wRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) {
      const bal = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
      return { balance: bal, transactionId: key, duplicate: true };
    }
    const balance = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
    if (balance < amt) {
      throw new Error("INSUFFICIENT_FUNDS");
    }
    const next = balance - amt;
    const ts = admin.firestore.FieldValue.serverTimestamp();
    if (!wSnap.exists) {
      tx.set(wRef, { user_balance: next, updatedAt: ts });
    } else {
      tx.update(wRef, { user_balance: next, updatedAt: ts });
    }
    tx.set(ledgerRef, {
      transactionId: key,
      userId: uid,
      walletUserId: uid,
      amount: amt,
      type: "debit",
      status: "completed",
      timestamp: ts,
      bookingId: bookingId ?? null,
      label: typeof label === "string" ? label : "",
      balanceAfter: next,
    });
    return { balance: next, transactionId: key, duplicate: false };
  });
}

export async function adminCreditWallet(opts: {
  userId: string;
  amount: number;
  label: string;
  idempotencyKey: string;
}): Promise<{ balance: number; duplicate: boolean }> {
  const uid = String(opts.userId ?? "").trim();
  const key = String(opts.idempotencyKey ?? "").trim();
  const amt = Math.round(Number(opts.amount));
  if (!uid || !key || !Number.isFinite(amt) || amt <= 0) {
    throw new Error("بيانات الشحن غير صالحة");
  }
  const db = getDb();
  const wRef = db.collection("wallets").doc(uid);
  const ledgerRef = db.collection(WALLET_LEDGER_COLLECTION).doc(key);

  return db.runTransaction(async (tx) => {
    const wSnap = await tx.get(wRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) {
      const bal = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
      return { balance: bal, duplicate: true };
    }
    const balance = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
    const next = balance + amt;
    const ts = admin.firestore.FieldValue.serverTimestamp();
    tx.set(
      wRef,
      { user_balance: next, updatedAt: ts },
      { merge: true },
    );
    tx.set(ledgerRef, {
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
