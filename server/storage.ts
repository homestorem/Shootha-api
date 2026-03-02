import { type User, type InsertUser, type AuthUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAuthUserByPhone(phone: string): Promise<AuthUser | undefined>;
  getAuthUserById(id: string): Promise<AuthUser | undefined>;
  getAuthUserByVenueName(venueName: string): Promise<AuthUser | undefined>;
  updateAuthUser(id: string, updates: Partial<AuthUser>): Promise<void>;
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
  }): Promise<AuthUser>;
  storeOtp(phone: string, otp: string): Promise<void>;
  verifyOtp(phone: string, otp: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private authUsers: Map<string, AuthUser>;
  private otpStore: Map<string, { otp: string; expiresAt: number }>;

  constructor() {
    this.users = new Map();
    this.authUsers = new Map();
    this.otpStore = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAuthUserByPhone(phone: string): Promise<AuthUser | undefined> {
    return Array.from(this.authUsers.values()).find(u => u.phone === phone);
  }

  async getAuthUserById(id: string): Promise<AuthUser | undefined> {
    return this.authUsers.get(id);
  }

  async getAuthUserByVenueName(venueName: string): Promise<AuthUser | undefined> {
    return Array.from(this.authUsers.values()).find(
      u => u.venueName?.toLowerCase() === venueName?.toLowerCase()
    );
  }

  async updateAuthUser(id: string, updates: Partial<AuthUser>): Promise<void> {
    const user = this.authUsers.get(id);
    if (user) {
      this.authUsers.set(id, { ...user, ...updates });
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
  }): Promise<AuthUser> {
    const id = randomUUID();
    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }
    const user: AuthUser = {
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
}

export const storage = new MemStorage();
