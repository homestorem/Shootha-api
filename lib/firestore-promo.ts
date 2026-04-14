/**
 * Promo codes — collection `promoCodes`.
 *
 * Supports both layouts:
 * - A) Document ID = normalized code (uppercase, no spaces)
 * - B) Auto ID + field `code` (string, compared uppercase)
 *
 * Expected fields: type, value, maxUses, usedCount, expiryDate (Timestamp), isActive (boolean).
 *
 * Firestore rules: clients need at least read on `promoCodes` and update (or increment) on
 * `usedCount` for this flow. Example:
 *   match /promoCodes/{id} {
 *     allow read: if true;
 *     allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usedCount'])
 *       && request.resource.data.usedCount == resource.data.usedCount + 1;
 *   }
 * (Tighten `read`/`update` for production as needed.)
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  Timestamp,
  where,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { assertFirebaseConfigured } from "@/lib/firebaseConfig";

const ERR = {
  NOT_FOUND: "NOT_FOUND",
  INACTIVE: "INACTIVE",
  EXPIRED: "EXPIRED",
  LIMIT: "LIMIT",
  BAD_TOTAL: "BAD_TOTAL",
} as const;

function normalizePromoCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function expiryMs(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as Timestamp).toMillis === "function"
  ) {
    return (value as Timestamp).toMillis();
  }
  return null;
}

function isFirebasePermissionError(e: unknown): boolean {
  const any = e as { code?: string; message?: string };
  return (
    any?.code === "permission-denied" ||
    (typeof any?.message === "string" &&
      any.message.toLowerCase().includes("permission"))
  );
}

/**
 * Resolve the promo document: try doc ID first, then `code` field query.
 */
async function resolvePromoDocRef(
  db: Firestore,
  normalizedCode: string,
): Promise<DocumentReference | null> {
  const byIdRef = doc(db, "promoCodes", normalizedCode);
  const byIdSnap = await getDoc(byIdRef);
  if (byIdSnap.exists()) {
    return byIdRef;
  }

  const q = query(
    collection(db, "promoCodes"),
    where("code", "==", normalizedCode),
    limit(1),
  );
  const querySnap = await getDocs(q);
  if (querySnap.empty) {
    return null;
  }
  return querySnap.docs[0].ref;
}

export type ApplyPromoFirestoreResult =
  | {
      ok: true;
      discountAmount: number;
      finalPrice: number;
      message: string;
      appliedCode: string;
    }
  | { ok: false; message: string };

/**
 * Applies promo: validates, increments `usedCount` atomically.
 */
export async function applyPromoCodeFromFirestore(
  rawInput: string,
  totalPrice: number,
): Promise<ApplyPromoFirestoreResult> {
  try {
    assertFirebaseConfigured();
  } catch {
    return { ok: false, message: "Server error" };
  }

  const enteredCode = normalizePromoCode(rawInput);
  if (!enteredCode) {
    return { ok: false, message: "Invalid code" };
  }

  const total = Math.round(Number(totalPrice));
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, message: "Invalid code" };
  }

  const db = getFirestoreDb();

  let ref: DocumentReference;
  try {
    const resolved = await resolvePromoDocRef(db, enteredCode);
    if (!resolved) {
      return { ok: false, message: "Invalid code" };
    }
    ref = resolved;
  } catch (e: unknown) {
    if (isFirebasePermissionError(e)) {
      console.warn("[firestore-promo] read denied — check Firestore rules on promoCodes", e);
      return { ok: false, message: "Server error" };
    }
    console.warn("[firestore-promo] resolve failed", e);
    return { ok: false, message: "Server error" };
  }

  try {
    const { discountAmount, finalPrice } = await runTransaction(
      db,
      async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
          throw new Error(ERR.NOT_FOUND);
        }

        const d = snap.data() as Record<string, unknown>;

        // Explicit false disables; missing field treated as active (legacy docs).
        if (d.isActive === false) {
          throw new Error(ERR.INACTIVE);
        }

        const expMs = expiryMs(d.expiryDate);
        if (expMs != null && Date.now() >= expMs) {
          throw new Error(ERR.EXPIRED);
        }

        const used = Number(d.usedCount ?? 0);
        const maxUses = Number(d.maxUses ?? 0);
        if (maxUses > 0 && used >= maxUses) {
          throw new Error(ERR.LIMIT);
        }

        const typeStr = String(d.type ?? "").toLowerCase();
        const isPercentage =
          typeStr === "percentage" || typeStr === "percent";
        const rawVal = Number(d.value ?? 0);

        let discount = 0;
        if (isPercentage) {
          const p = Math.min(100, Math.max(0, rawVal));
          discount = Math.round((total * p) / 100);
        } else {
          discount = Math.round(Math.max(0, rawVal));
        }

        if (discount > total) {
          discount = total;
        }
        const final = total - discount;
        if (final < 0) {
          throw new Error(ERR.BAD_TOTAL);
        }

        transaction.update(ref, {
          usedCount: increment(1),
        });

        return { discountAmount: discount, finalPrice: final };
      },
    );

    return {
      ok: true,
      discountAmount,
      finalPrice,
      message: "Promo applied successfully",
      appliedCode: enteredCode,
    };
  } catch (e: unknown) {
    if (isFirebasePermissionError(e)) {
      console.warn("[firestore-promo] transaction denied — check Firestore rules", e);
      return { ok: false, message: "Server error" };
    }
    const tag = e instanceof Error ? e.message : "";
    if (tag === ERR.NOT_FOUND || tag === ERR.BAD_TOTAL) {
      return { ok: false, message: "Invalid code" };
    }
    if (tag === ERR.INACTIVE) {
      return { ok: false, message: "Code not active" };
    }
    if (tag === ERR.EXPIRED) {
      return { ok: false, message: "Code expired" };
    }
    if (tag === ERR.LIMIT) {
      return { ok: false, message: "Usage limit reached" };
    }
    console.warn("[firestore-promo]", e);
    return { ok: false, message: "Server error" };
  }
}
