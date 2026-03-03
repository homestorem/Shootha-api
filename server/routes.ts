import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron";
import { sendPushNotifications, sendPushToUser } from "./utils/expoPush";

const JWT_SECRET = process.env.SESSION_SECRET || "shootha_secret_2026";
const SUPERVISOR_MASTER_KEY = process.env.SUPERVISOR_MASTER_KEY || "shootha_supervisor_2026";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "رقم الهاتف غير صحيح" });
      }
      const otp = generateOtp();
      await storage.storeOtp(phone, otp);
      console.log(`[OTP] ${phone} → ${otp}`);
      return res.json({ message: "تم إرسال رمز التحقق", devOtp: otp });
    } catch {
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
      if (!password) {
        return res.status(400).json({ message: "كلمة المرور مطلوبة" });
      }
      const existingPhone = await storage.getAuthUserByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً" });
      }
      if (role === "owner" && venueName) {
        const existingVenue = await storage.getAuthUserByVenueName(venueName);
        if (existingVenue) {
          return res.status(409).json({ message: "اسم الملعب مستخدم مسبقاً" });
        }
      }
      const validOtp = await storage.verifyOtp(phone, otp);
      if (!validOtp) {
        return res.status(400).json({ message: "رمز التحقق غير صحيح أو منتهي" });
      }
      const playerLat = role === "player" ? (userLat ?? latitude) : latitude;
      const playerLon = role === "player" ? (userLon ?? longitude) : longitude;
      const user = await storage.createAuthUser({
        phone, name, role, deviceId,
        password, dateOfBirth, profileImage,
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
      const user = await storage.getAuthUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: "الحساب غير موجود، يرجى التسجيل أولاً" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "تم حظر هذا الحساب" });
      }
      const validOtp = await storage.verifyOtp(phone, otp);
      if (!validOtp) {
        return res.status(400).json({ message: "رمز التحقق غير صحيح أو منتهي" });
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

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { phone, otp, newPassword } = req.body as {
        phone: string;
        otp: string;
        newPassword: string;
      };
      if (!phone || !otp || !newPassword) {
        return res.status(400).json({ message: "بيانات ناقصة" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }
      const otpValid = await storage.verifyOtp(phone, otp);
      if (!otpValid) {
        return res.status(400).json({ message: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }
      const user = await storage.getAuthUserByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateAuthUser(user.id, { passwordHash });
      return res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.patch("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name, dateOfBirth, profileImage } = req.body as {
        name?: string;
        dateOfBirth?: string;
        profileImage?: string;
      };
      if (name !== undefined && name.trim().length < 2) {
        return res.status(400).json({ message: "الاسم يجب أن يكون حرفين على الأقل" });
      }
      const updated = await storage.updateUserProfile(userId, {
        name: name?.trim(),
        dateOfBirth,
        profileImage,
      });
      return res.json({ message: "تم تحديث الملف الشخصي", user: safeUser(updated) });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.delete("/api/user/account", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { password } = req.body as { password: string };
      if (!password) {
        return res.status(400).json({ message: "كلمة المرور مطلوبة" });
      }
      const user = await storage.getAuthUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      if (!user.passwordHash) {
        return res.status(400).json({ message: "لا يمكن التحقق من كلمة المرور" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
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
      if (!newPhone || newPhone.replace(/\D/g, "").length < 10) {
        return res.status(400).json({ message: "رقم الهاتف غير صحيح" });
      }
      const existing = await storage.getAuthUserByPhone(newPhone.trim());
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً لدى حساب آخر" });
      }
      const otp = generateOtp();
      await storage.storeOtp(`phone_change_${userId}_${newPhone.trim()}`, otp);
      console.log(`[PHONE OTP] user=${userId} newPhone=${newPhone} otp=${otp}`);
      return res.json({ message: "تم إرسال رمز التحقق إلى رقمك", devOtp: otp });
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
      const valid = await storage.verifyOtp(`phone_change_${userId}_${newPhone.trim()}`, otp.trim());
      if (!valid) {
        return res.status(400).json({ message: "رمز التحقق غير صحيح أو منتهي الصلاحية" });
      }
      const existing = await storage.getAuthUserByPhone(newPhone.trim());
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "هذا الرقم مسجل مسبقاً لدى حساب آخر" });
      }
      await storage.updateAuthUser(userId, { phone: newPhone.trim() });
      const user = await storage.getAuthUserById(userId);
      console.log(`[PHONE UPDATE] user=${userId} newPhone=${newPhone}`);
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

  function ownerToVenue(owner: any) {
    const amenities: string[] = [];
    if (owner.hasBathrooms) amenities.push("دورات مياه");
    if (owner.hasMarket) amenities.push("مطعم/كافيتيريا");
    return {
      id: owner.id,
      name: owner.venueName ?? "ملعب",
      location: owner.areaName ? `${owner.areaName}، الموصل` : "الموصل",
      district: owner.areaName ?? "الموصل",
      rating: 0,
      reviewCount: 0,
      pricePerHour: parseInt(owner.bookingPrice ?? "0") || 0,
      fieldSizes: owner.fieldSize ? [owner.fieldSize] : ["5 ضد 5"],
      amenities,
      imageColor: getVenueColor(owner.id),
      isOpen: true,
      openHours: "08:00 - 24:00",
      lat: parseFloat(owner.latitude ?? "36.335") || 36.335,
      lon: parseFloat(owner.longitude ?? "43.119") || 43.119,
    };
  }

  app.get("/api/venues", async (_req, res) => {
    try {
      const owners = await storage.getAllOwners();
      const venues = owners.map(ownerToVenue);
      return res.json({ venues });
    } catch (e: any) {
      return res.status(500).json({ message: e?.message ?? "خطأ في الخادم" });
    }
  });

  app.get("/api/venues/:id", async (req, res) => {
    try {
      const owner = await storage.getAuthUserById(req.params.id);
      if (!owner || owner.role !== "owner" || !owner.venueName) {
        return res.status(404).json({ message: "الملعب غير موجود" });
      }
      return res.json(ownerToVenue(owner));
    } catch (e: any) {
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
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
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
        fieldSize: user.fieldSize ?? "5×5",
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
            `تم تأكيد حجزك الساعة ${time} بتاريخ ${date} في ${user.venueName ?? "الملعب"}`,
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
      const { id } = req.params;
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
      const { id } = req.params;
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

  const httpServer = createServer(app);
  return httpServer;
}
