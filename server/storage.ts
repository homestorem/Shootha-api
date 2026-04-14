import { type User, type InsertUser, type AuthUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export type SupportMessage = {
  id: string;
  userId: string;
  subject: string;
  message: string;
  createdAt: string;
};

export type OwnerBooking = {
  id: string;
  ownerId: string;
  playerName: string;
  playerPhone: string | null;
  date: string;
  time: string;
  duration: number;
  /** سعر الساعة (يتوافق مع لوحة المالك والإحصائيات: المجموع ≈ price × duration) */
  price: number;
  fieldSize: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  source: "app" | "manual";
  createdAt: string;
  reminderSent?: boolean;
  /** معرّف اللاعب في التطبيق (مثلاً Firebase UID) عند الحجز من التطبيق */
  playerUserId?: string | null;
  paymentMethod?: string | null;
  paymentPaid?: boolean;
  /** اسم الملعب وقت الحجز (للعرض عند اللاعب) */
  venueNameSnapshot?: string | null;
  /** عند الإلغاء من التطبيق — لقطة بيانات من مرآة Firestore */
  cancelledAt?: string;
  cancelledWhileUiStatus?: "upcoming" | "active" | "completed";
  cancellationSnapshot?: Record<string, unknown>;
};

type InternalUser = AuthUser & { deletedAt?: string };
type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "locked" | "invalid"; retryAfterSec?: number };
type OtpSendCheckResult = { ok: true } | { ok: false; retryAfterSec: number };

export type WalletTransaction = {
  id: string;
  userId: string;
  type: "redeem" | "payment";
  amount: number;
  balanceAfter: number;
  label: string;
  createdAt: string;
};

type PrepaidCardRow = {
  amount: number;
  createdAt: string;
  redeemedAt?: string;
  redeemedByUserId?: string;
};

export function normalizePrepaidCardCode(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toUpperCase();
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAuthUserByPhone(phone: string): Promise<AuthUser | undefined>;
  getAuthUserById(id: string): Promise<AuthUser | undefined>;
  getAuthUserByVenueName(venueName: string): Promise<AuthUser | undefined>;
  updateAuthUser(id: string, updates: Partial<AuthUser>): Promise<void>;
  updateUserProfile(
    id: string,
    data: { name?: string; dateOfBirth?: string; profileImage?: string; gender?: string }
  ): Promise<AuthUser>;
  softDeleteUser(id: string): Promise<void>;
  createAuthUser(data: {
    phone: string;
    name: string;
    role: string;
    deviceId?: string;
    password?: string;
    dateOfBirth?: string;
    profileImage?: string;
    venueName?: string;
    areaName?: string;
    fieldSize?: string;
    bookingPrice?: string;
    hasBathrooms?: boolean;
    hasMarket?: boolean;
    latitude?: string;
    longitude?: string;
    venueImages?: string[];
    ownerDeviceLat?: string;
    ownerDeviceLon?: string;
    gender?: string;
  }): Promise<AuthUser>;
  canSendOtp(phone: string): Promise<OtpSendCheckResult>;
  storeOtp(phone: string, otp: string): Promise<void>;
  verifyOtp(phone: string, otp: string): Promise<OtpVerifyResult>;
  createSupportMessage(data: { userId: string; subject: string; message: string }): Promise<SupportMessage>;
  getSupportMessages(): Promise<SupportMessage[]>;
  getAllOwners(): Promise<AuthUser[]>;
  getAllAuthUsers(): Promise<AuthUser[]>;
  getOwnerBookings(ownerId: string): Promise<OwnerBooking[]>;
  getOwnerBookingById(id: string): Promise<OwnerBooking | undefined>;
  createOwnerBooking(data: Omit<OwnerBooking, "id" | "createdAt">): Promise<OwnerBooking>;
  updateOwnerBooking(
    id: string,
    updates: Partial<Omit<OwnerBooking, "id" | "ownerId" | "createdAt">>
  ): Promise<OwnerBooking>;
  cancelOwnerBooking(
    id: string,
    meta?: {
      cancelledWhileUiStatus?: "upcoming" | "active" | "completed";
      cancellationSnapshot?: Record<string, unknown>;
    },
  ): Promise<void>;
  getBookingsForPlayer(
    playerUserId: string | null,
    playerPhone: string | null
  ): Promise<OwnerBooking[]>;
  getWalletBalance(userId: string): Promise<number>;
  getWalletTransactions(userId: string, limit: number): Promise<WalletTransaction[]>;
  redeemPrepaidCard(
    userId: string,
    rawCode: string
  ): Promise<
    | { ok: true; amount: number; balance: number }
    | { ok: false; message: string }
  >;
  createPrepaidCard(code: string, amount: number): Promise<void>;
  debitWallet(
    userId: string,
    amount: number,
    label: string,
  ): Promise<{ ok: true; balance: number } | { ok: false; message: string }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private authUsers: Map<string, InternalUser>;
  /** رصيد بالدينار العراقي (عدد صحيح) */
  private walletBalances: Map<string, number>;
  private prepaidCards: Map<string, PrepaidCardRow>;
  private walletTx: WalletTransaction[];
  private otpStore: Map<
    string,
    {
      otp: string;
      expiresAt: number;
      sentAt: number;
      sentCount: number;
      windowStart: number;
      failedAttempts: number;
      lockUntil: number;
    }
  >;
  private supportMessages: Map<string, SupportMessage>;
  private ownerBookings: Map<string, OwnerBooking>;

  constructor() {
    this.users = new Map();
    this.authUsers = new Map();
    this.walletBalances = new Map();
    this.prepaidCards = new Map();
    this.walletTx = [];
    this.otpStore = new Map();
    this.supportMessages = new Map();
    this.ownerBookings = new Map();
    /** يطابق عميل «المتابعة كضيف» — لمحفظة بدون تسجيل عند تفعيل GUEST_FULL_ACCESS */
    const guestRow: InternalUser = {
      id: "guest",
      phone: "__guest__",
      name: "ضيف",
      role: "guest",
      deviceId: null,
      noShowCount: "0",
      isBanned: false,
      createdAt: new Date().toISOString(),
      passwordHash: null,
      dateOfBirth: null,
      profileImage: null,
      venueName: null,
      areaName: null,
      fieldSize: null,
      bookingPrice: null,
      hasBathrooms: null,
      hasMarket: null,
      latitude: null,
      longitude: null,
      venueImages: null,
      ownerDeviceLat: null,
      ownerDeviceLon: null,
      expoPublicToken: null,
      gender: null,
    };
    this.authUsers.set("guest", guestRow);
  }

  async getWalletBalance(userId: string): Promise<number> {
    return this.walletBalances.get(userId) ?? 0;
  }

  async getWalletTransactions(userId: string, limit: number): Promise<WalletTransaction[]> {
    return this.walletTx
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createPrepaidCard(rawCode: string, amount: number): Promise<void> {
    const code = normalizePrepaidCardCode(rawCode);
    if (code.length < 8) throw new Error("رمز البطاقة قصير جداً (8 أحرف على الأقل)");
    if (!Number.isFinite(amount) || amount < 1000) {
      throw new Error("Amount must be at least 1,000 IQD");
    }
    if (this.prepaidCards.has(code)) {
      throw new Error("هذا الرمز مسجّل مسبقاً");
    }
    this.prepaidCards.set(code, {
      amount: Math.floor(amount),
      createdAt: new Date().toISOString(),
    });
  }

  async redeemPrepaidCard(
    userId: string,
    rawCode: string
  ): Promise<
    { ok: true; amount: number; balance: number } | { ok: false; message: string }
  > {
    const code = normalizePrepaidCardCode(rawCode);
    if (code.length < 8) {
      return { ok: false, message: "أدخل رقم البطاقة كاملاً" };
    }
    const user = this.authUsers.get(userId);
    if (!user || user.deletedAt) {
      return { ok: false, message: "المستخدم غير موجود" };
    }
    const card = this.prepaidCards.get(code);
    if (!card) {
      return { ok: false, message: "رقم البطاقة غير صحيح أو غير موجود" };
    }
    if (card.redeemedAt) {
      return { ok: false, message: "هذه البطاقة مُستخدمة مسبقاً" };
    }
    const prev = this.walletBalances.get(userId) ?? 0;
    const next = prev + card.amount;
    this.walletBalances.set(userId, next);
    const now = new Date().toISOString();
    this.prepaidCards.set(code, {
      ...card,
      redeemedAt: now,
      redeemedByUserId: userId,
    });
    const tx: WalletTransaction = {
      id: randomUUID(),
      userId,
      type: "redeem",
      amount: card.amount,
      balanceAfter: next,
      label: "شحن عبر بطاقة رصيد",
      createdAt: now,
    };
    this.walletTx.push(tx);
    return { ok: true, amount: card.amount, balance: next };
  }

  async debitWallet(
    userId: string,
    amount: number,
    label: string,
  ): Promise<{ ok: true; balance: number } | { ok: false; message: string }> {
    const user = this.authUsers.get(userId);
    if (!user || user.deletedAt) {
      return { ok: false, message: "المستخدم غير موجود" };
    }
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, message: "المبلغ غير صالح" };
    }
    const prev = this.walletBalances.get(userId) ?? 0;
    if (prev < n) {
      return { ok: false, message: "الرصيد غير كافٍ" };
    }
    const next = prev - n;
    this.walletBalances.set(userId, next);
    const now = new Date().toISOString();
    const tx: WalletTransaction = {
      id: randomUUID(),
      userId,
      type: "payment",
      amount: n,
      balanceAfter: next,
      label: label.slice(0, 200) || "دفع من المحفظة",
      createdAt: now,
    };
    this.walletTx.push(tx);
    return { ok: true, balance: next };
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAuthUserByPhone(phone: string): Promise<AuthUser | undefined> {
    return Array.from(this.authUsers.values()).find(
      (u) => u.phone === phone && !u.deletedAt
    );
  }

  async getAuthUserById(id: string): Promise<AuthUser | undefined> {
    const u = this.authUsers.get(id);
    if (!u || u.deletedAt) return undefined;
    return u;
  }

  async getAuthUserByVenueName(venueName: string): Promise<AuthUser | undefined> {
    return Array.from(this.authUsers.values()).find(
      (u) => !u.deletedAt && u.venueName?.toLowerCase() === venueName?.toLowerCase()
    );
  }

  async updateAuthUser(id: string, updates: Partial<AuthUser>): Promise<void> {
    const user = this.authUsers.get(id);
    if (user) {
      this.authUsers.set(id, { ...user, ...updates });
    }
  }

  async updateUserProfile(
    id: string,
    data: { name?: string; dateOfBirth?: string; profileImage?: string; gender?: string }
  ): Promise<AuthUser> {
    const user = this.authUsers.get(id);
    if (!user || user.deletedAt) throw new Error("المستخدم غير موجود");
    const updated: InternalUser = {
      ...user,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.profileImage !== undefined ? { profileImage: data.profileImage } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
    };
    this.authUsers.set(id, updated);
    return updated;
  }

  async softDeleteUser(id: string): Promise<void> {
    const user = this.authUsers.get(id);
    if (user) {
      this.authUsers.set(id, { ...user, deletedAt: new Date().toISOString() });
    }
  }

  async createAuthUser(data: {
    phone: string;
    name: string;
    role: string;
    deviceId?: string;
    password?: string;
    dateOfBirth?: string;
    profileImage?: string;
    venueName?: string;
    areaName?: string;
    fieldSize?: string;
    bookingPrice?: string;
    hasBathrooms?: boolean;
    hasMarket?: boolean;
    latitude?: string;
    longitude?: string;
    venueImages?: string[];
    ownerDeviceLat?: string;
    ownerDeviceLon?: string;
    gender?: string;
  }): Promise<AuthUser> {
    const id = randomUUID();
    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }
    const user: InternalUser = {
      id,
      phone: data.phone,
      name: data.name,
      role: data.role,
      deviceId: data.deviceId ?? null,
      noShowCount: "0",
      isBanned: false,
      createdAt: new Date().toISOString(),
      passwordHash,
      dateOfBirth: data.dateOfBirth ?? null,
      profileImage: data.profileImage ?? null,
      venueName: data.venueName ?? null,
      areaName: data.areaName ?? null,
      fieldSize: data.fieldSize ?? null,
      bookingPrice: data.bookingPrice ?? null,
      hasBathrooms: data.hasBathrooms ?? null,
      hasMarket: data.hasMarket ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      venueImages: data.venueImages ? JSON.stringify(data.venueImages) : null,
      ownerDeviceLat: data.ownerDeviceLat ?? null,
      ownerDeviceLon: data.ownerDeviceLon ?? null,
      expoPublicToken: null,
      gender: data.gender ?? null,
    };
    this.authUsers.set(id, user);
    return user;
  }

  async storeOtp(phone: string, otp: string): Promise<void> {
    const now = Date.now();
    const prev = this.otpStore.get(phone);
    const windowMs = 10 * 60 * 1000;
    const inWindow = prev && now - prev.windowStart < windowMs;
    this.otpStore.set(phone, {
      otp,
      expiresAt: now + 5 * 60 * 1000,
      sentAt: now,
      sentCount: inWindow ? (prev?.sentCount ?? 0) + 1 : 1,
      windowStart: inWindow ? (prev?.windowStart ?? now) : now,
      failedAttempts: 0,
      lockUntil: 0,
    });
  }

  async canSendOtp(phone: string): Promise<OtpSendCheckResult> {
    const now = Date.now();
    const existing = this.otpStore.get(phone);
    if (!existing) return { ok: true };
    if (existing.lockUntil > now) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((existing.lockUntil - now) / 1000),
      };
    }
    const cooldownMs = 45 * 1000;
    const waitCooldown = existing.sentAt + cooldownMs - now;
    if (waitCooldown > 0) {
      return { ok: false, retryAfterSec: Math.ceil(waitCooldown / 1000) };
    }
    const sendLockAttempts = 2;
    if (existing.sentCount >= sendLockAttempts) {
      const lockMs = 60 * 60 * 1000;
      this.otpStore.set(phone, { ...existing, lockUntil: now + lockMs });
      return { ok: false, retryAfterSec: Math.ceil(lockMs / 1000) };
    }
    return { ok: true };
  }

  async verifyOtp(phone: string, otp: string): Promise<OtpVerifyResult> {
    const stored = this.otpStore.get(phone);
    if (!stored) return { ok: false, reason: "not_found" };
    const now = Date.now();
    if (stored.lockUntil > now) {
      return {
        ok: false,
        reason: "locked",
        retryAfterSec: Math.ceil((stored.lockUntil - now) / 1000),
      };
    }
    if (now > stored.expiresAt) {
      this.otpStore.delete(phone);
      return { ok: false, reason: "expired" };
    }
    if (stored.otp === otp) {
      this.otpStore.delete(phone);
      return { ok: true };
    }
    const failedAttempts = stored.failedAttempts + 1;
    const maxAttempts = 5;
    if (failedAttempts >= maxAttempts) {
      const lockMs = 10 * 60 * 1000;
      this.otpStore.set(phone, { ...stored, failedAttempts, lockUntil: now + lockMs });
      return { ok: false, reason: "locked", retryAfterSec: Math.ceil(lockMs / 1000) };
    }
    this.otpStore.set(phone, { ...stored, failedAttempts });
    return { ok: false, reason: "invalid" };
  }

  async createSupportMessage(data: {
    userId: string;
    subject: string;
    message: string;
  }): Promise<SupportMessage> {
    const id = randomUUID();
    const msg: SupportMessage = {
      id,
      userId: data.userId,
      subject: data.subject,
      message: data.message,
      createdAt: new Date().toISOString(),
    };
    this.supportMessages.set(id, msg);
    return msg;
  }

  async getSupportMessages(): Promise<SupportMessage[]> {
    return Array.from(this.supportMessages.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAllOwners(): Promise<AuthUser[]> {
    return Array.from(this.authUsers.values()).filter(
      (u) => !u.deletedAt && u.role === "owner" && u.venueName
    );
  }

  async getAllAuthUsers(): Promise<AuthUser[]> {
    return Array.from(this.authUsers.values()).filter((u) => !u.deletedAt);
  }

  async getOwnerBookings(ownerId: string): Promise<OwnerBooking[]> {
    return Array.from(this.ownerBookings.values())
      .filter((b) => b.ownerId === ownerId)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  }

  async getOwnerBookingById(id: string): Promise<OwnerBooking | undefined> {
    return this.ownerBookings.get(id);
  }

  async createOwnerBooking(data: Omit<OwnerBooking, "id" | "createdAt">): Promise<OwnerBooking> {
    const id = randomUUID();
    const booking: OwnerBooking = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.ownerBookings.set(id, booking);
    return booking;
  }

  async updateOwnerBooking(
    id: string,
    updates: Partial<Omit<OwnerBooking, "id" | "ownerId" | "createdAt">>
  ): Promise<OwnerBooking> {
    const booking = this.ownerBookings.get(id);
    if (!booking) throw new Error("الحجز غير موجود");
    const updated: OwnerBooking = { ...booking, ...updates };
    this.ownerBookings.set(id, updated);
    return updated;
  }

  async cancelOwnerBooking(
    id: string,
    meta?: {
      cancelledWhileUiStatus?: "upcoming" | "active" | "completed";
      cancellationSnapshot?: Record<string, unknown>;
    },
  ): Promise<void> {
    const booking = this.ownerBookings.get(id);
    if (booking) {
      this.ownerBookings.set(id, {
        ...booking,
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        ...(meta?.cancelledWhileUiStatus
          ? { cancelledWhileUiStatus: meta.cancelledWhileUiStatus }
          : {}),
        ...(meta?.cancellationSnapshot
          ? { cancellationSnapshot: meta.cancellationSnapshot }
          : {}),
      });
    }
  }

  async getBookingsForPlayer(
    playerUserId: string | null,
    playerPhone: string | null
  ): Promise<OwnerBooking[]> {
    const digits = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");
    const tail = (d: string) => (d.length >= 10 ? d.slice(-10) : d);
    const phoneNorm = tail(digits(playerPhone));
    return Array.from(this.ownerBookings.values())
      .filter((b) => {
        const byUid = Boolean(playerUserId && b.playerUserId && b.playerUserId === playerUserId);
        const byPhone =
          Boolean(phoneNorm.length >= 8 && b.playerPhone) &&
          tail(digits(b.playerPhone)) === phoneNorm;
        return byUid || byPhone;
      })
      .sort((a, b) => {
        const dc = b.date.localeCompare(a.date);
        if (dc !== 0) return dc;
        return b.time.localeCompare(a.time);
      });
  }
}

export const storage = new MemStorage();
