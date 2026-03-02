import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "shootha_secret_2026";
const SUPERVISOR_MASTER_KEY = process.env.SUPERVISOR_MASTER_KEY || "shootha_supervisor_2026";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(userId: string, role: string, expiresIn: string = "30d"): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn } as any);
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
  if (role === "supervisor") {
    if (req.method !== "GET") {
      return res.status(403).json({ message: "المشرف المؤقت لديه صلاحيات عرض فقط" });
    }
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
    } catch (e) {
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
        userLat, userLon,
      } = req.body as {
        phone: string; name: string; role: string; otp: string; deviceId?: string;
        password?: string; dateOfBirth?: string; profileImage?: string;
        venueName?: string; areaName?: string; fieldSize?: string;
        bookingPrice?: string; hasBathrooms?: boolean; hasMarket?: boolean;
        latitude?: string; longitude?: string;
        venueImages?: string[];
        ownerDeviceLat?: string; ownerDeviceLon?: string;
        userLat?: string; userLon?: string;
      };

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
      });
      const token = signToken(user.id, user.role);

      return res.json({
        token,
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      });
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
      return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
    } catch (e) {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      return res.json({ id: user.id, name: user.name, phone: user.phone, role: user.role });
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
        permissions: ["view:bookings", "view:venues", "view:revenue"],
      });
    } catch {
      return res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
