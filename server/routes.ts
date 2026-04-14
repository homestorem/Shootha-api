import "./loadEnv.ts";
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import * as admin from "firebase-admin";
import axios from "axios";
import { normalizePrepaidCardCode, storage } from "./storage.ts";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import { sendPushNotifications, sendPushToUser } from "./utils/expoPush.ts";
import {
  fetchVenuesFromFirestore,
  getVenueByIdFromFirestore,
  getFirestoreFieldOwnerUserId,
  isFirebaseEnvConfigured,
  type VenueApiShape,
} from "./firestoreVenues.ts";
import { registerPromoRoutes } from "./promoService.ts";
import { registerWaylRoutes } from "./waylRoutes.ts";
import {
  adminCreditWallet,
  adminDebitWallet,
  ensureFirebaseAdminApp,
  getWalletAdmin,
  isWalletFirestoreConfigured,
} from "./walletFirestore.ts";
const JWT_SECRET = process.env.SESSION_SECRET || "shootha_secret_2026";
const SUPERVISOR_MASTER_KEY = process.env.SUPERVISOR_MASTER_KEY || "shootha_supervisor_2026";
/** مفتاح إنشاء بطاقات رصيد (يُرسل في الهيدر X-Prepaid-Admin-Key) — عيّنه في الإنتاج */
const PREPAID_CARD_ADMIN_KEY = process.env.PREPAID_CARD_ADMIN_KEY?.trim() ?? "";

/** 4 أرقام — يطابق واجهة التطبيق وخادم OTP IQ (server/index.js) */
function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/\s+/g, "").replace(/[()-]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = "964" + p.slice(1);
  if (p.startsWith("7") && p.length === 10) p = "964" + p;
  return p.replace(/\D/g, "");
}

const OTP_IQ_SMS_URL = "https://api.otpiq.com/api/sms";

/** أرقام فقط (مثل 9647XXXXXXXXX) → +964… لـ OTP IQ */
function phoneDigitsToOtpiqE164(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("964")) return `+${d}`;
  if (d.startsWith("0")) return `+964${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("7")) return `+964${d}`;
  return d ? `+${d}` : "";
}

/** إرسال SMS عبر OTP IQ (نفس منطق server/index.js) */
async function sendOtpiqVerificationSms(
  phoneDigits: string,
  verificationCode: string,
  apiKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const phoneNumber = phoneDigitsToOtpiqE164(phoneDigits);
  if (!/^\+964\d{10}$/.test(phoneNumber)) {
    return { ok: false, message: "صيغة رقم غير مدعومة لإرسال SMS" };
  }
  try {
    const response = await axios.post(
      OTP_IQ_SMS_URL,
      {
        phoneNumber,
        smsType: "verification",
        provider: "sms",
        verificationCode,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    if (response.status >= 200 && response.status < 300) {
      return { ok: true };
    }
    const data = response.data as { error?: string } | undefined;
    const errText =
      typeof data?.error === "string" && data.error
        ? data.error
        : `فشل مزوّد الرسائل (${response.status})`;
    return { ok: false, message: errText };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "SMS error";
    return { ok: false, message: msg };
  }
}

function bookingTimeToMinutes(t: string): number {
  const parts = String(t).split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  return h * 60 + m;
}

function bookingsOverlapMinutes(
  startA: string,
  durationHoursA: number,
  startB: string,
  durationHoursB: number,
): boolean {
  const a0 = bookingTimeToMinutes(startA);
  const a1 = a0 + durationHoursA * 60;
  const b0 = bookingTimeToMinutes(startB);
  const b1 = b0 + durationHoursB * 60;
  return !(a1 <= b0 || a0 >= b1);
}

async function resolveOwnerForVenueBooking(
  venueId: string,
): Promise<{ ownerId: string; fieldSize: string } | null> {
  const owner = await storage.getAuthUserById(venueId);
  if (owner && owner.role === "owner" && owner.venueName) {
    return { ownerId: owner.id, fieldSize: owner.fieldSize ?? "5×5" };
  }
  if (isFirebaseEnvConfigured()) {
    const fsVenue = await getVenueByIdFromFirestore(venueId);
    if (fsVenue) {
      const linked = await getFirestoreFieldOwnerUserId(venueId);
      return {
        ownerId: linked || venueId,
        fieldSize: fsVenue.fieldSizes?.[0] ?? "5×5",
      };
    }
  }
  return null;
}

function otpErrorMessage(reason: string): string {
  if (reason === "expired") return "انتهت صلاحية رمز التحقق، أعد الإرسال";
  if (reason === "locked") return "تم تجاوز عدد المحاولات، حاول لاحقاً";
  return "رمز التحقق غير صحيح";
}

function validateDateOfBirth(value?: string): { ok: true } | { ok: false; message: string } {
  if (!value) return { ok: true };
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, message: "صيغة تاريخ الميلاد غير صحيحة (YYYY-MM-DD)" };
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return { ok: false, message: "تاريخ الميلاد غير صالح" };
  }
  const now = new Date();
  if (dt > now) return { ok: false, message: "تاريخ الميلاد لا يمكن أن يكون في المستقبل" };
  const minAge = 10;
  const maxAge = 100;
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
  if (age < minAge) return { ok: false, message: `العمر الأدنى للتسجيل ${minAge} سنوات` };
  if (age > maxAge) return { ok: false, message: "تاريخ الميلاد غير منطقي" };
  return { ok: true };
}

function signToken(userId: string, role: string, expiresIn: string = "30d"): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn } as any);
}

function safeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    dateOfBirth: user.dateOfBirth ?? null,
    profileImage: user.profileImage ?? null,
    gender: user.gender ?? null,
  };
}

function safeOwnerUser(user: any) {
  let images: string[] = [];
  try {
    images = user.venueImages ? JSON.parse(user.venueImages) : [];
  } catch {}
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    dateOfBirth: user.dateOfBirth ?? null,
    profileImage: user.profileImage ?? null,
    venueName: user.venueName ?? null,
    areaName: user.areaName ?? null,
    fieldSize: user.fieldSize ?? null,
    bookingPrice: user.bookingPrice ?? null,
    hasBathrooms: user.hasBathrooms ?? null,
    hasMarket: user.hasMarket ?? null,
    latitude: user.latitude ?? null,
    longitude: user.longitude ?? null,
    venueImages: images,
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    (req as any).userId = payload.userId;
    (req as any).userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
  }
}

/** يطابق constants/guestAccess: إن لم يُعيّن GUEST_FULL_ACCESS=0 يُسمح بالمحفظة كضيف بدون Bearer */
function guestFullAccessOnServer(): boolean {
  return process.env.GUEST_FULL_ACCESS !== "0";
}

/** محفظة: JWT إن وُجد، وإلا مستخدم guest عند تفعيل الوصول الكامل للضيف */
export function walletAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      (req as any).userId = payload.userId;
      (req as any).userRole = payload.role;
      return next();
    } catch {
      return res.status(401).json({ message: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
    }
  }
  if (guestFullAccessOnServer()) {
    (req as any).userId = "guest";
    (req as any).userRole = "guest";
    return next();
  }
  return res.status(401).json({ message: "غير مصرح" });
}

export function supervisorGuard(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).userRole;
  if (role === "supervisor" && req.method !== "GET") {
    return res.status(403).json({ message: "المشرف المؤقت لديه صلاحيات عرض فقط" });
  }
  next();
}

function ownerGuard(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).userRole;
  if (role !== "owner") {
    return res.status(403).json({ message: "متاح لأصحاب الملاعب فقط" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body as { phone: string };
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ message: "رقم الهاتف غير صحيح" });
      }
      const sendCheck = await storage.canSendOtp(normalizedPhone);
      if (!sendCheck.ok) {
        return res.status(429).json({
          message: `انتظر ${sendCheck.retryAfterSec} ثانية قبل طلب رمز جديد`,
          retryAfterSec: sendCheck.retryAfterSec,
        });
      }
      const otp = generateOtp();
      const iqKey = process.env.OTP_IQ_API_KEY?.trim();
      if (iqKey) {
        const sms = await sendOtpiqVerificationSms(normalizedPhone, otp, iqKey);
        if (!sms.ok) {
          console.error("[OTP] OTP IQ send failed:", sms.message);
          return res.status(502).json({
            message: sms.message || "تعذر إرسال الرسالة النصية. حاول لاحقاً.",
          });
        }
      } else {
        console.warn(
          `[OTP] OTP_IQ_API_KEY غير مضبوط — لم يُرسل SMS. للتطوير فقط: ${normalizedPhone} → ${otp}`,
        );
      }

      await storage.storeOtp(normalizedPhone, otp);
      if (!iqKey) {
        console.log(`[OTP] ${normalizedPhone} → ${otp}`);
      }

      return res.json({ message: "تم إرسال رمز التحقق" });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  /** تحقق من OTP فقط (للتطبيق عبر Firebase phone flow — نفس تخزين send-otp) */
  app.post("/api/otp/verify", async (req, res) => {
    try {
      const { phone, code } = req.body as { phone?: string; code?: string };
      const normalizedPhone = normalizePhone(phone ?? "");
      const clean = String(code ?? "").replace(/\s/g, "");
      if (!normalizedPhone || normalizedPhone.length < 10 || !clean) {
        return res.status(400).json({ success: false, error: "رقم الجوال أو الرمز ناقص" });
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, clean);
      if (!otpCheck.ok) {
        return res.status(400).json({
          success: false,
          error: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec,
        });
      }
      return res.json({ success: true, message: "verified" });
    } catch {
      return res.status(500).json({ success: false, error: "خطأ في الخادم" });
    }
  });

  /**
   * فصل Shootha (player) عن Shootha Business (owner/supervisor):
   * إذا الرقم مرتبط بحساب بزنس، يُمنع استخدامه في تطبيق اللاعب.
   */
  app.post("/api/auth/player-access-check", async (req, res) => {
    try {
      const { phone } = req.body as { phone?: string };
      const normalizedPhone = normalizePhone(phone ?? "");
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ ok: false, message: "رقم الهاتف غير صحيح" });
      }
      const user = await storage.getAuthUserByPhone(normalizedPhone);
      if (!user) {
        return res.json({ ok: true });
      }
      if (user.role === "owner" || user.role === "supervisor") {
        return res.status(403).json({
          ok: false,
          blockedRole: user.role,
          message:
            "هذا الرقم مرتبط بحساب Shootha Business. أنشئ حساباً جديداً في تطبيق Shootha برقم مختلف.",
        });
      }
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, message: "خطأ في الخادم" });
    }
  });

  /**
   * Custom token للاعب المسجّل — claim `e164` يطابق مستند users وحقول userId في chats (قواعد الدعم).
   */
  app.post("/api/auth/custom-token", async (req, res) => {
    try {
      const { phone } = req.body as { phone?: string };
      const digits = normalizePhone(phone ?? "");
      const e164 = phoneDigitsToOtpiqE164(digits);
      if (!/^\+964\d{10}$/.test(e164)) {
        return res.status(400).json({ message: "رقم غير صالح" });
      }
      if (!isWalletFirestoreConfigured()) {
        return res.status(503).json({ message: "خادم Firebase غير مُضبط" });
      }
      ensureFirebaseAdminApp();
      const db = admin.firestore();
      const userSnap = await db.collection("users").doc(e164).get();
      if (!userSnap.exists) {
        return res.status(404).json({ message: "لا يوجد حساب" });
      }
      const uid = `sh_${digits}`;
      const uData = userSnap.data() as Record<string, unknown> | undefined;
      const playerId =
        typeof uData?.playerId === "string" ? String(uData.playerId).trim() : "";
      const claims: Record<string, string> = { e164 };
      if (playerId) claims.playerId = playerId;
      const token = await admin.auth().createCustomToken(uid, claims);
      return res.json({ token });
    } catch (e) {
      console.error("[custom-token]", e);
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const {
        phone, name, role, otp, deviceId,
        password, dateOfBirth, profileImage,
        venueName, areaName, fieldSize, bookingPrice,
        hasBathrooms, hasMarket, latitude, longitude,
        venueImages, ownerDeviceLat, ownerDeviceLon,
        userLat, userLon, gender,
      } = req.body as any;

      if (!phone || !name || !role || !otp) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }
      const dobCheck = validateDateOfBirth(dateOfBirth);
      if (!dobCheck.ok) {
        return res.status(400).json({ message: dobCheck.message });
      }
      const normalizedPhone = normalizePhone(phone);
      const existingPhone = await storage.getAuthUserByPhone(normalizedPhone);
      if (existingPhone) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً" });
      }
      if (role === "owner" && venueName) {
        const existingVenue = await storage.getAuthUserByVenueName(venueName);
        if (existingVenue) {
          return res.status(409).json({ message: "اسم الملعب مستخدم مسبقاً" });
        }
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, otp);
      if (!otpCheck.ok) {
        return res.status(400).json({
          message: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec,
        });
      }
      const playerLat = role === "player" ? (userLat ?? latitude) : latitude;
      const playerLon = role === "player" ? (userLon ?? longitude) : longitude;
      const user = await storage.createAuthUser({
        phone: normalizedPhone, name, role, deviceId,
        dateOfBirth, profileImage,
        venueName, areaName, fieldSize, bookingPrice,
        hasBathrooms, hasMarket,
        latitude: playerLat,
        longitude: playerLon,
        venueImages,
        ownerDeviceLat,
        ownerDeviceLon,
        gender,
      });
      const token = signToken(user.id, user.role);
      return res.json({ token, user: safeUser(user) });
    } catch (e) {
      console.error("Register error:", e);
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, otp } = req.body as { phone: string; otp: string };
      if (!phone || !otp) {
        return res.status(400).json({ message: "رقم الهاتف والرمز مطلوبان" });
      }
      const normalizedPhone = normalizePhone(phone);
      const user = await storage.getAuthUserByPhone(normalizedPhone);
      if (!user) {
        return res.status(404).json({ message: "الحساب غير موجود، يرجى التسجيل أولاً" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "تم حظر هذا الحساب" });
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, otp);
      if (!otpCheck.ok) {
        return res.status(400).json({
          message: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec,
        });
      }
      const token = signToken(user.id, user.role);
      return res.json({ token, user: safeUser(user) });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      return res.json(safeUser(user));
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.get("/api/wallet", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const rawLimit = req.query.limit;
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit ?? "20"), 10) || 20),
      );
      if (isWalletFirestoreConfigured()) {
        const { balance, transactions } = await getWalletAdmin(userId, limit);
        return res.json({ balance, transactions });
      }
      const [balance, transactions] = await Promise.all([
        storage.getWalletBalance(userId),
        storage.getWalletTransactions(userId, limit),
      ]);
      return res.json({ balance, transactions });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/wallet/redeem", walletAuthMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { code } = req.body as { code?: string };
      const result = await storage.redeemPrepaidCard(userId, code ?? "");
      if (!result.ok) {
        return res.status(400).json({ message: result.message });
      }
      if (isWalletFirestoreConfigured() && userId && userId !== "guest") {
        try {
          const norm = normalizePrepaidCardCode(code ?? "");
          const credit = await adminCreditWallet({
            userId,
            amount: result.amount,
            label: `شحن بطاقة ${norm.slice(0, 4)}…`,
            idempotencyKey: `redeem:${norm}`,
          });
          return res.json({ amount: result.amount, balance: credit.balance });
        } catch (e: any) {
          console.error("[wallet/redeem] Firestore credit failed after prepaid OK:", e);
          return res.status(500).json({
            message:
              "تم قبول البطاقة لكن فشل إضافة الرصيد للمحفظة السحابة. تواصل مع الدعم.",
          });
        }
      }
      return res.json({ amount: result.amount, balance: result.balance });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/wallet/pay", walletAuthMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const body = req.body as {
        amount?: number;
        label?: string;
        bookingId?: string | null;
        idempotencyKey?: string;
      };
      const amount = Math.round(Number(body.amount ?? 0));
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "المبلغ غير صالح" });
      }
      const label = typeof body.label === "string" ? body.label : "";
      const bookingId =
        body.bookingId != null && String(body.bookingId).trim() !== ""
          ? String(body.bookingId).trim()
          : null;
      const idempotencyKey =
        String(body.idempotencyKey ?? "").trim() ||
        `pay:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

      if (userId === "guest") {
        return res.status(400).json({ message: "سجّل الدخول لاستخدام المحفظة" });
      }

      if (isWalletFirestoreConfigured()) {
        try {
          const out = await adminDebitWallet({
            userId,
            amount,
            label,
            bookingId,
            idempotencyKey,
          });
          return res.json({ balance: out.balance, transactionId: out.transactionId });
        } catch (e: any) {
          const msg = e?.message ?? "";
          if (msg === "INSUFFICIENT_FUNDS" || msg.includes("INSUFFICIENT")) {
            return res.status(400).json({ message: "رصيد غير كافٍ" });
          }
          if (msg === "INVALID_DEBIT_PARAMS" || msg.includes("غير صالح")) {
            return res.status(400).json({ message: "بيانات الدفع غير صالحة" });
          }
          console.error("[wallet/pay] Firestore debit:", e);
          return res.status(500).json({ message: "تعذر تنفيذ الدفع" });
        }
      }

      const result = await storage.debitWallet(userId, amount, label);
      if (!result.ok) {
        return res.status(400).json({ message: result.message });
      }
      return res.json({ balance: result.balance });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  /** إنشاء بطاقة رصيد (للمسؤول فقط — لا يستخدم جلسة المستخدم) */
  app.post("/api/admin/prepaid-cards", async (req, res) => {
    const headerKey = String(req.headers["x-prepaid-admin-key"] ?? "").trim();
    if (!PREPAID_CARD_ADMIN_KEY || headerKey !== PREPAID_CARD_ADMIN_KEY) {
      return res.status(401).json({ message: "غير مصرح — عيّن PREPAID_CARD_ADMIN_KEY في السيرفر وأرسل X-Prepaid-Admin-Key" });
    }
    try {
      const { code, amount } = req.body as { code?: string; amount?: number };
      await storage.createPrepaidCard(code ?? "", amount ?? 0);
      return res.json({ message: "تم إنشاء بطاقة الرصيد" });
    } catch (e: any) {
      return res.status(400).json({ message: e?.message ?? "فشل إنشاء البطاقة" });
    }
  });

  app.patch("/api/auth/location", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { latitude, longitude } = req.body as { latitude: string; longitude: string };
      await storage.updateAuthUser(userId, { latitude, longitude });
      return res.json({ message: "تم تحديث الموقع" });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });


  app.patch("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name, dateOfBirth, profileImage, gender } = req.body as {
        name?: string;
        dateOfBirth?: string;
        profileImage?: string;
        gender?: string;
      };
      if (name !== undefined && name.trim().length < 2) {
        return res.status(400).json({ message: "الاسم يجب أن يكون حرفين على الأقل" });
      }
      const updated = await storage.updateUserProfile(userId, {
        name: name?.trim(),
        dateOfBirth,
        profileImage,
        gender,
      });
      return res.json({ message: "تم تحديث الملف الشخصي", user: safeUser(updated) });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.delete("/api/user/account", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      if (user.role === "owner") {
        const bookings = await storage.getOwnerBookings(userId);
        const upcoming = bookings.filter((b) => b.status === "upcoming");
        if (upcoming.length > 0) {
          return res.status(409).json({
            message: `لا يمكن حذف الحساب — لديك ${upcoming.length} حجز قادم. يرجى إلغاء جميع الحجوزات أولاً`,
          });
        }
      }
      await storage.softDeleteUser(userId);
      console.log(`[DELETE] User ${userId} soft-deleted`);
      return res.json({ message: "تم حذف الحساب بنجاح" });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/user/phone/send-otp", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { newPhone } = req.body as { newPhone: string };
      const normalizedPhone = normalizePhone(newPhone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ message: "رقم الهاتف غير صحيح" });
      }
      const existing = await storage.getAuthUserByPhone(normalizedPhone);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً لدى حساب آخر" });
      }
      const sendCheck = await storage.canSendOtp(`phone_change_${userId}_${normalizedPhone}`);
      if (!sendCheck.ok) {
        return res.status(429).json({
          message: `انتظر ${sendCheck.retryAfterSec} ثانية قبل طلب رمز جديد`,
          retryAfterSec: sendCheck.retryAfterSec,
        });
      }
      const otp = generateOtp();
      await storage.storeOtp(`phone_change_${userId}_${normalizedPhone}`, otp);
      console.log(`[PHONE OTP] user=${userId} newPhone=${normalizedPhone} otp=${otp}`);

      return res.json({ message: "تم إرسال رمز التحقق" });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/user/phone", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { newPhone, otp } = req.body as { newPhone: string; otp: string };
      if (!newPhone || !otp) {
        return res.status(400).json({ message: "الرقم ورمز التحقق مطلوبان" });
      }
      const normalizedPhone = normalizePhone(newPhone);
      const check = await storage.verifyOtp(`phone_change_${userId}_${normalizedPhone}`, otp.trim());
      if (!check.ok) {
        return res.status(400).json({
          message: otpErrorMessage(check.reason),
          retryAfterSec: check.retryAfterSec,
        });
      }
      const existing = await storage.getAuthUserByPhone(normalizedPhone);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً لدى حساب آخر" });
      }
      await storage.updateAuthUser(userId, { phone: normalizedPhone });
      const user = await storage.getAuthUserById(userId);
      console.log(`[PHONE UPDATE] user=${userId} newPhone=${normalizedPhone}`);
      return res.json({ message: "تم تحديث رقم الهاتف بنجاح", user: safeUser(user!) });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/support/message", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { subject, message } = req.body as { subject: string; message: string };
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ message: "الموضوع والرسالة مطلوبان" });
      }
      const msg = await storage.createSupportMessage({
        userId,
        subject: subject.trim(),
        message: message.trim(),
      });
      console.log(`[SUPPORT] #${msg.id} from ${userId}: "${subject}"`);
      return res.json({ message: "تم إرسال رسالتك، سنتواصل معك قريباً", id: msg.id });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.get("/api/support/messages", authMiddleware, async (req, res) => {
    try {
      const role = (req as any).userRole;
      if (role !== "supervisor") {
        return res.status(403).json({ message: "غير مصرح" });
      }
      const messages = await storage.getSupportMessages();
      return res.json({ messages });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/notifications/register-token", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { expoPublicToken } = req.body as { expoPublicToken: string };
      if (!expoPublicToken || typeof expoPublicToken !== "string") {
        return res.status(400).json({ message: "التوكن مطلوب" });
      }
      if (
        !expoPublicToken.startsWith("ExponentPushToken[") &&
        !expoPublicToken.startsWith("ExpoPushToken[")
      ) {
        return res.status(400).json({ message: "صيغة التوكن غير صحيحة" });
      }
      await storage.updateAuthUser(userId, { expoPublicToken });
      console.log(`[PUSH] Token registered for user ${userId}`);
      return res.json({ message: "تم حفظ التوكن" });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/admin/send-notification", authMiddleware, async (req, res) => {
    try {
      const role = (req as any).userRole;
      if (role !== "supervisor" && role !== "owner") {
        return res.status(403).json({ message: "غير مصرح" });
      }
      const { title, body, target, image } = req.body as {
        title: string;
        body: string;
        target?: "players" | "owners" | "all";
        image?: string;
      };
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "العنوان والنص مطلوبان" });
      }
      const allUsers = await storage.getAllAuthUsers();
      let targets = allUsers;
      if (target === "players") targets = allUsers.filter((u) => u.role === "player");
      else if (target === "owners") targets = allUsers.filter((u) => u.role === "owner");
      const tokens = targets
        .map((u) => u.expoPublicToken)
        .filter((t): t is string => !!t);
      await sendPushNotifications(tokens, title.trim(), body.trim(), undefined, image);
      console.log(`[PUSH] Admin broadcast to ${tokens.length} users`);
      return res.json({ message: `تم إرسال الإشعار إلى ${tokens.length} مستخدم`, count: tokens.length });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.post("/api/auth/supervisor-token", async (req, res) => {
    try {
      const { masterKey, expiryMinutes = 120 } = req.body as {
        masterKey: string;
        expiryMinutes?: number;
      };
      if (masterKey !== SUPERVISOR_MASTER_KEY) {
        return res.status(403).json({ message: "مفتاح الوصول غير صحيح" });
      }
      const clampedExpiry = Math.min(Math.max(expiryMinutes, 10), 480);
      const token = signToken("supervisor", "supervisor", `${clampedExpiry}m`);
      const expiresAt = new Date(Date.now() + clampedExpiry * 60 * 1000).toISOString();
      console.log(`[SUPERVISOR] Token created, expires at ${expiresAt}`);
      return res.json({
        token,
        role: "supervisor",
        expiresAt,
        expiryMinutes: clampedExpiry,
        message: "تم إنشاء رمز المشرف المؤقت",
        permissions: ["view:bookings", "view:venues", "view:revenue", "view:support"],
      });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  // ─── Public Venues API ───────────────────────────────────────────────────

  const VENUE_COLORS = ["#1A2F1A", "#1A1A2F", "#2F1A1A", "#2F2A1A", "#1A2A2F"];
  function getVenueColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return VENUE_COLORS[Math.abs(hash) % VENUE_COLORS.length];
  }

  function ownerToVenue(owner: any): VenueApiShape {
    const amenities: string[] = [];
    if (owner.hasBathrooms) amenities.push("دورات مياه");
    if (owner.hasMarket) amenities.push("مطعم/كافيتيريا");
    const price =
      parseInt(String(owner.bookingPrice ?? "").replace(/[^\d]/g, ""), 10) || 0;
    return {
      id: owner.id,
      name: owner.venueName ?? "ملعب",
      location: owner.areaName ? `${owner.areaName}، الموصل` : "الموصل",
      district: owner.areaName ?? "الموصل",
      rating: 0,
      reviewCount: 0,
      pricePerHour: price,
      fieldSizes: owner.fieldSize ? [owner.fieldSize] : ["5 ضد 5"],
      amenities,
      imageColor: getVenueColor(owner.id),
      isOpen: true,
      openHours: "08:00 - 24:00",
      lat: parseFloat(owner.latitude ?? "36.335") || 36.335,
      lon: parseFloat(owner.longitude ?? "43.119") || 43.119,
    };
  }

  /** وثائق Firestore `fields` + حسابات المالكين في التخزين (لا يُستبدل أحدهما بالآخر) */
  async function listVenuesMerged(): Promise<VenueApiShape[]> {
    const owners = await storage.getAllOwners();
    const fromOwners = owners.map(ownerToVenue);
    if (!isFirebaseEnvConfigured()) {
      return fromOwners;
    }
    let fromFs: VenueApiShape[] = [];
    try {
      fromFs = await fetchVenuesFromFirestore();
    } catch (e) {
      console.error("[GET /api/venues] Firestore read failed (rules/network?) — returning owners only:", e);
    }
    const seen = new Set(fromFs.map((v) => v.id));
    const merged = [...fromFs];
    for (const v of fromOwners) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        merged.push(v);
      }
    }
    return merged;
  }

  app.get("/api/venues", async (_req, res) => {
    try {
      const venues = await listVenuesMerged();
      return res.json({ venues });
    } catch (e: any) {
      console.error("[GET /api/venues]", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });
  app.post("/api/venues", async (req, res) => {
    try {
      if (!isFirebaseEnvConfigured()) {
        return res.status(503).json({ message: "Firebase غير مُضبط على الخادم" });
      }

      const rawName = String(req.body?.name ?? "").trim();
      const rawLocation = String(req.body?.location ?? "").trim();
      const rawPrice = Number(req.body?.price ?? req.body?.pricePerHour ?? 0);

      if (!rawName || !rawLocation || !Number.isFinite(rawPrice) || rawPrice <= 0) {
        return res.status(400).json({ message: "Missing or invalid venue data" });
      }

      ensureFirebaseAdminApp();
      const db = admin.firestore();
      const docRef = db.collection("fields").doc();

      const payload = {
        name: rawName,
        location: rawLocation,
        district: rawLocation,
        pricePerHour: Math.round(rawPrice),
        fieldSizes: ["5 ضد 5"],
        amenities: [] as string[],
        imageColor: getVenueColor(docRef.id),
        isOpen: true,
        openHours: "08:00 – 24:00",
        lat: 36.335,
        lon: 43.119,
        rating: 0,
        reviewCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(payload);

      return res.status(201).json({
        id: docRef.id,
        ...payload,
        createdAt: undefined,
        updatedAt: undefined,
      });
    } catch (e: any) {
      console.error("[POST /api/venues]", e);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app.get("/api/venues/:id", async (req, res) => {
    try {
      if (isFirebaseEnvConfigured()) {
        const fromFs = await getVenueByIdFromFirestore(req.params.id);
        if (fromFs) return res.json(fromFs);
      }
      const owner = await storage.getAuthUserById(req.params.id);
      if (!owner || owner.role !== "owner" || !owner.venueName) {
        return res.status(404).json({ message: "الملعب غير موجود" });
      }
      return res.json(ownerToVenue(owner));
    } catch (e: any) {
      console.error("[GET /api/venues/:id]", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  /** فترات محجوزة ليوم معيّن (بدون بيانات اللاعب) — لشاشة الحجز */
  app.get("/api/venues/:id/bookings", async (req, res) => {
    try {
      const { id } = req.params;
      const date = String(req.query.date ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "استخدم ?date=YYYY-MM-DD" });
      }
      const resolved = await resolveOwnerForVenueBooking(id);
      if (!resolved) return res.json({ bookings: [] });
      const all = await storage.getOwnerBookings(resolved.ownerId);
      const day = all.filter((b) => b.date === date && b.status !== "cancelled");
      return res.json({
        bookings: day.map((b) => ({ time: b.time, duration: b.duration, status: b.status })),
      });
    } catch (e: any) {
      console.error("[GET /api/venues/:id/bookings]", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  /** حجز من تطبيق اللاعب — يُخزَّن مع ownerId ليظهر في داشبورد المالك */
  app.post("/api/bookings", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const venueId = String(body.venueId ?? "").trim();
      const playerName = String(body.playerName ?? "").trim();
      const playerPhone = String(body.playerPhone ?? "").trim();
      const playerUserId = body.playerUserId != null ? String(body.playerUserId).trim() : "";
      const date = String(body.date ?? "").trim();
      const time = String(body.time ?? "").trim();
      const duration = Number(body.duration);
      const totalPrice = Number(body.price);
      const fieldSize = String(body.fieldSize ?? "").trim();
      const venueName = body.venueName != null ? String(body.venueName).trim() : "";
      const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod) : "";
      const paymentPaid = body.paymentPaid !== false;

      if (!venueId || !playerName || !date || !time || !Number.isFinite(duration) || duration <= 0) {
        return res.status(400).json({ message: "بيانات الحجز ناقصة" });
      }
      if (!Number.isFinite(totalPrice) || totalPrice < 0) {
        return res.status(400).json({ message: "السعر غير صالح" });
      }

      const resolved = await resolveOwnerForVenueBooking(venueId);
      if (!resolved) {
        return res.status(404).json({ message: "الملعب غير موجود" });
      }

      const normalizedTime = time.includes(":") ? time : `${String(time).padStart(2, "0")}:00`;
      const hourlyPrice =
        duration > 0 ? Math.round((totalPrice / duration) * 100) / 100 : totalPrice;

      const allBookings = await storage.getOwnerBookings(resolved.ownerId);
      const dayBookings = allBookings.filter((b) => b.date === date && b.status !== "cancelled");
      const conflict = dayBookings.find((b) =>
        bookingsOverlapMinutes(normalizedTime, duration, b.time, b.duration),
      );
      if (conflict) {
        return res.status(409).json({
          message: `الوقت متعارض مع حجز آخر (${conflict.time})`,
        });
      }

      const booking = await storage.createOwnerBooking({
        ownerId: resolved.ownerId,
        playerName,
        playerPhone: playerPhone ? normalizePhone(playerPhone) : null,
        playerUserId: playerUserId || null,
        date,
        time: normalizedTime,
        duration,
        price: hourlyPrice,
        fieldSize: fieldSize || resolved.fieldSize,
        status: "upcoming",
        source: "app",
        paymentMethod: paymentMethod || null,
        paymentPaid,
        venueNameSnapshot: venueName || null,
      });

      const ownerUser = await storage.getAuthUserById(resolved.ownerId);
      if (ownerUser?.expoPublicToken) {
        sendPushToUser(
          ownerUser.expoPublicToken,
          "حجز جديد من التطبيق",
          `${playerName} — ${date} ${normalizedTime}`,
          { bookingId: booking.id },
        ).catch(() => {});
      }

      return res.status(201).json({ booking: { id: booking.id } });
    } catch (e: any) {
      console.error("[POST /api/bookings]", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  /** قائمة حجوزات اللاعب (لمزامنة التطبيق) */
  app.get("/api/bookings/player", async (req, res) => {
    try {
      const playerUserId = String(req.query.playerUserId ?? "").trim() || null;
      const phone = String(req.query.phone ?? "").trim() || null;
      if (!playerUserId && !phone) {
        return res.status(400).json({ message: "playerUserId أو phone مطلوب" });
      }
      const list = await storage.getBookingsForPlayer(playerUserId, phone);
      return res.json({ bookings: list });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  /** إلغاء حجز من التطبيق (يتحقق من رقم الجوال أو معرّف اللاعب) */
  app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body as {
        status?: string;
        cancelledWhileUiStatus?: string;
        cancellationSnapshot?: Record<string, unknown>;
      };
      const status = String(body?.status ?? "");
      if (status !== "cancelled") {
        return res.status(400).json({ message: "حالة غير مدعومة" });
      }
      const playerUserId = String(req.query.playerUserId ?? "").trim() || null;
      const phone = String(req.query.phone ?? "").trim() || null;
      if (!playerUserId && !phone) {
        return res.status(400).json({ message: "playerUserId أو phone مطلوب للتحقق" });
      }
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "الحجز غير موجود" });
      const byUid = Boolean(playerUserId && booking.playerUserId && booking.playerUserId === playerUserId);
      const byPhone =
        Boolean(phone && booking.playerPhone) &&
        normalizePhone(booking.playerPhone!) === normalizePhone(phone!);
      if (!byUid && !byPhone) {
        return res.status(403).json({ message: "غير مصرح" });
      }
      const w = body.cancelledWhileUiStatus;
      const cancelledWhileUiStatus =
        w === "upcoming" || w === "active" || w === "completed" ? w : undefined;
      await storage.cancelOwnerBooking(id, {
        cancelledWhileUiStatus,
        cancellationSnapshot: body.cancellationSnapshot,
      });
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[PATCH /api/bookings/:id]", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  // ─── Owner API ───────────────────────────────────────────────────────────

  app.get("/api/owner/venue", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      return res.json(safeOwnerUser(user));
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.patch("/api/owner/venue", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { venueName, areaName, fieldSize, bookingPrice, hasBathrooms, hasMarket } =
        req.body as any;
      if (venueName) {
        const existing = await storage.getAuthUserByVenueName(venueName);
        if (existing && existing.id !== userId) {
          return res.status(409).json({ message: "اسم الملعب مستخدم مسبقاً" });
        }
      }
      const updates: any = {};
      if (venueName !== undefined) updates.venueName = venueName;
      if (areaName !== undefined) updates.areaName = areaName;
      if (fieldSize !== undefined) updates.fieldSize = fieldSize;
      if (bookingPrice !== undefined) updates.bookingPrice = bookingPrice;
      if (hasBathrooms !== undefined) updates.hasBathrooms = hasBathrooms;
      if (hasMarket !== undefined) updates.hasMarket = hasMarket;
      await storage.updateAuthUser(userId, updates);
      const user = await storage.getAuthUserById(userId);
      return res.json({ message: "تم تحديث معلومات الملعب", venue: safeOwnerUser(user!) });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/owner/bookings", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { filter } = req.query as { filter?: string };
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const monthStr = now.toISOString().slice(0, 7);
      const yearStr = now.getFullYear().toString();
      let bookings = await storage.getOwnerBookings(userId);
      if (filter === "today") {
        bookings = bookings.filter((b) => b.date === todayStr);
      } else if (filter === "month") {
        bookings = bookings.filter((b) => b.date.startsWith(monthStr));
      } else if (filter === "year") {
        bookings = bookings.filter((b) => b.date.startsWith(yearStr));
      }
      return res.json({ bookings });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/owner/bookings", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getAuthUserById(userId);
      const { playerName, playerPhone, date, time, duration, price, source = "manual" } =
        req.body as any;
      if (!playerName?.trim() || !date || !time || !duration || price === undefined) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }
      const allBookings = await storage.getOwnerBookings(userId);
      const dayBookings = allBookings.filter((b) => b.date === date && b.status !== "cancelled");
      const startHour = parseInt(time);
      const endHour = startHour + Number(duration);
      const conflict = dayBookings.find((b) => {
        const bStart = parseInt(b.time.split(":")[0]);
        const bEnd = bStart + b.duration;
        return !(endHour <= bStart || startHour >= bEnd);
      });
      if (conflict) {
        return res.status(409).json({
          message: `يوجد تعارض مع حجز ${conflict.playerName} الساعة ${conflict.time}`,
        });
      }
      const booking = await storage.createOwnerBooking({
        ownerId: userId,
        playerName: playerName.trim(),
        playerPhone: playerPhone?.trim() ?? null,
        date,
        time: String(time).includes(":") ? time : `${String(time).padStart(2, "0")}:00`,
        duration: Number(duration),
        price: Number(price),
        fieldSize: user?.fieldSize ?? "5×5",
        status: "upcoming",
        source,
      });
      console.log(`[BOOKING] New booking by owner ${userId}: ${playerName} on ${date} at ${time}`);
      if (playerPhone) {
        const player = await storage.getAuthUserByPhone(playerPhone.replace(/\D/g, "").slice(-10).padStart(10, "0")).catch(() => null)
          ?? await storage.getAuthUserByPhone(playerPhone.trim()).catch(() => null);
        if (player?.expoPublicToken) {
          sendPushToUser(
            player.expoPublicToken,
            "حجز جديد ⚽",
            `تم تأكيد حجزك الساعة ${time} بتاريخ ${date} في ${user?.venueName ?? "الملعب"}`,
            { bookingId: booking.id }
          ).catch(() => {});
        }
      }
      return res.status(201).json({ message: "تم إضافة الحجز بنجاح", booking });
    } catch (e: any) {
      console.error("Create booking error:", e);
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/owner/bookings/:id", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params as { id: string };
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "الحجز غير موجود" });
      if (booking.ownerId !== userId) return res.status(403).json({ message: "غير مصرح" });
      const { playerName, playerPhone, date, time, duration, price, status } = req.body as any;
      const updates: any = {};
      if (playerName !== undefined) updates.playerName = playerName;
      if (playerPhone !== undefined) updates.playerPhone = playerPhone;
      if (date !== undefined) updates.date = date;
      if (time !== undefined) updates.time = time;
      if (duration !== undefined) updates.duration = Number(duration);
      if (price !== undefined) updates.price = Number(price);
      if (status !== undefined) updates.status = status;
      const updated = await storage.updateOwnerBooking(id, updates);
      return res.json({ message: "تم تحديث الحجز", booking: updated });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.delete("/api/owner/bookings/:id", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params as { id: string };
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "الحجز غير موجود" });
      if (booking.ownerId !== userId) return res.status(403).json({ message: "غير مصرح" });
      await storage.cancelOwnerBooking(id);
      if (booking.playerPhone) {
        const player = await storage.getAuthUserByPhone(booking.playerPhone.trim()).catch(() => null);
        if (player?.expoPublicToken) {
          sendPushToUser(
            player.expoPublicToken,
            "تم إلغاء الحجز",
            `تم إلغاء حجزك الساعة ${booking.time} بتاريخ ${booking.date}`,
            { bookingId: booking.id }
          ).catch(() => {});
        }
      }
      return res.json({ message: "تم إلغاء الحجز" });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.get("/api/owner/stats", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const allBookings = await storage.getOwnerBookings(userId);
      const nonCancelled = allBookings.filter((b) => b.status !== "cancelled");
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const monthStr = now.toISOString().slice(0, 7);
      const appBookings = nonCancelled.filter((b) => b.source === "app");
      const todayBookings = nonCancelled.filter((b) => b.date === todayStr);
      const monthBookings = nonCancelled.filter((b) => b.date.startsWith(monthStr));
      const totalRevenue = nonCancelled.reduce((sum, b) => sum + b.price * b.duration, 0);
      const todayRevenue = todayBookings.reduce((sum, b) => sum + b.price * b.duration, 0);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const totalAvailableHours = daysInMonth * 16;
      const bookedHours = monthBookings.reduce((sum, b) => sum + b.duration, 0);
      const occupancyRate =
        totalAvailableHours > 0 ? Math.round((bookedHours / totalAvailableHours) * 100) : 0;
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const count = nonCancelled.filter((b) => b.date === dateStr).length;
        const revenue = nonCancelled
          .filter((b) => b.date === dateStr)
          .reduce((sum, b) => sum + b.price * b.duration, 0);
        last7Days.push({ date: dateStr, count, revenue });
      }
      const hourCounts: Record<number, number> = {};
      for (const b of nonCancelled) {
        const startHour = parseInt(b.time.split(":")[0]);
        for (let h = 0; h < b.duration; h++) {
          const hour = startHour + h;
          if (hour <= 23) {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }
        }
      }
      const peakHours = Array.from({ length: 16 }, (_, i) => ({
        hour: i + 8,
        count: hourCounts[i + 8] || 0,
      }));
      return res.json({
        totalBookings: nonCancelled.length,
        appBookings: appBookings.length,
        totalRevenue,
        todayBookings: todayBookings.length,
        todayRevenue,
        occupancyRate,
        last7Days,
        peakHours,
      });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const owners = await storage.getAllOwners();
      for (const owner of owners) {
        const bookings = await storage.getOwnerBookings(owner.id);
        const upcoming = bookings.filter(
          (b) =>
            b.status === "upcoming" &&
            b.date === todayStr &&
            !b.reminderSent
        );
        for (const booking of upcoming) {
          const [bHour, bMin] = booking.time.split(":").map(Number);
          const bookingTime = new Date(now);
          bookingTime.setHours(bHour, bMin ?? 0, 0, 0);
          const diffMs = bookingTime.getTime() - now.getTime();
          const diffMin = diffMs / 60000;
          if (diffMin > 0 && diffMin <= 60) {
            const tokens: string[] = [];
            if (owner.expoPublicToken) tokens.push(owner.expoPublicToken);
            if (booking.playerPhone) {
              const player = await storage.getAuthUserByPhone(booking.playerPhone.trim()).catch(() => null);
              if (player?.expoPublicToken) tokens.push(player.expoPublicToken);
            }
            if (tokens.length > 0) {
              await sendPushNotifications(
                tokens,
                "مبارتك بعد ساعة ⚽",
                `استعد لمباراتك في ${owner.venueName ?? "الملعب"} الساعة ${booking.time}`,
                { bookingId: booking.id }
              );
            }
            await storage.updateOwnerBooking(booking.id, { reminderSent: true });
            console.log(`[CRON] Reminder sent for booking ${booking.id}`);
          }
        }
      }
    } catch (e) {
      console.error("[CRON] Reminder error:", e);
    }
  });

  registerPromoRoutes(app, JWT_SECRET);
  registerWaylRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
