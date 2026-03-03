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
  price: number;
  fieldSize: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  source: "app" | "manual";
  createdAt: string;
  reminderSent?: boolean;
};

type InternalUser = AuthUser & { deletedAt?: string };

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
  storeOtp(phone: string, otp: string): Promise<void>;
  verifyOtp(phone: string, otp: string): Promise<boolean>;
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
  cancelOwnerBooking(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private authUsers: Map<string, InternalUser>;
  private otpStore: Map<string, { otp: string; expiresAt: number }>;
  private supportMessages: Map<string, SupportMessage>;
  private ownerBookings: Map<string, OwnerBooking>;

  constructor() {
    this.users = new Map();
    this.authUsers = new Map();
    this.otpStore = new Map();
    this.supportMessages = new Map();
    this.ownerBookings = new Map();
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
    this.otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const stored = this.otpStore.get(phone);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(phone);
      return false;
    }
    if (stored.otp === otp) {
      this.otpStore.delete(phone);
      return true;
    }
    return false;
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

  async cancelOwnerBooking(id: string): Promise<void> {
    const booking = this.ownerBookings.get(id);
    if (booking) {
      this.ownerBookings.set(id, { ...booking, status: "cancelled" });
    }
  }
}

export const storage = new MemStorage();
