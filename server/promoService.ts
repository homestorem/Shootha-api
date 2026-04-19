/**
 * أكواد الخصم — التحقق والاسترداد عبر Firebase Admin (Firestore).
 *
 * مجموعة promoCodes (معرّف المستند = الكود بأحرف كبيرة):
 * - isActive (boolean, افتراضي true)
 * - expiresAt (Timestamp | null)
 * - usedCount, maxUses (numbers)
 * - allowedUserIds (string[] | اختياري) — فارغ = الجميع
 * - allowedRegions (string[] | اختياري) — مطابقة district/المنطقة
 * - allowedFieldIds (string[] | اختياري) — فارغ = كل الملاعب
 * - minBookingAmount (number, افتراضي 0)
 * - firstTimeUsersOnly (boolean)
 * - usagePerUserLimit (number, افتراضي 1)
 * - discountType: "percent" | "fixed"
 * - discountValue (number)
 * - totalBookings, totalRevenue, totalDiscountGiven (أرقام تجميعية)
 * - lastUsedAt (Timestamp | null)
 *
 * مجموعة promoCodeUsages: مستند لكل حجز يُفعَّل فيه كوبون (id = bookingId)
 */
import * as admin from "firebase-admin";
import * as fs from "node:fs";
import jwt from "jsonwebtoken";
import type { Express, Request, Response } from "express";
import { isWalletFirestoreConfigured } from "./walletFirestore.ts";

let firestoreInited = false;

function initAdminApp(): void {
  if (firestoreInited) return;
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
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH required for promo APIs",
    );
  }
  firestoreInited = true;
}

export function isPromoFirestoreConfigured(): boolean {
  return isWalletFirestoreConfigured();
}

export function getPromoDb(): admin.firestore.Firestore {
  initAdminApp();
  return admin.firestore();
}

export type PromoDoc = {
  code?: string;
  isActive?: boolean;
  expiresAt?: admin.firestore.Timestamp | null;
  usedCount?: number;
  maxUses?: number;
  allowedUserIds?: string[];
  allowedRegions?: string[];
  allowedFieldIds?: string[];
  minBookingAmount?: number;
  firstTimeUsersOnly?: boolean;
  usagePerUserLimit?: number;
  discountType?: string;
  discountValue?: number;
  totalBookings?: number;
  totalRevenue?: number;
  totalDiscountGiven?: number;
  lastUsedAt?: admin.firestore.Timestamp | null;
};

function normCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function tsToMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof admin.firestore.Timestamp) return v.toMillis();
  if (
    typeof v === "object" &&
    v !== null &&
    "toMillis" in v &&
    typeof (v as { toMillis: () => number }).toMillis === "function"
  ) {
    return (v as admin.firestore.Timestamp).toMillis();
  }
  return null;
}

function regionAllowed(allowed: string[] | undefined, region: string): boolean {
  if (!allowed?.length) return true;
  const r = String(region ?? "").trim().toLowerCase();
  return allowed.some((a) => String(a).trim().toLowerCase() === r);
}

function fieldAllowed(allowed: string[] | undefined, fieldId: string): boolean {
  if (!allowed?.length) return true;
  return allowed.map(String).includes(String(fieldId));
}

function computeDiscount(
  bookingAmount: number,
  discountType: string,
  discountValue: number,
): { discountAmount: number; finalPrice: number } {
  const amt = Math.max(0, Math.round(Number(bookingAmount)));
  let disc = 0;
  if (discountType === "percent") {
    const p = Math.min(100, Math.max(0, Number(discountValue)));
    disc = Math.round((amt * p) / 100);
  } else {
    disc = Math.round(Math.max(0, Number(discountValue)));
  }
  if (disc > amt) disc = amt;
  const finalPrice = Math.max(0, amt - disc);
  return { discountAmount: disc, finalPrice };
}

async function countUserPromoUses(
  db: admin.firestore.Firestore,
  userId: string,
  codeId: string,
): Promise<number> {
  const snap = await db
    .collection("promoCodeUsages")
    .where("userId", "==", userId)
    .get();
  let n = 0;
  for (const d of snap.docs) {
    const x = d.data() as { promoCode?: string };
    if (x.promoCode === codeId) n++;
  }
  return n;
}

async function countConfirmedBookings(
  db: admin.firestore.Firestore,
  userId: string,
): Promise<number> {
  const snap = await db
    .collection("bookings")
    .where("playerUserId", "==", userId)
    .where("status", "==", "confirmed")
    .get();
  return snap.size;
}

export type ValidateBody = {
  code?: string;
  userId?: string;
  fieldId?: string;
  region?: string;
  bookingAmount?: number;
};

export type PromoJwtPayload = {
  v: 1;
  code: string;
  userId: string;
  fieldId: string;
  region: string;
  bookingAmount: number;
  discountAmount: number;
  finalPrice: number;
};

export async function runPromoValidation(
  body: ValidateBody,
): Promise<{
  valid: boolean;
  discountAmount: number;
  finalPrice: number;
  message: string;
  validationToken?: string;
}> {
  const codeRaw = normCode(String(body.code ?? ""));
  const userId = String(body.userId ?? "").trim();
  const fieldId = String(body.fieldId ?? "").trim();
  const region = String(body.region ?? "").trim();
  const bookingAmount = Number(body.bookingAmount);

  if (!codeRaw) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "أدخل رمز الكوبون",
    };
  }
  if (!userId) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "معرّف المستخدم مطلوب",
    };
  }
  if (!fieldId) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "معرّف الملعب مطلوب",
    };
  }
  if (!Number.isFinite(bookingAmount) || bookingAmount <= 0) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: 0,
      message: "مبلغ الحجز غير صالح",
    };
  }

  const db = getPromoDb();
  const ref = db.collection("promoCodes").doc(codeRaw);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "الكوبون غير موجود",
    };
  }

  const d = snap.data() as PromoDoc;
  if (d.isActive === false) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "الكوبون غير مفعّل",
    };
  }

  const expMs = tsToMs(d.expiresAt ?? null);
  if (expMs != null && Date.now() > expMs) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "انتهت صلاحية الكوبون",
    };
  }

  const usedCount = Number(d.usedCount ?? 0);
  const maxUses = Number(d.maxUses ?? 999999);
  if (usedCount >= maxUses) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "استُنفدت عدد مرات استخدام هذا الكوبون",
    };
  }

  const allowedUsers = d.allowedUserIds;
  if (allowedUsers?.length && !allowedUsers.includes(userId)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "لا يمكنك استخدام هذا الكوبون",
    };
  }

  if (!regionAllowed(d.allowedRegions, region)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "الكوبون غير صالح لهذه المنطقة",
    };
  }

  if (!fieldAllowed(d.allowedFieldIds, fieldId)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "الكوبون غير صالح لهذا الملعب",
    };
  }

  const minAmt = Number(d.minBookingAmount ?? 0);
  if (bookingAmount < minAmt) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: `Minimum booking amount ${new Intl.NumberFormat("en-US").format(minAmt)} IQD`,
    };
  }

  if (d.firstTimeUsersOnly) {
    const n = await countConfirmedBookings(db, userId);
    if (n > 0) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: bookingAmount,
        message: "الكوبون للمستخدمين الجدد فقط (أول حجز)",
      };
    }
  }

  const perUser = Number(d.usagePerUserLimit ?? 1);
  const uses = await countUserPromoUses(db, userId, codeRaw);
  if (uses >= perUser) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "استخدمت هذا الكوبون بالحد المسموح",
    };
  }

  const dtype = d.discountType === "percent" ? "percent" : "fixed";
  const dval = Number(d.discountValue ?? 0);
  const { discountAmount, finalPrice } = computeDiscount(
    bookingAmount,
    dtype,
    dval,
  );

  if (discountAmount <= 0) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "لا يوجد خصم لهذا المبلغ",
    };
  }

  const secret =
    process.env.PROMO_JWT_SECRET?.trim() ||
    process.env.SESSION_SECRET ||
    "shootha_secret_2026";

  const payload: PromoJwtPayload = {
    v: 1,
    code: codeRaw,
    userId,
    fieldId,
    region,
    bookingAmount,
    discountAmount,
    finalPrice,
  };

  const validationToken = jwt.sign(payload, secret, { expiresIn: "15m" });

  return {
    valid: true,
    discountAmount,
    finalPrice,
    message: "تم تطبيق الكوبون",
    validationToken,
  };
}

export async function runPromoRedeem(
  validationToken: string,
  bookingId: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const bid = String(bookingId ?? "").trim();
  if (!bid) return { ok: false, message: "معرّف الحجز مطلوب" };
  if (!validationToken?.trim()) {
    return { ok: false, message: "رمز التحقق مفقود" };
  }

  let payload: PromoJwtPayload;
  try {
    payload = jwt.verify(validationToken.trim(), secret) as PromoJwtPayload;
  } catch {
    return { ok: false, message: "انتهت صلاحية الكوبون — أعد التطبيق" };
  }

  if (payload.v !== 1 || !payload.code || !payload.userId) {
    return { ok: false, message: "بيانات الكوبون غير صالحة" };
  }

  const db = getPromoDb();
  const bookingRef = db.collection("bookings").doc(bid);
  const usageRef = db.collection("promoCodeUsages").doc(bid);
  const promoRef = db.collection("promoCodes").doc(payload.code);

  try {
    await db.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      const usageSnap = await tx.get(usageRef);
      const promoSnap = await tx.get(promoRef);

      if (!bookingSnap.exists) {
        throw new Error("الحجز غير موجود");
      }
      const b = bookingSnap.data() as Record<string, unknown>;
      if (String(b.playerUserId ?? "") !== payload.userId) {
        throw new Error("الحجز لا يخص هذا المستخدم");
      }
      if (String(b.venueId ?? "") !== payload.fieldId) {
        throw new Error("الملعب لا يطابق الكوبون");
      }
      const tp = Number(b.totalPrice);
      if (!Number.isFinite(tp) || tp !== payload.finalPrice) {
        throw new Error("مبلغ الحجز لا يطابق الكوبون — أعد التحقق");
      }

      if (usageSnap.exists) {
        throw new Error("تم تسجيل كوبون لهذا الحجز مسبقاً");
      }

      if (!promoSnap.exists) {
        throw new Error("الكوبون غير موجود");
      }

      const d = promoSnap.data() as PromoDoc;
      if (d.isActive === false) {
        throw new Error("الكوبون غير مفعّل");
      }
      const expMs = tsToMs(d.expiresAt ?? null);
      if (expMs != null && Date.now() > expMs) {
        throw new Error("انتهت صلاحية الكوبون");
      }
      const usedCount = Number(d.usedCount ?? 0);
      const maxUses = Number(d.maxUses ?? 999999);
      if (usedCount >= maxUses) {
        throw new Error("استُنفد الكوبون");
      }
      if (!regionAllowed(d.allowedRegions, payload.region)) {
        throw new Error("منطقة غير مسموحة");
      }
      if (!fieldAllowed(d.allowedFieldIds, payload.fieldId)) {
        throw new Error("ملعب غير مسموح");
      }
      const minAmt = Number(d.minBookingAmount ?? 0);
      if (payload.bookingAmount < minAmt) {
        throw new Error("مبلغ الحجز أقل من الحد الأدنى");
      }

      const usesQ = await tx.get(
        db
          .collection("promoCodeUsages")
          .where("userId", "==", payload.userId)
          .limit(50),
      );
      const perUser = Number(d.usagePerUserLimit ?? 1);
      let userUses = 0;
      for (const doc of usesQ.docs) {
        if (doc.id === bid) continue;
        const u = doc.data() as { promoCode?: string };
        if (u.promoCode === payload.code) userUses++;
      }
      if (userUses >= perUser) {
        throw new Error("تجاوزت حد الاستخدام لهذا الكوبون");
      }

      if (d.firstTimeUsersOnly) {
        const booksQ = await tx.get(
          db
            .collection("bookings")
            .where("playerUserId", "==", payload.userId)
            .where("status", "==", "confirmed")
            .limit(20),
        );
        const others = booksQ.docs.filter((x) => x.id !== bid);
        if (others.length > 0) {
          throw new Error("الكوبون للمستخدمين الجدد فقط");
        }
      }

      const { discountAmount, finalPrice } = computeDiscount(
        payload.bookingAmount,
        d.discountType === "percent" ? "percent" : "fixed",
        Number(d.discountValue ?? 0),
      );
      if (
        discountAmount !== payload.discountAmount ||
        finalPrice !== payload.finalPrice
      ) {
        throw new Error("تغيّرت شروط الكوبون — أعد التطبيق");
      }

      tx.set(usageRef, {
        promoCode: payload.code,
        bookingId: bid,
        userId: payload.userId,
        fieldId: payload.fieldId,
        region: payload.region,
        bookingAmount: payload.bookingAmount,
        discountAmount: payload.discountAmount,
        finalPrice: payload.finalPrice,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(promoRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        totalBookings: admin.firestore.FieldValue.increment(1),
        totalRevenue: admin.firestore.FieldValue.increment(payload.finalPrice),
        totalDiscountGiven: admin.firestore.FieldValue.increment(
          payload.discountAmount,
        ),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(bookingRef, {
        promoCode: payload.code,
        promoDiscountAmount: payload.discountAmount,
        bookingSubtotalBeforePromo: payload.bookingAmount,
      });
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذر تسجيل الكوبون";
    return { ok: false, message: msg };
  }
}

export function registerPromoRoutes(app: Express, jwtSecret: string): void {
  app.post("/api/promo/validate", async (req: Request, res: Response) => {
    if (!isPromoFirestoreConfigured()) {
      return res.status(503).json({
        valid: false,
        discountAmount: 0,
        finalPrice: Number(req.body?.bookingAmount) || 0,
        message: "خادم الكوبونات غير مُضبط (Firebase Admin)",
      });
    }
    try {
      const out = await runPromoValidation(req.body as ValidateBody);
      return res.json(out);
    } catch (e) {
      console.error("[POST /api/promo/validate]", e);
      return res.status(500).json({
        valid: false,
        discountAmount: 0,
        finalPrice: Number(req.body?.bookingAmount) || 0,
        message: "خطأ في الخادم",
      });
    }
  });

  app.post("/api/promo/redeem", async (req: Request, res: Response) => {
    if (!isPromoFirestoreConfigured()) {
      return res.status(503).json({ success: false, message: "Promo backend off" });
    }
    const validationToken = String(req.body?.validationToken ?? "").trim();
    const bookingId = String(req.body?.bookingId ?? "").trim();
    const secret =
      process.env.PROMO_JWT_SECRET?.trim() || jwtSecret;

    const result = await runPromoRedeem(validationToken, bookingId, secret);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, message: "تم تسجيل الكوبون" });
  });
}
