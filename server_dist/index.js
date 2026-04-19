// server/loadEnv.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
function resolveProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, "package.json");
    const app2 = path.join(dir, "app.json");
    if (fs.existsSync(pkg) && fs.existsSync(app2)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
var projectRoot = resolveProjectRoot();
var envPath = path.join(projectRoot, ".env");
var result = dotenv.config({ path: envPath });
if (result.error && !fs.existsSync(envPath)) {
  console.warn(`[env] No .env at ${envPath} (${result.error.message})`);
} else if (process.env.NODE_ENV === "development") {
  console.log(`[env] Loaded ${envPath}`);
}
var ENV_PROJECT_ROOT = projectRoot;

// server/index.ts
import express from "express";
import net from "node:net";
import cors from "cors";
import helmet from "helmet";

// server/routes.ts
import { createServer } from "node:http";
import * as admin5 from "firebase-admin";
import axios2 from "axios";

// server/storage.ts
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
function normalizePrepaidCardCode(raw) {
  return String(raw || "").replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
}
var MemStorage = class {
  users;
  authUsers;
  /** رصيد بالدينار العراقي (عدد صحيح) */
  walletBalances;
  prepaidCards;
  walletTx;
  otpStore;
  supportMessages;
  ownerBookings;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.authUsers = /* @__PURE__ */ new Map();
    this.walletBalances = /* @__PURE__ */ new Map();
    this.prepaidCards = /* @__PURE__ */ new Map();
    this.walletTx = [];
    this.otpStore = /* @__PURE__ */ new Map();
    this.supportMessages = /* @__PURE__ */ new Map();
    this.ownerBookings = /* @__PURE__ */ new Map();
    const guestRow = {
      id: "guest",
      phone: "__guest__",
      name: "\u0636\u064A\u0641",
      role: "guest",
      deviceId: null,
      noShowCount: "0",
      isBanned: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
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
      gender: null
    };
    this.authUsers.set("guest", guestRow);
  }
  async getWalletBalance(userId) {
    return this.walletBalances.get(userId) ?? 0;
  }
  async getWalletTransactions(userId, limit) {
    return this.walletTx.filter((t) => t.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }
  async createPrepaidCard(rawCode, amount) {
    const code = normalizePrepaidCardCode(rawCode);
    if (code.length < 8) throw new Error("\u0631\u0645\u0632 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0642\u0635\u064A\u0631 \u062C\u062F\u0627\u064B (8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)");
    if (!Number.isFinite(amount) || amount < 1e3) {
      throw new Error("Amount must be at least 1,000 IQD");
    }
    if (this.prepaidCards.has(code)) {
      throw new Error("\u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632 \u0645\u0633\u062C\u0651\u0644 \u0645\u0633\u0628\u0642\u0627\u064B");
    }
    this.prepaidCards.set(code, {
      amount: Math.floor(amount),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async redeemPrepaidCard(userId, rawCode) {
    const code = normalizePrepaidCardCode(rawCode);
    if (code.length < 8) {
      return { ok: false, message: "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0627\u0645\u0644\u0627\u064B" };
    }
    const user = this.authUsers.get(userId);
    if (!user || user.deletedAt) {
      return { ok: false, message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
    }
    const card = this.prepaidCards.get(code);
    if (!card) {
      return { ok: false, message: "\u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
    }
    if (card.redeemedAt) {
      return { ok: false, message: "\u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0645\u064F\u0633\u062A\u062E\u062F\u0645\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" };
    }
    const prev = this.walletBalances.get(userId) ?? 0;
    const next = prev + card.amount;
    this.walletBalances.set(userId, next);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.prepaidCards.set(code, {
      ...card,
      redeemedAt: now,
      redeemedByUserId: userId
    });
    const tx = {
      id: randomUUID(),
      userId,
      type: "redeem",
      amount: card.amount,
      balanceAfter: next,
      label: "\u0634\u062D\u0646 \u0639\u0628\u0631 \u0628\u0637\u0627\u0642\u0629 \u0631\u0635\u064A\u062F",
      createdAt: now
    };
    this.walletTx.push(tx);
    return { ok: true, amount: card.amount, balance: next };
  }
  async debitWallet(userId, amount, label) {
    const user = this.authUsers.get(userId);
    if (!user || user.deletedAt) {
      return { ok: false, message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
    }
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, message: "\u0627\u0644\u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
    }
    const prev = this.walletBalances.get(userId) ?? 0;
    if (prev < n) {
      return { ok: false, message: "\u0627\u0644\u0631\u0635\u064A\u062F \u063A\u064A\u0631 \u0643\u0627\u0641\u064D" };
    }
    const next = prev - n;
    this.walletBalances.set(userId, next);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const tx = {
      id: randomUUID(),
      userId,
      type: "payment",
      amount: n,
      balanceAfter: next,
      label: label.slice(0, 200) || "\u062F\u0641\u0639 \u0645\u0646 \u0627\u0644\u0645\u062D\u0641\u0638\u0629",
      createdAt: now
    };
    this.walletTx.push(tx);
    return { ok: true, balance: next };
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getAuthUserByPhone(phone) {
    return Array.from(this.authUsers.values()).find(
      (u) => u.phone === phone && !u.deletedAt
    );
  }
  async getAuthUserById(id) {
    const u = this.authUsers.get(id);
    if (!u || u.deletedAt) return void 0;
    return u;
  }
  async getAuthUserByVenueName(venueName) {
    return Array.from(this.authUsers.values()).find(
      (u) => !u.deletedAt && u.venueName?.toLowerCase() === venueName?.toLowerCase()
    );
  }
  async updateAuthUser(id, updates) {
    const user = this.authUsers.get(id);
    if (user) {
      this.authUsers.set(id, { ...user, ...updates });
    }
  }
  async updateUserProfile(id, data) {
    const user = this.authUsers.get(id);
    if (!user || user.deletedAt) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const updated = {
      ...user,
      ...data.name !== void 0 ? { name: data.name } : {},
      ...data.dateOfBirth !== void 0 ? { dateOfBirth: data.dateOfBirth } : {},
      ...data.profileImage !== void 0 ? { profileImage: data.profileImage } : {},
      ...data.gender !== void 0 ? { gender: data.gender } : {}
    };
    this.authUsers.set(id, updated);
    return updated;
  }
  async softDeleteUser(id) {
    const user = this.authUsers.get(id);
    if (user) {
      this.authUsers.set(id, { ...user, deletedAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
  }
  async createAuthUser(data) {
    const id = randomUUID();
    let passwordHash = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }
    const user = {
      id,
      phone: data.phone,
      name: data.name,
      role: data.role,
      deviceId: data.deviceId ?? null,
      noShowCount: "0",
      isBanned: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
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
      gender: data.gender ?? null
    };
    this.authUsers.set(id, user);
    return user;
  }
  async storeOtp(phone, otp) {
    const now = Date.now();
    const prev = this.otpStore.get(phone);
    const windowMs = 10 * 60 * 1e3;
    const inWindow = prev && now - prev.windowStart < windowMs;
    this.otpStore.set(phone, {
      otp,
      expiresAt: now + 5 * 60 * 1e3,
      sentAt: now,
      sentCount: inWindow ? (prev?.sentCount ?? 0) + 1 : 1,
      windowStart: inWindow ? prev?.windowStart ?? now : now,
      failedAttempts: 0,
      lockUntil: 0
    });
  }
  async canSendOtp(phone) {
    const now = Date.now();
    const existing = this.otpStore.get(phone);
    if (!existing) return { ok: true };
    if (existing.lockUntil > now) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((existing.lockUntil - now) / 1e3)
      };
    }
    const cooldownMs = 45 * 1e3;
    const waitCooldown = existing.sentAt + cooldownMs - now;
    if (waitCooldown > 0) {
      return { ok: false, retryAfterSec: Math.ceil(waitCooldown / 1e3) };
    }
    const sendLockAttempts = 2;
    if (existing.sentCount >= sendLockAttempts) {
      const lockMs = 60 * 60 * 1e3;
      this.otpStore.set(phone, { ...existing, lockUntil: now + lockMs });
      return { ok: false, retryAfterSec: Math.ceil(lockMs / 1e3) };
    }
    return { ok: true };
  }
  async verifyOtp(phone, otp) {
    const stored = this.otpStore.get(phone);
    if (!stored) return { ok: false, reason: "not_found" };
    const now = Date.now();
    if (stored.lockUntil > now) {
      return {
        ok: false,
        reason: "locked",
        retryAfterSec: Math.ceil((stored.lockUntil - now) / 1e3)
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
      const lockMs = 10 * 60 * 1e3;
      this.otpStore.set(phone, { ...stored, failedAttempts, lockUntil: now + lockMs });
      return { ok: false, reason: "locked", retryAfterSec: Math.ceil(lockMs / 1e3) };
    }
    this.otpStore.set(phone, { ...stored, failedAttempts });
    return { ok: false, reason: "invalid" };
  }
  async createSupportMessage(data) {
    const id = randomUUID();
    const msg = {
      id,
      userId: data.userId,
      subject: data.subject,
      message: data.message,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.supportMessages.set(id, msg);
    return msg;
  }
  async getSupportMessages() {
    return Array.from(this.supportMessages.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  async getAllOwners() {
    return Array.from(this.authUsers.values()).filter(
      (u) => !u.deletedAt && u.role === "owner" && u.venueName
    );
  }
  async getAllAuthUsers() {
    return Array.from(this.authUsers.values()).filter((u) => !u.deletedAt);
  }
  async getOwnerBookings(ownerId) {
    return Array.from(this.ownerBookings.values()).filter((b) => b.ownerId === ownerId).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
  }
  async getOwnerBookingById(id) {
    return this.ownerBookings.get(id);
  }
  async createOwnerBooking(data) {
    const id = randomUUID();
    const booking = {
      ...data,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.ownerBookings.set(id, booking);
    return booking;
  }
  async updateOwnerBooking(id, updates) {
    const booking = this.ownerBookings.get(id);
    if (!booking) throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const updated = { ...booking, ...updates };
    this.ownerBookings.set(id, updated);
    return updated;
  }
  async cancelOwnerBooking(id, meta) {
    const booking = this.ownerBookings.get(id);
    if (booking) {
      this.ownerBookings.set(id, {
        ...booking,
        status: "cancelled",
        cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
        ...meta?.cancelledWhileUiStatus ? { cancelledWhileUiStatus: meta.cancelledWhileUiStatus } : {},
        ...meta?.cancellationSnapshot ? { cancellationSnapshot: meta.cancellationSnapshot } : {}
      });
    }
  }
  async getBookingsForPlayer(playerUserId, playerPhone) {
    const digits = (s) => String(s ?? "").replace(/\D/g, "");
    const tail = (d) => d.length >= 10 ? d.slice(-10) : d;
    const phoneNorm = tail(digits(playerPhone));
    return Array.from(this.ownerBookings.values()).filter((b) => {
      const byUid = Boolean(playerUserId && b.playerUserId && b.playerUserId === playerUserId);
      const byPhone = Boolean(phoneNorm.length >= 8 && b.playerPhone) && tail(digits(b.playerPhone)) === phoneNorm;
      return byUid || byPhone;
    }).sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return b.time.localeCompare(a.time);
    });
  }
};
var storage = new MemStorage();

// server/routes.ts
import jwt2 from "jsonwebtoken";
import cron from "node-cron";

// server/utils/expoPush.ts
var EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
function isValidToken(token) {
  return typeof token === "string" && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}
async function sendPushNotifications(tokens, title, body, data, image) {
  const validTokens = tokens.filter(isValidToken);
  if (validTokens.length === 0) return;
  const CHUNK = 100;
  for (let i = 0; i < validTokens.length; i += CHUNK) {
    const chunk = validTokens.slice(i, i + CHUNK);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      data,
      ...image ? { image } : {}
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate"
        },
        body: JSON.stringify(messages)
      });
      if (!res.ok) {
        console.error("[PUSH] Expo API error:", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      console.error("[PUSH] Network error:", e);
    }
  }
}
async function sendPushToUser(token, title, body, data) {
  if (!token) return;
  await sendPushNotifications([token], title, body, data);
}

// lib/venue-package-tiers.ts
function toNum(x, defaultIfMissing = 0) {
  if (x == null) return defaultIfMissing;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string") {
    const n = parseFloat(x.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function nearDuration(a, b) {
  return Math.abs(a - b) < 0.05;
}
function tiersFromDurationBlob(blob) {
  const out = { t15: 0, t2: 0, t3: 0 };
  if (blob == null) return out;
  if (Array.isArray(blob)) {
    for (const item of blob) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
      const o = item;
      const hours = toNum(o.hours ?? o.duration ?? o.durationHours ?? o.hr);
      const price = toNum(o.price ?? o.amount ?? o.value ?? o.total);
      if (price <= 0) continue;
      if (nearDuration(hours, 1.5)) out.t15 = Math.round(price);
      else if (nearDuration(hours, 2)) out.t2 = Math.round(price);
      else if (nearDuration(hours, 3)) out.t3 = Math.round(price);
    }
    return out;
  }
  if (typeof blob !== "object") return out;
  const map = blob;
  for (const [rawKey, val] of Object.entries(map)) {
    const key = rawKey.trim().toLowerCase().replace(/\s/g, "").replace(/،/g, "");
    const n = toNum(val);
    if (n <= 0) continue;
    const is15 = key === "1.5" || key === "1_5" || key === "90" || key.includes("1.5") || key.includes("1_5") || key.includes("\u0633\u0627\u0639\u0629\u0648\u0646\u0635\u0641") || key === "onehalf";
    const is2 = key === "2" || key === "120" || key === "2h" || key === "two" || key.startsWith("2") && key.includes("hour");
    const is3 = key === "3" || key === "180" || key === "3h" || key === "three" || key.startsWith("3") && key.includes("hour");
    if (is15) out.t15 = Math.round(n);
    else if (is2 && !key.includes("1.5")) out.t2 = Math.round(n);
    else if (is3) out.t3 = Math.round(n);
  }
  return out;
}
function firstPositiveTier(...nums) {
  for (const x of nums) {
    if (x > 0) return Math.round(x);
  }
  return 0;
}
function collectDurationPriceBlobs(v, meta) {
  const m = meta ?? {};
  const keys = [
    "durationPrices",
    "duration_prices",
    "packagePrices",
    "package_prices",
    "tierPrices",
    "tier_prices",
    "\u0623\u0633\u0639\u0627\u0631_\u0627\u0644\u0645\u062F\u062F",
    "fieldDurationPrices"
  ];
  const out = [];
  for (const k of keys) {
    if (v[k] != null) out.push(v[k]);
    if (m[k] != null) out.push(m[k]);
  }
  return out;
}
function readFirestorePackageTiers(v, meta) {
  const m = meta ?? {};
  const metaPricing = m.pricing != null && typeof m.pricing === "object" && !Array.isArray(m.pricing) ? m.pricing : void 0;
  const rootPricing = v.pricing != null && typeof v.pricing === "object" && !Array.isArray(v.pricing) ? v.pricing : void 0;
  const pick = (snake, camel, shortKeys) => {
    const candidates = [
      v[camel],
      v[snake],
      m[camel],
      m[snake],
      ...shortKeys.map((k) => v[k]),
      ...shortKeys.map((k) => m[k])
    ];
    for (const pr of [metaPricing, rootPricing]) {
      if (!pr) continue;
      candidates.push(pr[camel], pr[snake], ...shortKeys.map((k) => pr[k]));
    }
    for (const c of candidates) {
      const n = toNum(c);
      if (n > 0) return Math.round(n);
    }
    return 0;
  };
  let t15 = pick("price_1_5_hours", "priceTier1_5Hours", ["price_1_5h"]);
  let t2 = pick("price_2_hours", "priceTier2Hours", ["price_2h"]);
  let t3 = pick("price_3_hours", "priceTier3Hours", ["price_3h"]);
  const fromBlobs = { t15: 0, t2: 0, t3: 0 };
  for (const blob of collectDurationPriceBlobs(v, m)) {
    const part = tiersFromDurationBlob(blob);
    if (part.t15 > 0) fromBlobs.t15 = part.t15;
    if (part.t2 > 0) fromBlobs.t2 = part.t2;
    if (part.t3 > 0) fromBlobs.t3 = part.t3;
  }
  const fromRootPricing = rootPricing ? tiersFromDurationBlob(rootPricing) : { t15: 0, t2: 0, t3: 0 };
  const fromMetaPricing = metaPricing ? tiersFromDurationBlob(metaPricing) : { t15: 0, t2: 0, t3: 0 };
  t15 = firstPositiveTier(t15, fromBlobs.t15, fromRootPricing.t15, fromMetaPricing.t15);
  t2 = firstPositiveTier(t2, fromBlobs.t2, fromRootPricing.t2, fromMetaPricing.t2);
  t3 = firstPositiveTier(t3, fromBlobs.t3, fromRootPricing.t3, fromMetaPricing.t3);
  return { t15, t2, t3 };
}
function readPackageTiersFromFieldDoc(data) {
  const meta = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : void 0;
  return readFirestorePackageTiers(data, meta);
}

// server/firestoreVenues.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
var VENUE_COLORS = ["#1A2F1A", "#1A1A2F", "#2F1A1A", "#2F2A1A", "#1A2A2F"];
function getVenueColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return VENUE_COLORS[Math.abs(hash) % VENUE_COLORS.length];
}
function num(v, fallback) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(/,/g, "");
    const n = parseFloat(cleaned.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
function firstNum(data, keys, fallback) {
  for (const k of keys) {
    if (data[k] !== void 0 && data[k] !== null) {
      const n = num(data[k], NaN);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}
function str(v, fallback) {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}
function strArr(v) {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}
function stringListFromUnknown(v) {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x != null && typeof x === "object" && !Array.isArray(x)) {
        const o = x;
        return String(o.name ?? o.label ?? o.title ?? "").trim();
      }
      return String(x).trim();
    }).filter(Boolean);
  }
  if (typeof v === "string") {
    return v.split(/[,،؛;]/).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === "object") {
    return Object.entries(v).filter(([, val]) => val === true || val === 1 || val === "true").map(([k]) => k.trim()).filter(Boolean);
  }
  return [];
}
function splitServicesObjects(v) {
  if (!Array.isArray(v)) return { free: [], paid: [] };
  const free = [];
  const paid = [];
  for (const item of v) {
    if (typeof item === "string") {
      free.push(item.trim());
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item;
      const name = String(o.name ?? o.label ?? o.title ?? "").trim();
      if (!name) continue;
      const isPaid = o.paid === true || o.isPaid === true || o.type === "paid" || o.premium === true;
      if (isPaid) paid.push(name);
      else free.push(name);
    }
  }
  return { free, paid };
}
function listOrSplitAmenities(v) {
  if (!Array.isArray(v)) return { free: stringListFromUnknown(v), paid: [] };
  if (v.some(
    (x) => x != null && typeof x === "object" && !Array.isArray(x)
  )) {
    return splitServicesObjects(v);
  }
  return { free: stringListFromUnknown(v), paid: [] };
}
function mergeUnique(...lists) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const list of lists) {
    for (const x of list) {
      if (!seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
  }
  return out;
}
var SERVICE_KEY_TO_AR = {
  ball: "\u0643\u0631\u0629",
  bathroom: "\u062D\u0645\u0627\u0645 / \u062F\u0648\u0631\u0627\u062A \u0645\u064A\u0627\u0647",
  commentary: "\u062A\u0639\u0644\u064A\u0642",
  first_aid: "\u0625\u0633\u0639\u0627\u0641\u0627\u062A \u0623\u0648\u0644\u064A\u0629",
  kits: "\u0645\u0644\u0627\u0628\u0633",
  photography: "\u062A\u0635\u0648\u064A\u0631",
  referee: "\u062D\u0643\u0645",
  seats: "\u0645\u0642\u0627\u0639\u062F",
  sinks: "\u0645\u063A\u0627\u0633\u0644",
  speakers: "\u0645\u0643\u0628\u0631\u0627\u062A \u0635\u0648\u062A"
};
function labelForServiceKey(key) {
  const k = key.trim().toLowerCase();
  return SERVICE_KEY_TO_AR[k] ?? key;
}
function mergePaidServiceOptions(...lists) {
  const byId = /* @__PURE__ */ new Map();
  for (const list of lists) {
    for (const o of list) {
      const id = o.id.trim().toLowerCase();
      if (!byId.has(id)) byId.set(id, { ...o, id });
    }
  }
  return Array.from(byId.values());
}
function parseNestedAmenitiesMap(amenitiesMap) {
  const free = [];
  const paid = [];
  const paidServiceOptions = [];
  let defaultPriceHint;
  if (!amenitiesMap || typeof amenitiesMap !== "object" || Array.isArray(amenitiesMap)) {
    return { free, paid, paidServiceOptions, defaultPriceHint };
  }
  const map = amenitiesMap;
  for (const [key, raw] of Object.entries(map)) {
    const k = key.trim().toLowerCase();
    if (k === "price") {
      const p = num(raw, NaN);
      if (Number.isFinite(p) && p > 0) defaultPriceHint = p;
      continue;
    }
    if (raw === true) {
      free.push(labelForServiceKey(key));
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw;
      if (o.enabled === false) continue;
      const label = labelForServiceKey(key);
      const p = num(o.price, 0);
      if (p > 0) {
        paid.push(`${label} (+${Math.round(p).toLocaleString("en-US")} IQD)`);
        paidServiceOptions.push({ id: k, label, price: Math.round(p) });
      } else if (o.enabled !== false) {
        free.push(label);
      }
    }
  }
  return { free, paid, paidServiceOptions, defaultPriceHint };
}
function mapServiceKeysToLabels(services) {
  if (!Array.isArray(services)) return [];
  return services.map((s) => labelForServiceKey(String(s))).filter(Boolean);
}
function tieredHourlyFallback(data) {
  const p2 = num(data.price_2_hours, 0);
  if (p2 > 0) return Math.round(p2 / 2);
  const p15 = num(data.price_1_5_hours, 0);
  if (p15 > 0) return Math.round(p15 / 1.5);
  const p3 = num(data.price_3_hours, 0);
  if (p3 > 0) return Math.round(p3 / 3);
  return 0;
}
function scheduleToOpenHours(schedule) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;
  const values = Object.values(schedule);
  for (const v of values) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
      return v[0].replace(/-/g, " \u2013 ");
    }
  }
  return null;
}
function readLatLng(data) {
  const geo = data.geo ?? data.location ?? data.coordinates ?? data.position;
  if (geo && typeof geo === "object" && geo !== null && "latitude" in geo && "longitude" in geo) {
    const g = geo;
    if (typeof g.latitude === "number" && typeof g.longitude === "number") {
      return { lat: g.latitude, lon: g.longitude };
    }
  }
  return {
    lat: firstNum(data, ["lat", "latitude", "Lat", "LAT"], 36.335),
    lon: firstNum(data, ["lng", "lon", "longitude", "Lng", "LNG"], 43.119)
  };
}
function mapFieldDocToVenue(id, data) {
  const { lat, lon } = readLatLng(data);
  const meta = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : void 0;
  const nestedFromMeta = parseNestedAmenitiesMap(meta?.amenities);
  const nestedFromRoot = data.amenities != null && typeof data.amenities === "object" && !Array.isArray(data.amenities) ? parseNestedAmenitiesMap(data.amenities) : {
    free: [],
    paid: [],
    paidServiceOptions: [],
    defaultPriceHint: void 0
  };
  const fieldSizesRaw = strArr(data.fieldSizes);
  const singleSize = data.fieldSize != null ? str(data.fieldSize, "") : data.field_size != null ? str(data.field_size, "") : "";
  const fieldSizes = fieldSizesRaw.length > 0 ? fieldSizesRaw : singleSize ? [singleSize] : ["5 \u0636\u062F 5"];
  const fromAmenitiesField = listOrSplitAmenities(data.amenities);
  const fromServicesField = splitServicesObjects(data.services);
  const fromServicesLabels = mapServiceKeysToLabels(data.services);
  const amenities = mergeUnique(
    nestedFromMeta.free,
    nestedFromRoot.free,
    fromAmenitiesField.free,
    fromServicesField.free,
    fromServicesLabels,
    stringListFromUnknown(data.freeServices),
    stringListFromUnknown(data.availableServices),
    stringListFromUnknown(data.features),
    stringListFromUnknown(data.free_amenities)
  );
  const paidAmenities = mergeUnique(
    nestedFromMeta.paid,
    nestedFromRoot.paid,
    fromAmenitiesField.paid,
    fromServicesField.paid,
    stringListFromUnknown(data.paidAmenities),
    stringListFromUnknown(data.paidServices),
    stringListFromUnknown(data.premiumServices),
    stringListFromUnknown(data.paid_services)
  );
  let pricePerHour = firstNum(
    data,
    [
      "pricePerHour",
      "bookingPrice",
      "price",
      "hourlyPrice",
      "hourly_price",
      "costPerHour",
      "cost_per_hour",
      "booking_price",
      "\u0633\u0639\u0631_\u0627\u0644\u0633\u0627\u0639\u0629",
      "\u0633\u0639\u0631\u0627\u0644\u0633\u0627\u0639\u0629"
    ],
    0
  );
  if (!pricePerHour && meta) {
    pricePerHour = firstNum(meta, ["pricePerHour", "hourlyPrice", "price", "hourly_rate"], 0);
  }
  if (!pricePerHour) {
    pricePerHour = tieredHourlyFallback(data);
  }
  if (!pricePerHour) {
    const hint = nestedFromMeta.defaultPriceHint ?? nestedFromRoot.defaultPriceHint;
    if (hint && hint > 0) pricePerHour = hint;
  }
  const tiersFromDoc = readPackageTiersFromFieldDoc(data);
  const tier15 = tiersFromDoc.t15 || num(data.price_1_5_hours, 0) || num(meta?.price_1_5_hours, 0);
  const tier2 = tiersFromDoc.t2 || num(data.price_2_hours, 0) || num(meta?.price_2_hours, 0);
  const tier3 = tiersFromDoc.t3 || num(data.price_3_hours, 0) || num(meta?.price_3_hours, 0);
  const mergedPaidOptions = mergePaidServiceOptions(
    nestedFromMeta.paidServiceOptions,
    nestedFromRoot.paidServiceOptions
  );
  const openFromSchedule = scheduleToOpenHours(data.schedule);
  const openHours = str(data.openHours, "") || (openFromSchedule ?? "") || "08:00 \u2013 24:00";
  const venueImageCandidates = mergeUnique(
    [str(data.image, ""), str(data.imageUrl, ""), str(data.imageURI, ""), str(data.photo, "")],
    stringListFromUnknown(data.images),
    stringListFromUnknown(data.imageUrls),
    stringListFromUnknown(data.photos)
  ).filter((x) => x.startsWith("http://") || x.startsWith("https://"));
  const out = {
    id,
    name: str(data.name ?? data.venueName ?? data.title, "\u0645\u0644\u0639\u0628"),
    location: str(data.location ?? data.address, "\u0627\u0644\u0645\u0648\u0635\u0644"),
    district: str(data.district ?? data.areaName ?? data.neighborhood, "\u0627\u0644\u0645\u0648\u0635\u0644"),
    rating: num(data.rating, 0),
    reviewCount: num(data.reviewCount, 0),
    pricePerHour,
    fieldSizes,
    amenities,
    imageColor: str(data.imageColor, getVenueColor(id)),
    isOpen: data.status === "closed" || data.status === "rejected" || data.status === "suspended" ? false : data.isOpen !== false,
    openHours,
    lat,
    lon
  };
  if (venueImageCandidates.length > 0) {
    out.image = venueImageCandidates[0];
    out.imageUrls = venueImageCandidates.slice(0, 3);
  }
  if (paidAmenities.length > 0) {
    out.paidAmenities = paidAmenities;
  }
  if (mergedPaidOptions.length > 0) {
    out.paidServiceOptions = mergedPaidOptions;
  }
  if (tier15 > 0) out.priceTier1_5Hours = Math.round(Number(tier15));
  if (tier2 > 0) out.priceTier2Hours = Math.round(Number(tier2));
  if (tier3 > 0) out.priceTier3Hours = Math.round(Number(tier3));
  out.pricePerHour = Math.round(Number(out.pricePerHour)) || 0;
  return out;
}
function firebaseOptionsFromEnv() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? ""
  };
}
function isFirebaseEnvConfigured() {
  const o = firebaseOptionsFromEnv();
  return Boolean(o.apiKey && o.projectId && o.appId);
}
var firestoreInstance = null;
function getFirestoreSingleton() {
  if (firestoreInstance) return firestoreInstance;
  const opts = firebaseOptionsFromEnv();
  if (!opts.apiKey || !opts.projectId || !opts.appId) {
    throw new Error(
      "Firebase \u063A\u064A\u0631 \u0645\u064F\u0636\u0628\u0637: \u0623\u0636\u0641 EXPO_PUBLIC_FIREBASE_API_KEY \u0648 EXPO_PUBLIC_FIREBASE_PROJECT_ID \u0648 EXPO_PUBLIC_FIREBASE_APP_ID"
    );
  }
  const app2 = getApps().length === 0 ? initializeApp(opts) : getApp();
  firestoreInstance = getFirestore(app2);
  return firestoreInstance;
}
async function fetchVenuesFromFirestore() {
  const db = getFirestoreSingleton();
  const snap = await getDocs(collection(db, "fields"));
  return snap.docs.map(
    (d) => mapFieldDocToVenue(d.id, d.data())
  );
}
async function getVenueByIdFromFirestore(id) {
  const db = getFirestoreSingleton();
  const ref = doc(db, "fields", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapFieldDocToVenue(snap.id, snap.data());
}
async function getFirestoreFieldOwnerUserId(venueId) {
  try {
    const db = getFirestoreSingleton();
    const snap = await getDoc(doc(db, "fields", venueId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const meta = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : void 0;
    const raw = str(
      data.ownerId ?? data.owner_id ?? data.ownerUserId ?? meta?.ownerId ?? meta?.owner_user_id ?? "",
      ""
    );
    return raw.trim() || null;
  } catch {
    return null;
  }
}

// server/promoService.ts
import * as admin2 from "firebase-admin";
import * as fs3 from "node:fs";
import jwt from "jsonwebtoken";

// server/walletFirestore.ts
import * as admin from "firebase-admin";
import * as fs2 from "node:fs";

// lib/voucher-lookup.ts
var VOUCHERS_COLLECTION = "vouchers";
function buildVoucherLookupCodes(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  const upper = s.toUpperCase().replace(/\s+/g, "");
  const set = /* @__PURE__ */ new Set();
  if (upper) set.add(upper);
  const noHyphen = upper.replace(/-/g, "");
  if (noHyphen && noHyphen !== upper) set.add(noHyphen);
  if (noHyphen.startsWith("SH") && noHyphen.length > 2 && !upper.includes("-")) {
    set.add(`SH-${noHyphen.slice(2)}`);
  }
  return [...set].filter(Boolean).slice(0, 10);
}
function isVoucherExpired(expiryDate) {
  if (expiryDate == null) return false;
  const str3 = String(expiryDate).trim();
  if (!str3) return false;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(str3) ? `${str3}T23:59:59.999Z` : str3;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() > d.getTime();
}
function isVoucherMarkedUsed(data) {
  return data.isUsed === true || data.used === true;
}
function readVoucherAmount(data) {
  return Math.round(Number(data.amount ?? 0));
}
function voucherRedeemLedgerId(voucherDocId) {
  return `redeem:voucher:${String(voucherDocId ?? "").trim()}`;
}

// lib/voucher-redeemer-profile.ts
function str2(v, max) {
  if (v == null) return void 0;
  const s = String(v).trim();
  if (!s) return void 0;
  return s.length > max ? s.slice(0, max) : s;
}
function num2(v) {
  if (v == null || v === "") return void 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return void 0;
  return n;
}
function mergeRedeemerProfiles(userId, mem, fs5) {
  const latM = num2(mem?.latitude);
  const lonM = num2(mem?.longitude);
  return {
    userId,
    phone: str2(mem?.phone ?? fs5.phone, 32) ?? str2(fs5.phone, 32),
    name: str2(mem?.name ?? fs5.name, 200) ?? str2(fs5.name, 200),
    email: str2(fs5.email, 320),
    playerId: str2(fs5.playerId, 64),
    role: str2(mem?.role ?? fs5.role, 32) ?? str2(fs5.role, 32),
    latitude: latM ?? fs5.latitude ?? void 0,
    longitude: lonM ?? fs5.longitude ?? void 0,
    dateOfBirth: str2(mem?.dateOfBirth ?? fs5.dateOfBirth, 32),
    gender: str2(mem?.gender ?? fs5.gender, 32),
    position: str2(fs5.position, 64),
    profileImage: str2(mem?.profileImage ?? fs5.profileImage, 2e3),
    inviteCode: str2(fs5.inviteCode, 64),
    venueName: str2(mem?.venueName, 200) ?? str2(fs5.venueName, 200),
    areaName: str2(mem?.areaName, 200) ?? str2(fs5.areaName, 200),
    deviceId: str2(mem?.deviceId, 128) ?? str2(fs5.deviceId, 128),
    expoPushToken: str2(mem?.expoPublicToken, 500) ?? str2(fs5.expoPushToken, 500)
  };
}
function buildVoucherRedeemerFields(p) {
  const o = {};
  const set = (k, v) => {
    if (v === void 0 || v === null) return;
    if (typeof v === "string" && v === "") return;
    o[k] = v;
  };
  set("usedByPhone", str2(p.phone, 32));
  set("usedByName", str2(p.name, 200));
  set("usedByEmail", str2(p.email, 320));
  set("usedByPlayerId", str2(p.playerId, 64));
  set("usedByRole", str2(p.role, 32));
  set("usedByLatitude", p.latitude ?? void 0);
  set("usedByLongitude", p.longitude ?? void 0);
  set("usedByDateOfBirth", str2(p.dateOfBirth, 32));
  set("usedByGender", str2(p.gender, 32));
  set("usedByPosition", str2(p.position, 64));
  set("usedByProfileImage", str2(p.profileImage, 2e3));
  set("usedByInviteCode", str2(p.inviteCode, 64));
  set("usedByVenueName", str2(p.venueName, 200));
  set("usedByAreaName", str2(p.areaName, 200));
  set("usedByDeviceId", str2(p.deviceId, 128));
  set("usedByExpoPushToken", str2(p.expoPushToken, 500));
  return o;
}
function buildLedgerRedeemerFields(p) {
  const o = { redeemerUserId: String(p.userId ?? "").trim() };
  const set = (k, v) => {
    if (v === void 0 || v === null) return;
    if (typeof v === "string" && v === "") return;
    o[k] = v;
  };
  set("redeemerPhone", str2(p.phone, 32));
  set("redeemerName", str2(p.name, 200));
  set("redeemerEmail", str2(p.email, 320));
  set("redeemerPlayerId", str2(p.playerId, 64));
  set("redeemerRole", str2(p.role, 32));
  set("redeemerLatitude", p.latitude ?? void 0);
  set("redeemerLongitude", p.longitude ?? void 0);
  set("redeemerDateOfBirth", str2(p.dateOfBirth, 32));
  set("redeemerGender", str2(p.gender, 32));
  set("redeemerPosition", str2(p.position, 64));
  set("redeemerProfileImage", str2(p.profileImage, 2e3));
  set("redeemerInviteCode", str2(p.inviteCode, 64));
  set("redeemerVenueName", str2(p.venueName, 200));
  set("redeemerAreaName", str2(p.areaName, 200));
  set("redeemerDeviceId", str2(p.deviceId, 128));
  set("redeemerExpoPushToken", str2(p.expoPushToken, 500));
  return o;
}

// server/walletFirestore.ts
var WALLET_LEDGER_COLLECTION = "walletTransactions";
var adminInitialized = false;
function ensureAdminApp() {
  if (admin.apps.length > 0) {
    adminInitialized = true;
    return;
  }
  if (adminInitialized) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (pathEnv && fs2.existsSync(pathEnv)) {
    const c = JSON.parse(fs2.readFileSync(pathEnv, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(c) });
  } else if (json) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json))
    });
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH required for Firestore wallet"
    );
  }
  adminInitialized = true;
}
function ensureFirebaseAdminApp() {
  ensureAdminApp();
}
function isValidServiceAccountJson(raw) {
  try {
    const o = JSON.parse(raw);
    return o.type === "service_account" && typeof o.private_key === "string" && o.private_key.includes("BEGIN PRIVATE KEY") && typeof o.client_email === "string";
  } catch {
    return false;
  }
}
function isWalletFirestoreConfigured() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (pathEnv && fs2.existsSync(pathEnv)) {
    try {
      const raw = fs2.readFileSync(pathEnv, "utf8");
      return isValidServiceAccountJson(raw);
    } catch {
      return false;
    }
  }
  if (!json) return false;
  return isValidServiceAccountJson(json);
}
function getDb() {
  ensureAdminApp();
  return admin.firestore();
}
function txSnapToRow(id, d) {
  const ts = d.timestamp;
  const createdAt = ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  const raw = String(d.type ?? "debit").toLowerCase();
  const uiType = raw === "credit" || raw === "redeem" ? "redeem" : "payment";
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
    bookingId: d.bookingId ?? null
  };
}
async function fetchLedgerForUser(db, userId, lim) {
  const wRef = db.collection("wallets").doc(userId);
  let rows = [];
  try {
    const qs = await db.collection(WALLET_LEDGER_COLLECTION).where("userId", "==", userId).orderBy("timestamp", "desc").limit(lim).get();
    rows = qs.docs.map((docSnap) => txSnapToRow(docSnap.id, docSnap.data()));
  } catch {
    const all = await db.collection(WALLET_LEDGER_COLLECTION).where("userId", "==", userId).limit(lim * 4).get();
    rows = all.docs.map((docSnap) => txSnapToRow(docSnap.id, docSnap.data())).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).slice(0, lim);
  }
  try {
    const legacy = await wRef.collection("transactions").orderBy("timestamp", "desc").limit(lim).get();
    const legacyRows = legacy.docs.map((docSnap) => txSnapToRow(docSnap.id, docSnap.data()));
    const byId = /* @__PURE__ */ new Map();
    for (const r of legacyRows) byId.set(r.id, { ...r, userId: r.userId || userId });
    for (const r of rows) byId.set(r.id, r);
    return Array.from(byId.values()).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).slice(0, lim);
  } catch {
    return rows;
  }
}
async function getWalletAdmin(userId, limit) {
  const db = getDb();
  const wRef = db.collection("wallets").doc(userId);
  const wSnap = await wRef.get();
  const balance = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
  const lim = Math.min(100, Math.max(1, limit));
  const transactions = await fetchLedgerForUser(db, userId, lim);
  return { balance, transactions };
}
async function adminDebitWallet(opts) {
  const { userId, amount, bookingId, label, idempotencyKey } = opts;
  const uid = String(userId ?? "").trim();
  const key = String(idempotencyKey ?? "").trim();
  if (!uid || !key) throw new Error("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0645\u0641\u062A\u0627\u062D \u0627\u0644\u062A\u0632\u0627\u0645\u0646 \u0646\u0627\u0642\u0635");
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("\u0627\u0644\u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
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
      balanceAfter: next
    });
    return { balance: next, transactionId: key, duplicate: false };
  });
}
async function adminCreatePrepaidCard(opts) {
  const raw = String(opts.code ?? "").trim();
  const displayCode = raw.toUpperCase().replace(/\s+/g, "");
  const compact = normalizePrepaidCardCode(raw);
  const amount = Math.floor(Number(opts.amount));
  if (compact.length < 6) throw new Error("CARD_CODE_TOO_SHORT");
  if (!Number.isFinite(amount) || amount < 1e3) throw new Error("CARD_AMOUNT_TOO_LOW");
  const db = getDb();
  const candidates = buildVoucherLookupCodes(raw);
  if (candidates.length > 0) {
    const dup = await db.collection(VOUCHERS_COLLECTION).where("code", "in", candidates.slice(0, 10)).limit(1).get();
    if (!dup.empty) throw new Error("CARD_EXISTS");
  }
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const createdBy = String(opts.createdBy ?? "").trim() || null;
  const expiryDate = String(opts.expiryDate ?? "").trim();
  const row = {
    amount,
    code: displayCode || raw,
    createdAt: ts,
    expiryDate: expiryDate || "",
    isUsed: false,
    used: false,
    ...createdBy ? { createdBy } : {}
  };
  const ref = await db.collection(VOUCHERS_COLLECTION).add(row);
  return { code: displayCode || raw, amount, id: ref.id };
}
async function adminLoadRedeemerSnapshot(userId) {
  const uid = String(userId ?? "").trim();
  const empty = { userId: uid };
  if (!uid) return empty;
  try {
    const db = getDb();
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return empty;
    const d = snap.data();
    const getS = (k) => typeof d[k] === "string" ? String(d[k]).trim() : "";
    const n = (x) => {
      const v = typeof x === "number" ? x : parseFloat(String(x ?? ""));
      return Number.isFinite(v) ? v : void 0;
    };
    return {
      userId: uid,
      phone: getS("phone") || void 0,
      name: getS("name") || void 0,
      email: getS("email") || void 0,
      playerId: getS("playerId") || void 0,
      role: getS("role") || void 0,
      dateOfBirth: getS("dateOfBirth") || void 0,
      gender: getS("gender") || void 0,
      position: getS("position") || void 0,
      profileImage: getS("profileImage") || getS("image") || void 0,
      inviteCode: getS("inviteCode") || void 0,
      latitude: n(d.latitude ?? d.userLat ?? d.lat),
      longitude: n(d.longitude ?? d.userLon ?? d.lon)
    };
  } catch {
    return empty;
  }
}
async function adminRedeemPrepaidCardAndCreditWallet(opts) {
  const uid = String(opts.userId ?? "").trim();
  const compact = normalizePrepaidCardCode(opts.code ?? "");
  if (!uid || uid === "guest") throw new Error("AUTH_REQUIRED");
  if (compact.length < 6) throw new Error("CARD_CODE_TOO_SHORT");
  const db = getDb();
  const lookupCodes = buildVoucherLookupCodes(opts.code ?? "");
  if (lookupCodes.length === 0) throw new Error("CARD_NOT_FOUND");
  const found = await db.collection(VOUCHERS_COLLECTION).where("code", "in", lookupCodes.slice(0, 10)).limit(5).get();
  if (found.empty) throw new Error("CARD_NOT_FOUND");
  const voucherRef = found.docs[0].ref;
  const wRef = db.collection("wallets").doc(uid);
  const ledgerId = voucherRedeemLedgerId(voucherRef.id);
  const ledgerRef = db.collection(WALLET_LEDGER_COLLECTION).doc(ledgerId);
  return db.runTransaction(async (tx) => {
    const [vSnap, wSnap, ledgerSnap] = await Promise.all([
      tx.get(voucherRef),
      tx.get(wRef),
      tx.get(ledgerRef)
    ]);
    const balance = wSnap.exists ? Math.round(Number(wSnap.data()?.user_balance ?? 0)) : 0;
    if (ledgerSnap.exists) {
      const amt2 = Math.round(Number(ledgerSnap.data()?.amount ?? 0));
      return { amount: amt2, balance, duplicate: true };
    }
    if (!vSnap.exists) throw new Error("CARD_NOT_FOUND");
    const v = vSnap.data();
    if (isVoucherMarkedUsed(v)) throw new Error("CARD_ALREADY_REDEEMED");
    if (isVoucherExpired(v.expiryDate)) throw new Error("CARD_EXPIRED");
    const amt = readVoucherAmount(v);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("CARD_INVALID_AMOUNT");
    const next = balance + amt;
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const codeLabel = String(v.code ?? compact).slice(0, 12);
    const redeemer = opts.redeemer && String(opts.redeemer.userId ?? "").trim() === uid ? opts.redeemer : null;
    const ledgerExtra = redeemer ? buildLedgerRedeemerFields(redeemer) : {};
    const voucherExtra = redeemer ? buildVoucherRedeemerFields(redeemer) : {};
    tx.set(wRef, { user_balance: next, updatedAt: ts }, { merge: true });
    tx.set(ledgerRef, {
      transactionId: ledgerId,
      userId: uid,
      walletUserId: uid,
      amount: amt,
      type: "credit",
      status: "completed",
      timestamp: ts,
      bookingId: null,
      label: `\u0634\u062D\u0646 \u0642\u0633\u064A\u0645\u0629 ${codeLabel}`,
      balanceAfter: next,
      source: "voucher",
      voucherId: voucherRef.id,
      voucherCode: String(v.code ?? "").trim() || compact,
      ...ledgerExtra
    });
    tx.set(
      voucherRef,
      {
        isUsed: true,
        used: true,
        usedAt: ts,
        usedBy: uid,
        redeemedAmount: amt,
        ...voucherExtra
      },
      { merge: true }
    );
    return { amount: amt, balance: next, duplicate: false };
  });
}

// server/promoService.ts
var firestoreInited = false;
function initAdminApp() {
  if (firestoreInited) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (pathEnv && fs3.existsSync(pathEnv)) {
    const c = JSON.parse(fs3.readFileSync(pathEnv, "utf8"));
    admin2.initializeApp({ credential: admin2.credential.cert(c) });
  } else if (json) {
    admin2.initializeApp({
      credential: admin2.credential.cert(JSON.parse(json))
    });
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH required for promo APIs"
    );
  }
  firestoreInited = true;
}
function isPromoFirestoreConfigured() {
  return isWalletFirestoreConfigured();
}
function getPromoDb() {
  initAdminApp();
  return admin2.firestore();
}
function normCode(raw) {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function tsToMs(v) {
  if (v == null) return null;
  if (v instanceof admin2.firestore.Timestamp) return v.toMillis();
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof v.toMillis === "function") {
    return v.toMillis();
  }
  return null;
}
function regionAllowed(allowed, region) {
  if (!allowed?.length) return true;
  const r = String(region ?? "").trim().toLowerCase();
  return allowed.some((a) => String(a).trim().toLowerCase() === r);
}
function fieldAllowed(allowed, fieldId) {
  if (!allowed?.length) return true;
  return allowed.map(String).includes(String(fieldId));
}
function computeDiscount(bookingAmount, discountType, discountValue) {
  const amt = Math.max(0, Math.round(Number(bookingAmount)));
  let disc = 0;
  if (discountType === "percent") {
    const p = Math.min(100, Math.max(0, Number(discountValue)));
    disc = Math.round(amt * p / 100);
  } else {
    disc = Math.round(Math.max(0, Number(discountValue)));
  }
  if (disc > amt) disc = amt;
  const finalPrice = Math.max(0, amt - disc);
  return { discountAmount: disc, finalPrice };
}
async function countUserPromoUses(db, userId, codeId) {
  const snap = await db.collection("promoCodeUsages").where("userId", "==", userId).get();
  let n = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (x.promoCode === codeId) n++;
  }
  return n;
}
async function countConfirmedBookings(db, userId) {
  const snap = await db.collection("bookings").where("playerUserId", "==", userId).where("status", "==", "confirmed").get();
  return snap.size;
}
async function runPromoValidation(body) {
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
      message: "\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u0643\u0648\u0628\u0648\u0646"
    };
  }
  if (!userId) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0637\u0644\u0648\u0628"
    };
  }
  if (!fieldId) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0644\u0639\u0628 \u0645\u0637\u0644\u0648\u0628"
    };
  }
  if (!Number.isFinite(bookingAmount) || bookingAmount <= 0) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: 0,
      message: "\u0645\u0628\u0644\u063A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D"
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
      message: "\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F"
    };
  }
  const d = snap.data();
  if (d.isActive === false) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644"
    };
  }
  const expMs = tsToMs(d.expiresAt ?? null);
  if (expMs != null && Date.now() > expMs) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0648\u0628\u0648\u0646"
    };
  }
  const usedCount = Number(d.usedCount ?? 0);
  const maxUses = Number(d.maxUses ?? 999999);
  if (usedCount >= maxUses) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0627\u0633\u062A\u064F\u0646\u0641\u062F\u062A \u0639\u062F\u062F \u0645\u0631\u0627\u062A \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0628\u0648\u0646"
    };
  }
  const allowedUsers = d.allowedUserIds;
  if (allowedUsers?.length && !allowedUsers.includes(userId)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0628\u0648\u0646"
    };
  }
  if (!regionAllowed(d.allowedRegions, region)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0646\u0637\u0642\u0629"
    };
  }
  if (!fieldAllowed(d.allowedFieldIds, fieldId)) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0639\u0628"
    };
  }
  const minAmt = Number(d.minBookingAmount ?? 0);
  if (bookingAmount < minAmt) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: `Minimum booking amount ${new Intl.NumberFormat("en-US").format(minAmt)} IQD`
    };
  }
  if (d.firstTimeUsersOnly) {
    const n = await countConfirmedBookings(db, userId);
    if (n > 0) {
      return {
        valid: false,
        discountAmount: 0,
        finalPrice: bookingAmount,
        message: "\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0627\u0644\u062C\u062F\u062F \u0641\u0642\u0637 (\u0623\u0648\u0644 \u062D\u062C\u0632)"
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
      message: "\u0627\u0633\u062A\u062E\u062F\u0645\u062A \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u0628\u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D"
    };
  }
  const dtype = d.discountType === "percent" ? "percent" : "fixed";
  const dval = Number(d.discountValue ?? 0);
  const { discountAmount, finalPrice } = computeDiscount(
    bookingAmount,
    dtype,
    dval
  );
  if (discountAmount <= 0) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: bookingAmount,
      message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062E\u0635\u0645 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0628\u0644\u063A"
    };
  }
  const secret = process.env.PROMO_JWT_SECRET?.trim() || process.env.SESSION_SECRET || "shootha_secret_2026";
  const payload = {
    v: 1,
    code: codeRaw,
    userId,
    fieldId,
    region,
    bookingAmount,
    discountAmount,
    finalPrice
  };
  const validationToken = jwt.sign(payload, secret, { expiresIn: "15m" });
  return {
    valid: true,
    discountAmount,
    finalPrice,
    message: "\u062A\u0645 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0643\u0648\u0628\u0648\u0646",
    validationToken
  };
}
async function runPromoRedeem(validationToken, bookingId, secret) {
  const bid = String(bookingId ?? "").trim();
  if (!bid) return { ok: false, message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062D\u062C\u0632 \u0645\u0637\u0644\u0648\u0628" };
  if (!validationToken?.trim()) {
    return { ok: false, message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0641\u0642\u0648\u062F" };
  }
  let payload;
  try {
    payload = jwt.verify(validationToken.trim(), secret);
  } catch {
    return { ok: false, message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u2014 \u0623\u0639\u062F \u0627\u0644\u062A\u0637\u0628\u064A\u0642" };
  }
  if (payload.v !== 1 || !payload.code || !payload.userId) {
    return { ok: false, message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" };
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
        throw new Error("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      }
      const b = bookingSnap.data();
      if (String(b.playerUserId ?? "") !== payload.userId) {
        throw new Error("\u0627\u0644\u062D\u062C\u0632 \u0644\u0627 \u064A\u062E\u0635 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
      }
      if (String(b.venueId ?? "") !== payload.fieldId) {
        throw new Error("\u0627\u0644\u0645\u0644\u0639\u0628 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0643\u0648\u0628\u0648\u0646");
      }
      const tp = Number(b.totalPrice);
      if (!Number.isFinite(tp) || tp !== payload.finalPrice) {
        throw new Error("\u0645\u0628\u0644\u063A \u0627\u0644\u062D\u062C\u0632 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u2014 \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642");
      }
      if (usageSnap.exists) {
        throw new Error("\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0643\u0648\u0628\u0648\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632 \u0645\u0633\u0628\u0642\u0627\u064B");
      }
      if (!promoSnap.exists) {
        throw new Error("\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      }
      const d = promoSnap.data();
      if (d.isActive === false) {
        throw new Error("\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644");
      }
      const expMs = tsToMs(d.expiresAt ?? null);
      if (expMs != null && Date.now() > expMs) {
        throw new Error("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0648\u0628\u0648\u0646");
      }
      const usedCount = Number(d.usedCount ?? 0);
      const maxUses = Number(d.maxUses ?? 999999);
      if (usedCount >= maxUses) {
        throw new Error("\u0627\u0633\u062A\u064F\u0646\u0641\u062F \u0627\u0644\u0643\u0648\u0628\u0648\u0646");
      }
      if (!regionAllowed(d.allowedRegions, payload.region)) {
        throw new Error("\u0645\u0646\u0637\u0642\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629");
      }
      if (!fieldAllowed(d.allowedFieldIds, payload.fieldId)) {
        throw new Error("\u0645\u0644\u0639\u0628 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D");
      }
      const minAmt = Number(d.minBookingAmount ?? 0);
      if (payload.bookingAmount < minAmt) {
        throw new Error("\u0645\u0628\u0644\u063A \u0627\u0644\u062D\u062C\u0632 \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649");
      }
      const usesQ = await tx.get(
        db.collection("promoCodeUsages").where("userId", "==", payload.userId).limit(50)
      );
      const perUser = Number(d.usagePerUserLimit ?? 1);
      let userUses = 0;
      for (const doc2 of usesQ.docs) {
        if (doc2.id === bid) continue;
        const u = doc2.data();
        if (u.promoCode === payload.code) userUses++;
      }
      if (userUses >= perUser) {
        throw new Error("\u062A\u062C\u0627\u0648\u0632\u062A \u062D\u062F \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0644\u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u0628\u0648\u0646");
      }
      if (d.firstTimeUsersOnly) {
        const booksQ = await tx.get(
          db.collection("bookings").where("playerUserId", "==", payload.userId).where("status", "==", "confirmed").limit(20)
        );
        const others = booksQ.docs.filter((x) => x.id !== bid);
        if (others.length > 0) {
          throw new Error("\u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0627\u0644\u062C\u062F\u062F \u0641\u0642\u0637");
        }
      }
      const { discountAmount, finalPrice } = computeDiscount(
        payload.bookingAmount,
        d.discountType === "percent" ? "percent" : "fixed",
        Number(d.discountValue ?? 0)
      );
      if (discountAmount !== payload.discountAmount || finalPrice !== payload.finalPrice) {
        throw new Error("\u062A\u063A\u064A\u0651\u0631\u062A \u0634\u0631\u0648\u0637 \u0627\u0644\u0643\u0648\u0628\u0648\u0646 \u2014 \u0623\u0639\u062F \u0627\u0644\u062A\u0637\u0628\u064A\u0642");
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
        createdAt: admin2.firestore.FieldValue.serverTimestamp()
      });
      tx.update(promoRef, {
        usedCount: admin2.firestore.FieldValue.increment(1),
        totalBookings: admin2.firestore.FieldValue.increment(1),
        totalRevenue: admin2.firestore.FieldValue.increment(payload.finalPrice),
        totalDiscountGiven: admin2.firestore.FieldValue.increment(
          payload.discountAmount
        ),
        lastUsedAt: admin2.firestore.FieldValue.serverTimestamp()
      });
      tx.update(bookingRef, {
        promoCode: payload.code,
        promoDiscountAmount: payload.discountAmount,
        bookingSubtotalBeforePromo: payload.bookingAmount
      });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "\u062A\u0639\u0630\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0643\u0648\u0628\u0648\u0646";
    return { ok: false, message: msg };
  }
}
function registerPromoRoutes(app2, jwtSecret) {
  app2.post("/api/promo/validate", async (req, res) => {
    if (!isPromoFirestoreConfigured()) {
      return res.status(503).json({
        valid: false,
        discountAmount: 0,
        finalPrice: Number(req.body?.bookingAmount) || 0,
        message: "\u062E\u0627\u062F\u0645 \u0627\u0644\u0643\u0648\u0628\u0648\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u064F\u0636\u0628\u0637 (Firebase Admin)"
      });
    }
    try {
      const out = await runPromoValidation(req.body);
      return res.json(out);
    } catch (e) {
      console.error("[POST /api/promo/validate]", e);
      return res.status(500).json({
        valid: false,
        discountAmount: 0,
        finalPrice: Number(req.body?.bookingAmount) || 0,
        message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645"
      });
    }
  });
  app2.post("/api/promo/redeem", async (req, res) => {
    if (!isPromoFirestoreConfigured()) {
      return res.status(503).json({ success: false, message: "Promo backend off" });
    }
    const validationToken = String(req.body?.validationToken ?? "").trim();
    const bookingId = String(req.body?.bookingId ?? "").trim();
    const secret = process.env.PROMO_JWT_SECRET?.trim() || jwtSecret;
    const result2 = await runPromoRedeem(validationToken, bookingId, secret);
    if (!result2.ok) {
      return res.status(400).json({ success: false, message: result2.message });
    }
    return res.json({ success: true, message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0643\u0648\u0628\u0648\u0646" });
  });
}

// server/pitchRatingsRoute.ts
import { createHash } from "node:crypto";
import * as admin3 from "firebase-admin";
var RATINGS_COLLECTION = "\u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A";
var LEADERBOARD_STATS = "leaderboardPlayerStats";
var BAGHDAD_UTC_OFFSET_H = 3;
function wallBaghdadStartUtcMs(date, time) {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  const [th, tm] = time.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  const hh = Number.isFinite(th) ? th : 0;
  const mm = Number.isFinite(tm) ? tm : 0;
  return Date.UTC(y, mo - 1, d, hh - BAGHDAD_UTC_OFFSET_H, mm, 0, 0);
}
function sessionEndedBaghdad(date, startTime, durationH, nowMs) {
  const dur = Number(durationH);
  if (!Number.isFinite(dur) || dur <= 0) return false;
  const startMs = wallBaghdadStartUtcMs(date, startTime);
  if (!Number.isFinite(startMs)) return false;
  const endMs = startMs + Math.max(0.25, dur) * 60 * 60 * 1e3;
  return nowMs >= endMs;
}
function playerStatDocId(name) {
  const raw = name.trim().replace(/\s+/g, " ").normalize("NFC").slice(0, 200);
  const h = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
  return `p_${h}`;
}
function computePlayerPoints(stars, goals) {
  const s = Math.min(5, Math.max(1, Math.round(stars)));
  const g = Math.min(99, Math.max(0, Math.round(goals)));
  return s * 15 + g * 5;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
async function verifyCallerOwnsRater(req, raterUserId) {
  const h = String(req.headers.authorization ?? "");
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) return false;
  try {
    const dec = await admin3.auth().verifyIdToken(m[1]);
    if (dec.uid === raterUserId) return true;
    const e164 = String(dec.e164 ?? "").trim();
    if (e164 && e164 === raterUserId) return true;
    const playerId = String(dec.playerId ?? "").trim();
    if (playerId && playerId === raterUserId) return true;
    return false;
  } catch {
    return false;
  }
}
function registerPitchRatingsRoute(app2) {
  app2.post("/api/pitch-ratings", async (req, res) => {
    try {
      ensureFirebaseAdminApp();
    } catch {
      return res.status(503).json({ message: "\u062E\u0627\u062F\u0645 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 (Firebase Admin)" });
    }
    const body = req.body;
    const bookingId = String(body.bookingId ?? "").trim();
    const raterUserId = String(body.raterUserId ?? "").trim();
    const venueId = String(body.venueId ?? "").trim();
    const venueName = String(body.venueName ?? "").trim().slice(0, 200);
    const venueStars = Number(body.venueStars);
    const venueFeedback = String(body.venueFeedback ?? "").trim().slice(0, 2e3);
    const playersRaw = Array.isArray(body.players) ? body.players : [];
    if (!bookingId || !raterUserId || !venueId) {
      return res.status(400).json({ message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0646\u0627\u0642\u0635\u0629 (\u0627\u0644\u062D\u062C\u0632 \u0623\u0648 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0627\u0644\u0645\u0644\u0639\u0628)" });
    }
    const authOk = await verifyCallerOwnsRater(req, raterUserId);
    if (!authOk) {
      return res.status(401).json({ message: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0623\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0642\u064A\u0651\u0645" });
    }
    if (!Number.isFinite(venueStars) || venueStars < 1 || venueStars > 5) {
      return res.status(400).json({ message: "\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0644\u0639\u0628 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u064A\u0646 1 \u0648 5" });
    }
    const players = [];
    for (const p of playersRaw.slice(0, 24)) {
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      const stars = Number(p.stars);
      const goals = Number(p.goals ?? 0);
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
        return res.status(400).json({ message: `\u062A\u0642\u064A\u064A\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0644\u0627\u0639\u0628: ${name.slice(0, 40)}` });
      }
      if (!Number.isFinite(goals) || goals < 0 || goals > 99) {
        return res.status(400).json({ message: `\u0639\u062F\u062F \u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0644\u0644\u0627\u0639\u0628: ${name.slice(0, 40)}` });
      }
      players.push({ name: name.slice(0, 80), stars: Math.round(stars), goals: Math.round(goals) });
    }
    const db = admin3.firestore();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const ratingRef = db.collection(RATINGS_COLLECTION).doc(bookingId);
    const fieldRef = db.collection("fields").doc(venueId);
    try {
      await db.runTransaction(async (tx) => {
        const [bSnap, rSnap, fSnap] = await Promise.all([
          tx.get(bookingRef),
          tx.get(ratingRef),
          tx.get(fieldRef)
        ]);
        if (!bSnap.exists) {
          throw Object.assign(new Error("BOOKING_NOT_FOUND"), { code: 404 });
        }
        if (rSnap.exists) {
          throw Object.assign(new Error("ALREADY_RATED"), { code: 409 });
        }
        const b = bSnap.data();
        if (String(b.playerUserId ?? "").trim() !== raterUserId) {
          throw Object.assign(new Error("FORBIDDEN"), { code: 403 });
        }
        if (String(b.venueId ?? "").trim() !== venueId) {
          throw Object.assign(new Error("VENUE_MISMATCH"), { code: 400 });
        }
        if (String(b.status ?? "") === "cancelled") {
          throw Object.assign(new Error("CANCELLED"), { code: 400 });
        }
        const date = String(b.date ?? "");
        const startTime = String(b.startTime ?? "").includes(":") ? String(b.startTime) : `${String(b.startTime ?? "0").padStart(2, "0")}:00`;
        const duration = Number(b.duration);
        if (!sessionEndedBaghdad(date, startTime, duration, Date.now())) {
          throw Object.assign(new Error("SESSION_NOT_ENDED"), { code: 400 });
        }
        tx.set(ratingRef, {
          bookingId,
          raterUserId,
          venueId,
          venueName: venueName || String(b.venueName ?? "").trim().slice(0, 200),
          venueStars: Math.round(venueStars),
          venueFeedback,
          players,
          bookingDate: date,
          bookingStartTime: startTime,
          bookingDurationHours: duration,
          createdAt: admin3.firestore.FieldValue.serverTimestamp()
        });
        const prevC = fSnap.exists ? Number(fSnap.data()?.reviewCount ?? 0) : 0;
        const prevR = fSnap.exists ? Number(fSnap.data()?.rating ?? 0) : 0;
        const newC = prevC + 1;
        const newR = newC === 1 ? venueStars : (prevR * prevC + venueStars) / newC;
        tx.set(
          fieldRef,
          {
            rating: round2(newR),
            reviewCount: newC
          },
          { merge: true }
        );
        for (const p of players) {
          const pid = playerStatDocId(p.name);
          const pref = db.collection(LEADERBOARD_STATS).doc(pid);
          const pts = computePlayerPoints(p.stars, p.goals);
          tx.set(
            pref,
            {
              displayName: p.name,
              totalPoints: admin3.firestore.FieldValue.increment(pts),
              matchesRated: admin3.firestore.FieldValue.increment(1),
              totalGoals: admin3.firestore.FieldValue.increment(p.goals),
              updatedAt: admin3.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
        tx.set(
          bookingRef,
          {
            postMatchRatingAt: admin3.firestore.FieldValue.serverTimestamp(),
            postMatchRatingVenueStars: Math.round(venueStars)
          },
          { merge: true }
        );
      });
      return res.json({ ok: true });
    } catch (e) {
      const err = e;
      if (err.code === 404) return res.status(404).json({ message: "\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (err.code === 409) return res.status(409).json({ message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u062A\u0642\u064A\u064A\u0645 \u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632 \u0645\u0633\u0628\u0642\u0627\u064B" });
      if (err.code === 403) return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0642\u064A\u064A\u0645 \u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632" });
      if (err.code === 400) {
        if (err.message === "VENUE_MISMATCH") {
          return res.status(400).json({ message: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0644\u0639\u0628 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u062D\u062C\u0632" });
        }
        if (err.message === "CANCELLED") {
          return res.status(400).json({ message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0642\u064A\u064A\u0645 \u062D\u062C\u0632 \u0645\u0644\u063A\u0649" });
        }
        if (err.message === "SESSION_NOT_ENDED") {
          return res.status(400).json({ message: "\u0644\u0645 \u064A\u0646\u062A\u0647\u0650 \u0648\u0642\u062A \u0627\u0644\u062D\u062C\u0632 \u0628\u0639\u062F" });
        }
      }
      console.error("[pitch-ratings]", e);
      return res.status(500).json({ message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0642\u064A\u064A\u0645" });
    }
  });
}

// server/waylRoutes.ts
import * as admin4 from "firebase-admin";

// server/waylService.ts
import axios from "axios";
var WAYL_AUTH_HEADER = "X-WAYL-AUTHENTICATION";
var WAYL_DEFAULT_CURRENCY = "IQD";
function envTrim(key) {
  return process.env[key]?.trim() ?? "";
}
function getWaylBaseUrl() {
  return envTrim("WAYL_BASE_URL") || "https://api.thewayl.com";
}
function getWaylApiKey() {
  return envTrim("WAYL_API_KEY");
}
function getWaylCheckoutPath() {
  return envTrim("WAYL_CHECKOUT_PATH");
}
function resolveWaylWebhookUrl() {
  let url = envTrim("WAYL_WEBHOOK_URL");
  const lan = envTrim("WAYL_PUBLIC_HOST") || envTrim("DEV_LAN_HOST") || envTrim("EXPO_PUBLIC_DEV_LAN_HOST");
  const port = envTrim("PORT") || "4001";
  if (!url && lan) {
    return `http://${lan}:${port}/api/payments/wayl/webhook`;
  }
  if (url && (/localhost|127\.0\.0\.1/i.test(url) || /:\/\/localhost/i.test(url)) && lan) {
    try {
      const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`;
      const u = new URL(normalized);
      u.hostname = lan;
      if (!u.port) u.port = port;
      return u.toString().replace(/\/$/, "");
    } catch {
    }
  }
  return url;
}
function getWebhookSecret() {
  return envTrim("WAYL_WEBHOOK_SECRET");
}
var WaylHttpError = class extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "WaylHttpError";
  }
};
var WaylService = class {
  http;
  constructor(apiKey = getWaylApiKey(), baseUrl = getWaylBaseUrl()) {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new WaylHttpError(500, "WAYL_API_KEY is missing in environment variables");
    }
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 3e4,
      headers: {
        "Content-Type": "application/json",
        [WAYL_AUTH_HEADER]: cleanKey
      },
      validateStatus: () => true
    });
  }
  async verifyKey() {
    const response = await this.http.get("/api/v1/verify-auth-key");
    if (response.status >= 200 && response.status < 300) {
      return { valid: true, message: "Wayl API key is valid" };
    }
    throw this.toWaylError(response.status, response.data);
  }
  async createCheckoutSession(params) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new WaylHttpError(400, "amount must be a positive number");
    }
    const amountForGateway = Math.round(amount);
    console.log("[Wayl] FINAL amount (IQD, whole units):", amountForGateway);
    if (!Number.isInteger(amountForGateway) || amountForGateway <= 0) {
      throw new WaylHttpError(400, "amount must be a positive integer for the payment gateway");
    }
    if (!params.description?.trim()) {
      throw new WaylHttpError(400, "description is required");
    }
    if (!params.customer_details || !params.customer_details.name) {
      throw new WaylHttpError(400, "customer_details.name is required");
    }
    const payload = {
      amount: amountForGateway,
      currency: params.currency || WAYL_DEFAULT_CURRENCY,
      description: params.description.trim(),
      customer_details: params.customer_details,
      ...params.success_url ? { success_url: params.success_url } : {},
      ...params.failure_url ? { failure_url: params.failure_url } : {},
      ...params.cancel_url ? { cancel_url: params.cancel_url } : {},
      ...params.metadata ? { metadata: params.metadata } : {}
    };
    const buildLinkPayload = () => {
      const bookingId = String(params.metadata?.bookingId ?? "").trim();
      const referenceIdRaw = String(params.metadata?.referenceId ?? "").trim();
      const referenceId = referenceIdRaw || bookingId || `shootha-${Date.now()}`;
      const successUrl = String(params.success_url ?? "").trim();
      const failureUrl = String(params.failure_url ?? params.cancel_url ?? "").trim();
      const webhookUrl = resolveWaylWebhookUrl().trim();
      if (!successUrl) {
        throw new WaylHttpError(400, "success_url is required for Wayl link creation");
      }
      if (!failureUrl) {
        throw new WaylHttpError(400, "failure_url is required for Wayl link creation");
      }
      if (!webhookUrl) {
        throw new WaylHttpError(
          500,
          "WAYL_WEBHOOK_URL is missing. Set WAYL_WEBHOOK_URL or WAYL_PUBLIC_HOST / DEV_LAN_HOST / EXPO_PUBLIC_DEV_LAN_HOST with PORT."
        );
      }
      const customParameter = JSON.stringify({
        bookingId: bookingId || void 0,
        referenceId
      });
      const secret = getWebhookSecret() || "shootha-dev-webhook-secret";
      return {
        referenceId,
        total: amountForGateway,
        currency: params.currency || WAYL_DEFAULT_CURRENCY,
        customParameter,
        lineItem: [
          {
            label: params.description.trim(),
            amount: amountForGateway,
            type: "increase"
          }
        ],
        webhookUrl,
        webhookSecret: secret,
        success_url: successUrl,
        failure_url: failureUrl,
        redirectionUrl: successUrl
      };
    };
    const candidateEndpoints = [
      ...getWaylCheckoutPath() ? [getWaylCheckoutPath()] : [],
      "/api/v1/create-checkout-session",
      "/api/v1/checkout-session",
      "/api/v1/checkout/create-session",
      "/api/v1/checkout",
      "/api/v1/links"
    ].filter((x, i, arr) => arr.indexOf(x) === i);
    let response;
    for (const endpoint of candidateEndpoints) {
      const isLinksEndpoint = endpoint === "/api/v1/links" || /\/v\d+\/links\/?$/i.test(endpoint);
      const requestPayload = isLinksEndpoint ? buildLinkPayload() : payload;
      console.log("[Wayl] POST", endpoint, {
        payloadKeys: requestPayload && typeof requestPayload === "object" ? Object.keys(requestPayload) : []
      });
      const r = await this.http.post(endpoint, requestPayload);
      console.log("[Wayl] response", {
        status: r.status,
        endpoint,
        data: r.data
      });
      response = { status: r.status, data: r.data, endpoint };
      if (r.status >= 200 && r.status < 300) break;
      if (r.status === 400 || r.status === 401) {
        throw this.toWaylError(r.status, r.data);
      }
      if (r.status !== 404) {
        throw this.toWaylError(r.status, r.data);
      }
    }
    if (!response) {
      throw new WaylHttpError(502, "Wayl API did not return a response");
    }
    if (response.status < 200 || response.status >= 300) {
      const details = {
        message: "Wayl checkout endpoint not found. Verify the exact create-session path in your Wayl docs.",
        triedEndpoints: candidateEndpoints,
        lastTried: response.endpoint,
        upstreamStatus: response.status,
        upstreamBody: response.data
      };
      throw new WaylHttpError(404, "Wayl checkout endpoint not found", details);
    }
    const data = response.data ?? {};
    const checkoutUrl = typeof data.checkout_url === "string" && data.checkout_url || typeof data.checkoutUrl === "string" && data.checkoutUrl || typeof data.url === "string" && data.url || (typeof data.data === "object" && data.data && typeof data.data.url === "string" ? data.data.url : "") || "";
    if (!checkoutUrl) {
      throw new WaylHttpError(
        502,
        "Wayl response did not include a checkout URL",
        response.data
      );
    }
    return { checkoutUrl, raw: response.data };
  }
  async validateTransaction(transactionId) {
    const txId = String(transactionId ?? "").trim();
    if (!txId) {
      throw new WaylHttpError(400, "transactionId is required");
    }
    const candidates = [
      async () => {
        const r = await this.http.get(`/api/v1/transactions/${encodeURIComponent(txId)}`);
        return { status: r.status, data: r.data };
      },
      async () => {
        const r = await this.http.get(`/api/v1/transaction/${encodeURIComponent(txId)}`);
        return { status: r.status, data: r.data };
      },
      async () => {
        const r = await this.http.post("/api/v1/validate-transaction", {
          transaction_id: txId
        });
        return { status: r.status, data: r.data };
      }
    ];
    let lastStatus = 0;
    let lastData = void 0;
    for (const run of candidates) {
      const response = await run();
      lastStatus = response.status;
      lastData = response.data;
      if (response.status >= 200 && response.status < 300) {
        const normalized = this.normalizePaymentStatus(response.data);
        return {
          paid: isWaylPaidStatus(normalized),
          status: normalized,
          raw: response.data
        };
      }
      if (response.status === 401 || response.status === 400) {
        throw this.toWaylError(response.status, response.data);
      }
    }
    throw this.toWaylError(lastStatus || 502, lastData);
  }
  static isWaylHttpError(error) {
    return error instanceof WaylHttpError;
  }
  toWaylError(status, data) {
    const body = data ?? {};
    if (status === 401) {
      return new WaylHttpError(
        401,
        "Unauthorized: invalid Wayl API key (X-WAYL-AUTHENTICATION)",
        data
      );
    }
    if (status === 400) {
      return new WaylHttpError(
        400,
        body.message || body.error || "Bad Request: invalid Wayl checkout payload",
        data
      );
    }
    return new WaylHttpError(
      status || 502,
      body.message || body.error || "Wayl API request failed",
      data
    );
  }
  normalizePaymentStatus(data) {
    const obj = data ?? {};
    const nestedData = obj.data && typeof obj.data === "object" && !Array.isArray(obj.data) ? obj.data : void 0;
    const statusRaw = obj.payment_status ?? obj.paymentStatus ?? obj.status ?? obj.state ?? obj.transaction_status ?? obj.transactionStatus ?? nestedData?.payment_status ?? nestedData?.paymentStatus ?? nestedData?.status ?? nestedData?.state ?? "";
    return String(statusRaw).trim().toUpperCase();
  }
};
var WAYL_SUCCESS_STATUSES = /* @__PURE__ */ new Set([
  "PAID",
  "PAID_OUT",
  "APPROVED",
  "SUCCESS",
  "SUCCEEDED",
  "COMPLETED",
  "COMPLETE",
  "CAPTURED",
  "SETTLED",
  "CONFIRMED"
]);
function isWaylPaidStatus(normalizedUpper) {
  return WAYL_SUCCESS_STATUSES.has(String(normalizedUpper ?? "").trim().toUpperCase());
}
function mapWaylException(error) {
  if (error instanceof WaylHttpError) return error;
  if (axios.isAxiosError(error)) {
    const e = error;
    return new WaylHttpError(
      e.response?.status || 502,
      e.response?.data?.message || e.response?.data?.error || e.message || "Wayl API error",
      e.response?.data
    );
  }
  if (error instanceof Error) {
    return new WaylHttpError(500, error.message);
  }
  return new WaylHttpError(500, "Unexpected Wayl integration error");
}

// server/waylRoutes.ts
function registerWaylRoutes(app2) {
  app2.get("/api/payments/wayl/verify-key", async (_req, res) => {
    try {
      const wayl = new WaylService();
      const result2 = await wayl.verifyKey();
      return res.json(result2);
    } catch (error) {
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details
      });
    }
  });
  app2.post("/api/payments/wayl/checkout-session", async (req, res) => {
    try {
      console.log("[Wayl] checkout-session body:", JSON.stringify(req.body ?? {}));
      const body = req.body;
      console.log("FINAL AMOUNT RECEIVED:", Number(body.amount));
      const bookingId = String(body.bookingId ?? body.metadata?.bookingId ?? "").trim();
      if (!bookingId) {
        return res.status(400).json({
          message: "bookingId is required (body.bookingId or metadata.bookingId)"
        });
      }
      const origin = String(req.headers.origin ?? "").trim();
      const webBase = origin || process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.WEB_APP_URL?.trim() || "";
      const webSuccessUrl = webBase ? `${webBase.replace(/\/$/, "")}/payment/result?status=success` : "";
      const webFailureUrl = webBase ? `${webBase.replace(/\/$/, "")}/payment/result?status=failure` : "";
      const defaultSuccessUrl = webSuccessUrl || "shootha://payment/result?status=success";
      const defaultFailureUrl = webFailureUrl || "shootha://payment/result?status=failure";
      const successUrl = String(
        body.success_url ?? process.env.WAYL_SUCCESS_URL ?? defaultSuccessUrl
      ).trim();
      const failureUrl = String(
        body.failure_url ?? body.cancel_url ?? process.env.WAYL_FAILURE_URL ?? process.env.WAYL_CANCEL_URL ?? defaultFailureUrl
      ).trim();
      const metadata = {
        ...body.metadata ?? {},
        bookingId
      };
      const wayl = new WaylService();
      const session = await wayl.createCheckoutSession({
        amount: Number(body.amount),
        description: String(body.description ?? ""),
        customer_details: body.customer_details ?? {},
        currency: body.currency || "IQD",
        success_url: successUrl,
        failure_url: failureUrl,
        cancel_url: failureUrl,
        metadata
      });
      console.log("[Wayl] checkout-session OK:", {
        checkoutUrl: session.checkoutUrl?.slice(0, 80)
      });
      return res.status(201).json({
        checkoutUrl: session.checkoutUrl
      });
    } catch (error) {
      console.error("[Wayl] checkout-session route error:", error);
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details
      });
    }
  });
  app2.post("/api/payments/wayl/validate-transaction", async (req, res) => {
    try {
      const body = req.body;
      const wayl = new WaylService();
      const result2 = await wayl.validateTransaction(String(body.transactionId ?? ""));
      return res.json(result2);
    } catch (error) {
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details
      });
    }
  });
  app2.post("/api/payments/wayl/webhook", async (req, res) => {
    const payload = req.body ?? {};
    try {
      const statusRaw = String(payload.status ?? payload.paymentStatus ?? "").trim().toLowerCase();
      if (statusRaw !== "approved") {
        return res.status(200).send("OK");
      }
      const metadataObj = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata) ? payload.metadata : void 0;
      const customParameterObj = (() => {
        const raw = payload.customParameter;
        if (typeof raw !== "string" || !raw.trim()) return void 0;
        try {
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
        } catch {
          return void 0;
        }
      })();
      const bookingId = String(
        metadataObj?.bookingId ?? customParameterObj?.bookingId ?? payload.bookingId ?? ""
      ).trim();
      if (!bookingId) {
        return res.status(200).send("OK");
      }
      if (!isWalletFirestoreConfigured()) {
        return res.status(200).send("OK");
      }
      ensureFirebaseAdminApp();
      const db = admin4.firestore();
      const txId = String(
        payload.transactionId ?? payload.transaction_id ?? payload.id ?? payload.referenceId ?? payload.reference_id ?? ""
      ).trim();
      await db.collection("bookings").doc(bookingId).set(
        {
          status: "confirmed",
          paymentStatus: "paid",
          waylTransactionId: txId || null,
          paidAt: admin4.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin4.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Wayl webhook processing error:", error);
      return res.status(200).send("OK");
    }
  });
}

// server/routes.ts
import rateLimit from "express-rate-limit";

// server/authSecrets.ts
function assertProductionSecurityConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const jwt3 = process.env.SESSION_SECRET?.trim() ?? "";
  if (jwt3.length < 32) {
    throw new Error(
      `SESSION_SECRET is required in production (min 32 characters). Example: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  const sup = process.env.SUPERVISOR_MASTER_KEY?.trim() ?? "";
  if (sup.length < 16) {
    throw new Error(
      "SUPERVISOR_MASTER_KEY is required in production (min 16 random characters)."
    );
  }
}
function getJwtSecret() {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET missing after production assert");
  }
  return "shootha_secret_2026_dev_only";
}
function getSupervisorMasterKey() {
  const s = process.env.SUPERVISOR_MASTER_KEY?.trim() ?? "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPERVISOR_MASTER_KEY missing after production assert");
  }
  return "shootha_supervisor_2026_dev_only";
}

// server/firebaseBridgeTickets.ts
import { randomBytes } from "node:crypto";
var TTL_MS = 15 * 60 * 1e3;
var MAX_ENTRIES = 5e4;
var byPhoneDigits = /* @__PURE__ */ new Map();
function pruneIfNeeded() {
  if (byPhoneDigits.size < MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of byPhoneDigits) {
    if (v.expiresAt <= now) byPhoneDigits.delete(k);
  }
}
function issueFirebaseBridgeTicket(phoneDigits) {
  pruneIfNeeded();
  const key = phoneDigits.replace(/\D/g, "");
  if (!key) throw new Error("empty_phone_digits");
  const ticket = randomBytes(32).toString("hex");
  byPhoneDigits.set(key, { ticket, expiresAt: Date.now() + TTL_MS });
  return ticket;
}
function consumeFirebaseBridgeTicket(phoneDigits, ticket) {
  const key = phoneDigits.replace(/\D/g, "");
  if (!key || !ticket?.trim()) return false;
  const row = byPhoneDigits.get(key);
  if (!row || row.ticket !== ticket.trim()) return false;
  if (Date.now() > row.expiresAt) {
    byPhoneDigits.delete(key);
    return false;
  }
  byPhoneDigits.delete(key);
  return true;
}

// server/routes.ts
function firebaseCustomTokenBridgeRequired() {
  return process.env.CUSTOM_TOKEN_INSECURE_LEGACY !== "1";
}
var PREPAID_CARD_ADMIN_KEY = process.env.PREPAID_CARD_ADMIN_KEY?.trim() ?? "";
function generateOtp() {
  return Math.floor(1e3 + Math.random() * 9e3).toString();
}
function normalizePhone(raw) {
  let p = (raw || "").replace(/\s+/g, "").replace(/[()-]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = "964" + p.slice(1);
  if (p.startsWith("7") && p.length === 10) p = "964" + p;
  return p.replace(/\D/g, "");
}
var OTP_IQ_SMS_URL = "https://api.otpiq.com/api/sms";
function phoneDigitsToOtpiqE164(digits) {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("964")) return `+${d}`;
  if (d.startsWith("0")) return `+964${d.slice(1)}`;
  if (d.length === 10 && d.startsWith("7")) return `+964${d}`;
  return d ? `+${d}` : "";
}
async function sendOtpiqVerificationSms(phoneDigits, verificationCode, apiKey) {
  const phoneNumber = phoneDigitsToOtpiqE164(phoneDigits);
  if (!/^\+964\d{10}$/.test(phoneNumber)) {
    return { ok: false, message: "\u0635\u064A\u063A\u0629 \u0631\u0642\u0645 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629 \u0644\u0625\u0631\u0633\u0627\u0644 SMS" };
  }
  try {
    const response = await axios2.post(
      OTP_IQ_SMS_URL,
      {
        phoneNumber,
        smsType: "verification",
        provider: "sms",
        verificationCode
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 2e4,
        validateStatus: () => true
      }
    );
    if (response.status >= 200 && response.status < 300) {
      return { ok: true };
    }
    const data = response.data;
    const errText = typeof data?.error === "string" && data.error ? data.error : `\u0641\u0634\u0644 \u0645\u0632\u0648\u0651\u062F \u0627\u0644\u0631\u0633\u0627\u0626\u0644 (${response.status})`;
    return { ok: false, message: errText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS error";
    return { ok: false, message: msg };
  }
}
function bookingTimeToMinutes(t) {
  const parts = String(t).split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  return h * 60 + m;
}
function bookingsOverlapMinutes(startA, durationHoursA, startB, durationHoursB) {
  const a0 = bookingTimeToMinutes(startA);
  const a1 = a0 + durationHoursA * 60;
  const b0 = bookingTimeToMinutes(startB);
  const b1 = b0 + durationHoursB * 60;
  return !(a1 <= b0 || a0 >= b1);
}
async function resolveOwnerForVenueBooking(venueId) {
  const owner = await storage.getAuthUserById(venueId);
  if (owner && owner.role === "owner" && owner.venueName) {
    return { ownerId: owner.id, fieldSize: owner.fieldSize ?? "5\xD75" };
  }
  if (isFirebaseEnvConfigured()) {
    const fsVenue = await getVenueByIdFromFirestore(venueId);
    if (fsVenue) {
      const linked = await getFirestoreFieldOwnerUserId(venueId);
      return {
        ownerId: linked || venueId,
        fieldSize: fsVenue.fieldSizes?.[0] ?? "5\xD75"
      };
    }
  }
  return null;
}
function otpErrorMessage(reason) {
  if (reason === "expired") return "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642\u060C \u0623\u0639\u062F \u0627\u0644\u0625\u0631\u0633\u0627\u0644";
  if (reason === "locked") return "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A\u060C \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u0627\u064B";
  return "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D";
}
function validateDateOfBirth(value) {
  if (!value) return { ok: true };
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, message: "\u0635\u064A\u063A\u0629 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 (YYYY-MM-DD)" };
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { ok: false, message: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
  }
  const now = /* @__PURE__ */ new Date();
  if (dt > now) return { ok: false, message: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644" };
  const minAge = 10;
  const maxAge = 100;
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() - (m - 1);
  if (monthDiff < 0 || monthDiff === 0 && now.getDate() < d) age--;
  if (age < minAge) return { ok: false, message: `\u0627\u0644\u0639\u0645\u0631 \u0627\u0644\u0623\u062F\u0646\u0649 \u0644\u0644\u062A\u0633\u062C\u064A\u0644 ${minAge} \u0633\u0646\u0648\u0627\u062A` };
  if (age > maxAge) return { ok: false, message: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F \u063A\u064A\u0631 \u0645\u0646\u0637\u0642\u064A" };
  return { ok: true };
}
function signToken(userId, role, expiresIn = "30d") {
  return jwt2.sign({ userId, role }, getJwtSecret(), { expiresIn });
}
function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    dateOfBirth: user.dateOfBirth ?? null,
    profileImage: user.profileImage ?? null,
    gender: user.gender ?? null
  };
}
function safeOwnerUser(user) {
  let images = [];
  try {
    images = user.venueImages ? JSON.parse(user.venueImages) : [];
  } catch {
  }
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
    venueImages: images
  };
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt2.verify(token, getJwtSecret());
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: "\u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0646\u062A\u0647\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B" });
  }
}
function guestFullAccessOnServer() {
  return process.env.GUEST_FULL_ACCESS !== "0";
}
function walletAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt2.verify(token, getJwtSecret());
      req.userId = payload.userId;
      req.userRole = payload.role;
      return next();
    } catch {
      return res.status(401).json({ message: "\u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0646\u062A\u0647\u064A\u0629\u060C \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B" });
    }
  }
  if (guestFullAccessOnServer()) {
    req.userId = "guest";
    req.userRole = "guest";
    return next();
  }
  return res.status(401).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
}
function ownerGuard(req, res, next) {
  const role = req.userRole;
  if (role !== "owner") {
    return res.status(403).json({ message: "\u0645\u062A\u0627\u062D \u0644\u0623\u0635\u062D\u0627\u0628 \u0627\u0644\u0645\u0644\u0627\u0639\u0628 \u0641\u0642\u0637" });
  }
  next();
}
async function registerRoutes(app2) {
  assertProductionSecurityConfig();
  const otpRouteLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "\u0637\u0644\u0628\u0627\u062A \u0643\u062B\u064A\u0631\u0629 \u2014 \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u0627\u064B" }
  });
  const internalBridgeLimiter = rateLimit({
    windowMs: 60 * 1e3,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests" }
  });
  app2.use("/api/auth/send-otp", otpRouteLimiter);
  app2.use("/api/otp/verify", otpRouteLimiter);
  app2.use("/api/auth/custom-token", otpRouteLimiter);
  app2.use("/api/internal/firebase-bridge-ticket", internalBridgeLimiter);
  app2.post("/api/internal/firebase-bridge-ticket", async (req, res) => {
    try {
      const auth3 = String(req.headers.authorization ?? "");
      const secret = process.env.FIREBASE_TOKEN_BRIDGE_SECRET?.trim() ?? "";
      if (!secret || auth3 !== `Bearer ${secret}`) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { phone } = req.body;
      const digits = normalizePhone(String(phone ?? ""));
      const e164 = phoneDigitsToOtpiqE164(digits);
      if (!/^\+964\d{10}$/.test(e164)) {
        return res.status(400).json({ message: "\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
      }
      const ticket = issueFirebaseBridgeTicket(digits);
      return res.json({ firebaseBridgeTicket: ticket });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
      const sendCheck = await storage.canSendOtp(normalizedPhone);
      if (!sendCheck.ok) {
        return res.status(429).json({
          message: `\u0627\u0646\u062A\u0638\u0631 ${sendCheck.retryAfterSec} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F`,
          retryAfterSec: sendCheck.retryAfterSec
        });
      }
      const otp = generateOtp();
      const iqKey = process.env.OTP_IQ_API_KEY?.trim();
      if (iqKey) {
        const sms = await sendOtpiqVerificationSms(normalizedPhone, otp, iqKey);
        if (!sms.ok) {
          console.error("[OTP] OTP IQ send failed:", sms.message);
          return res.status(502).json({
            message: sms.message || "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0646\u0635\u064A\u0629. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u0627\u064B."
          });
        }
      } else {
        console.warn(
          `[OTP] OTP_IQ_API_KEY \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u2014 \u0644\u0645 \u064A\u064F\u0631\u0633\u0644 SMS. \u0644\u0644\u062A\u0637\u0648\u064A\u0631 \u0641\u0642\u0637: ${normalizedPhone} \u2192 ${otp}`
        );
      }
      await storage.storeOtp(normalizedPhone, otp);
      if (!iqKey) {
        console.log(`[OTP] ${normalizedPhone} \u2192 ${otp}`);
      }
      return res.json({ message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642" });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/otp/verify", async (req, res) => {
    try {
      const { phone, code } = req.body;
      const normalizedPhone = normalizePhone(phone ?? "");
      const clean = String(code ?? "").replace(/\s/g, "");
      if (!normalizedPhone || normalizedPhone.length < 10 || !clean) {
        return res.status(400).json({ success: false, error: "\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0623\u0648 \u0627\u0644\u0631\u0645\u0632 \u0646\u0627\u0642\u0635" });
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, clean);
      if (!otpCheck.ok) {
        return res.status(400).json({
          success: false,
          error: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec
        });
      }
      let firebaseBridgeTicket;
      try {
        firebaseBridgeTicket = issueFirebaseBridgeTicket(normalizedPhone);
      } catch {
      }
      return res.json({
        success: true,
        message: "verified",
        ...firebaseBridgeTicket ? { firebaseBridgeTicket } : {}
      });
    } catch {
      return res.status(500).json({ success: false, error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/player-access-check", async (req, res) => {
    try {
      const { phone } = req.body;
      const normalizedPhone = normalizePhone(phone ?? "");
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ ok: false, message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
      const user = await storage.getAuthUserByPhone(normalizedPhone);
      if (!user) {
        return res.json({ ok: true });
      }
      if (user.role === "owner" || user.role === "supervisor") {
        return res.status(403).json({
          ok: false,
          blockedRole: user.role,
          message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628 Shootha Business. \u0623\u0646\u0634\u0626 \u062D\u0633\u0627\u0628\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B \u0641\u064A \u062A\u0637\u0628\u064A\u0642 Shootha \u0628\u0631\u0642\u0645 \u0645\u062E\u062A\u0644\u0641."
        });
      }
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/custom-token", async (req, res) => {
    try {
      const { phone, bridgeTicket, firebaseBridgeTicket } = req.body;
      const digits = normalizePhone(phone ?? "");
      const e164 = phoneDigitsToOtpiqE164(digits);
      if (!/^\+964\d{10}$/.test(e164)) {
        return res.status(400).json({ message: "\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
      }
      const ticketRaw = String(bridgeTicket ?? firebaseBridgeTicket ?? "").trim();
      if (firebaseCustomTokenBridgeRequired()) {
        if (!consumeFirebaseBridgeTicket(digits, ticketRaw)) {
          return res.status(401).json({
            message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062A\u062D\u0642\u0642. \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0631\u0645\u0632 OTP\u060C \u0623\u0648 \u0636\u0628\u0637 \u062E\u0627\u062F\u0645 OTP \u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621 /api/internal/firebase-bridge-ticket (\u0631\u0627\u062C\u0639 FIREBASE_TOKEN_BRIDGE_SECRET \u0648 MAIN_API_BRIDGE_BASE_URL)."
          });
        }
      }
      if (!isWalletFirestoreConfigured()) {
        return res.status(503).json({ message: "\u062E\u0627\u062F\u0645 Firebase \u063A\u064A\u0631 \u0645\u064F\u0636\u0628\u0637" });
      }
      ensureFirebaseAdminApp();
      const db = admin5.firestore();
      const userSnap = await db.collection("users").doc(e164).get();
      if (!userSnap.exists) {
        return res.status(404).json({ message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u062D\u0633\u0627\u0628" });
      }
      const uid = `sh_${digits}`;
      const uData = userSnap.data();
      const playerId = typeof uData?.playerId === "string" ? String(uData.playerId).trim() : "";
      const claims = { e164 };
      if (playerId) claims.playerId = playerId;
      const token = await admin5.auth().createCustomToken(uid, claims);
      return res.json({ token });
    } catch (e) {
      console.error("[custom-token]", e);
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const {
        phone,
        name,
        role,
        otp,
        deviceId,
        password,
        dateOfBirth,
        profileImage,
        venueName,
        areaName,
        fieldSize,
        bookingPrice,
        hasBathrooms,
        hasMarket,
        latitude,
        longitude,
        venueImages,
        ownerDeviceLat,
        ownerDeviceLon,
        userLat,
        userLon,
        gender
      } = req.body;
      if (!phone || !name || !role || !otp) {
        return res.status(400).json({ message: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629" });
      }
      const dobCheck = validateDateOfBirth(dateOfBirth);
      if (!dobCheck.ok) {
        return res.status(400).json({ message: dobCheck.message });
      }
      const normalizedPhone = normalizePhone(phone);
      const existingPhone = await storage.getAuthUserByPhone(normalizedPhone);
      if (existingPhone) {
        return res.status(409).json({ message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B" });
      }
      if (role === "owner" && venueName) {
        const existingVenue = await storage.getAuthUserByVenueName(venueName);
        if (existingVenue) {
          return res.status(409).json({ message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0639\u0628 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B" });
        }
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, otp);
      if (!otpCheck.ok) {
        return res.status(400).json({
          message: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec
        });
      }
      const playerLat = role === "player" ? userLat ?? latitude : latitude;
      const playerLon = role === "player" ? userLon ?? longitude : longitude;
      const user = await storage.createAuthUser({
        phone: normalizedPhone,
        name,
        role,
        deviceId,
        dateOfBirth,
        profileImage,
        venueName,
        areaName,
        fieldSize,
        bookingPrice,
        hasBathrooms,
        hasMarket,
        latitude: playerLat,
        longitude: playerLon,
        venueImages,
        ownerDeviceLat,
        ownerDeviceLon,
        gender
      });
      const token = signToken(user.id, user.role);
      return res.json({ token, user: safeUser(user) });
    } catch (e) {
      console.error("Register error:", e);
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0627\u0644\u0631\u0645\u0632 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
      }
      const normalizedPhone = normalizePhone(phone);
      const user = await storage.getAuthUserByPhone(normalizedPhone);
      if (!user) {
        return res.status(404).json({ message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0623\u0648\u0644\u0627\u064B" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "\u062A\u0645 \u062D\u0638\u0631 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628" });
      }
      const otpCheck = await storage.verifyOtp(normalizedPhone, otp);
      if (!otpCheck.ok) {
        return res.status(400).json({
          message: otpErrorMessage(otpCheck.reason),
          retryAfterSec: otpCheck.retryAfterSec
        });
      }
      const token = signToken(user.id, user.role);
      return res.json({ token, user: safeUser(user) });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) return res.status(404).json({ message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return res.json(safeUser(user));
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/wallet", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const rawLimit = req.query.limit;
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit ?? "20"), 10) || 20)
      );
      if (isWalletFirestoreConfigured()) {
        const { balance: balance2, transactions: transactions2 } = await getWalletAdmin(userId, limit);
        return res.json({ balance: balance2, transactions: transactions2 });
      }
      const [balance, transactions] = await Promise.all([
        storage.getWalletBalance(userId),
        storage.getWalletTransactions(userId, limit)
      ]);
      return res.json({ balance, transactions });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/wallet/redeem", walletAuthMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { code } = req.body;
      if (userId === "guest") {
        return res.status(400).json({ message: "\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0634\u062D\u0646 \u0627\u0644\u0645\u062D\u0641\u0638\u0629" });
      }
      if (isWalletFirestoreConfigured()) {
        try {
          const [memUser, fsProf] = await Promise.all([
            storage.getAuthUserById(userId),
            adminLoadRedeemerSnapshot(userId)
          ]);
          const redeemer = mergeRedeemerProfiles(userId, memUser, fsProf);
          const out = await adminRedeemPrepaidCardAndCreditWallet({
            userId,
            code: code ?? "",
            redeemer
          });
          return res.json({ amount: out.amount, balance: out.balance });
        } catch (e) {
          const msg = String(e?.message ?? "");
          if (msg === "CARD_CODE_TOO_SHORT") {
            return res.status(400).json({ message: "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0643\u0627\u0645\u0644\u0627\u064B" });
          }
          if (msg === "CARD_NOT_FOUND") {
            return res.status(400).json({ message: "\u0631\u0642\u0645 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
          }
          if (msg === "CARD_ALREADY_REDEEMED") {
            return res.status(400).json({ message: "\u0647\u0630\u0647 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0645\u064F\u0633\u062A\u062E\u062F\u0645\u0629 \u0645\u0633\u0628\u0642\u0627\u064B" });
          }
          if (msg === "CARD_EXPIRED") {
            return res.status(400).json({ message: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u0642\u0633\u064A\u0645\u0629" });
          }
          console.error("[wallet/redeem] Firestore redeem:", e);
          return res.status(500).json({ message: "\u062A\u0639\u0630\u0631 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0628\u0637\u0627\u0642\u0629" });
        }
      }
      const result2 = await storage.redeemPrepaidCard(userId, code ?? "");
      if (!result2.ok) return res.status(400).json({ message: result2.message });
      return res.json({ amount: result2.amount, balance: result2.balance });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/wallet/pay", walletAuthMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const body = req.body;
      const amount = Math.round(Number(body.amount ?? 0));
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "\u0627\u0644\u0645\u0628\u0644\u063A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
      }
      const label = typeof body.label === "string" ? body.label : "";
      const bookingId = body.bookingId != null && String(body.bookingId).trim() !== "" ? String(body.bookingId).trim() : null;
      const idempotencyKey = String(body.idempotencyKey ?? "").trim() || `pay:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      if (userId === "guest") {
        return res.status(400).json({ message: "\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0645\u062D\u0641\u0638\u0629" });
      }
      if (isWalletFirestoreConfigured()) {
        try {
          const out = await adminDebitWallet({
            userId,
            amount,
            label,
            bookingId,
            idempotencyKey
          });
          return res.json({ balance: out.balance, transactionId: out.transactionId });
        } catch (e) {
          const msg = e?.message ?? "";
          if (msg === "INSUFFICIENT_FUNDS" || msg.includes("INSUFFICIENT")) {
            return res.status(400).json({ message: "\u0631\u0635\u064A\u062F \u063A\u064A\u0631 \u0643\u0627\u0641\u064D" });
          }
          if (msg === "INVALID_DEBIT_PARAMS" || msg.includes("\u063A\u064A\u0631 \u0635\u0627\u0644\u062D")) {
            return res.status(400).json({ message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
          }
          console.error("[wallet/pay] Firestore debit:", e);
          return res.status(500).json({ message: "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062F\u0641\u0639" });
        }
      }
      const result2 = await storage.debitWallet(userId, amount, label);
      if (!result2.ok) {
        return res.status(400).json({ message: result2.message });
      }
      return res.json({ balance: result2.balance });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/admin/prepaid-cards", async (req, res) => {
    const headerKey = String(req.headers["x-prepaid-admin-key"] ?? "").trim();
    if (!PREPAID_CARD_ADMIN_KEY || headerKey !== PREPAID_CARD_ADMIN_KEY) {
      return res.status(401).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u2014 \u0639\u064A\u0651\u0646 PREPAID_CARD_ADMIN_KEY \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0648\u0623\u0631\u0633\u0644 X-Prepaid-Admin-Key" });
    }
    try {
      const { code, amount, expiryDate } = req.body;
      if (isWalletFirestoreConfigured()) {
        try {
          const out = await adminCreatePrepaidCard({
            code: code ?? "",
            amount: amount ?? 0,
            createdBy: "admin",
            expiryDate: expiryDate ?? null
          });
          return res.json({
            message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0631\u0635\u064A\u062F",
            code: out.code,
            amount: out.amount,
            id: out.id
          });
        } catch (e) {
          const msg = String(e?.message ?? "");
          if (msg === "CARD_CODE_TOO_SHORT")
            return res.status(400).json({ message: "\u0631\u0645\u0632 \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0642\u0635\u064A\u0631 \u062C\u062F\u0627\u064B (6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)" });
          if (msg === "CARD_AMOUNT_TOO_LOW") return res.status(400).json({ message: "Amount must be at least 1,000 IQD" });
          if (msg === "CARD_EXISTS") return res.status(409).json({ message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632 \u0645\u0633\u062C\u0651\u0644 \u0645\u0633\u0628\u0642\u0627\u064B" });
          console.error("[admin/prepaid-cards] Firestore create:", e);
          return res.status(500).json({ message: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0629" });
        }
      }
      await storage.createPrepaidCard(code ?? "", amount ?? 0);
      return res.json({ message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0631\u0635\u064A\u062F" });
    } catch (e) {
      return res.status(400).json({ message: e?.message ?? "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0637\u0627\u0642\u0629" });
    }
  });
  app2.patch("/api/auth/location", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { latitude, longitude } = req.body;
      await storage.updateAuthUser(userId, { latitude, longitude });
      return res.json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0642\u0639" });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.patch("/api/user/profile", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { name, dateOfBirth, profileImage, gender } = req.body;
      if (name !== void 0 && name.trim().length < 2) {
        return res.status(400).json({ message: "\u0627\u0644\u0627\u0633\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u062D\u0631\u0641\u064A\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
      }
      const updated = await storage.updateUserProfile(userId, {
        name: name?.trim(),
        dateOfBirth,
        profileImage,
        gender
      });
      return res.json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A", user: safeUser(updated) });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.delete("/api/user/account", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      }
      if (user.role === "owner") {
        const bookings = await storage.getOwnerBookings(userId);
        const upcoming = bookings.filter((b) => b.status === "upcoming");
        if (upcoming.length > 0) {
          return res.status(409).json({
            message: `\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u2014 \u0644\u062F\u064A\u0643 ${upcoming.length} \u062D\u062C\u0632 \u0642\u0627\u062F\u0645. \u064A\u0631\u062C\u0649 \u0625\u0644\u063A\u0627\u0621 \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0623\u0648\u0644\u0627\u064B`
          });
        }
      }
      await storage.softDeleteUser(userId);
      console.log(`[DELETE] User ${userId} soft-deleted`);
      return res.json({ message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D" });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/user/phone/send-otp", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { newPhone } = req.body;
      const normalizedPhone = normalizePhone(newPhone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
      const existing = await storage.getAuthUserByPhone(normalizedPhone);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u062F\u0649 \u062D\u0633\u0627\u0628 \u0622\u062E\u0631" });
      }
      const sendCheck = await storage.canSendOtp(`phone_change_${userId}_${normalizedPhone}`);
      if (!sendCheck.ok) {
        return res.status(429).json({
          message: `\u0627\u0646\u062A\u0638\u0631 ${sendCheck.retryAfterSec} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F`,
          retryAfterSec: sendCheck.retryAfterSec
        });
      }
      const otp = generateOtp();
      await storage.storeOtp(`phone_change_${userId}_${normalizedPhone}`, otp);
      console.log(`[PHONE OTP] user=${userId} newPhone=${normalizedPhone} otp=${otp}`);
      return res.json({ message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642" });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.patch("/api/user/phone", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { newPhone, otp } = req.body;
      if (!newPhone || !otp) {
        return res.status(400).json({ message: "\u0627\u0644\u0631\u0642\u0645 \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
      }
      const normalizedPhone = normalizePhone(newPhone);
      const check = await storage.verifyOtp(`phone_change_${userId}_${normalizedPhone}`, otp.trim());
      if (!check.ok) {
        return res.status(400).json({
          message: otpErrorMessage(check.reason),
          retryAfterSec: check.retryAfterSec
        });
      }
      const existing = await storage.getAuthUserByPhone(normalizedPhone);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u062F\u0649 \u062D\u0633\u0627\u0628 \u0622\u062E\u0631" });
      }
      await storage.updateAuthUser(userId, { phone: normalizedPhone });
      const user = await storage.getAuthUserById(userId);
      console.log(`[PHONE UPDATE] user=${userId} newPhone=${normalizedPhone}`);
      return res.json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0628\u0646\u062C\u0627\u062D", user: safeUser(user) });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/support/message", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { subject, message } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ message: "\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
      }
      const msg = await storage.createSupportMessage({
        userId,
        subject: subject.trim(),
        message: message.trim()
      });
      console.log(`[SUPPORT] #${msg.id} from ${userId}: "${subject}"`);
      return res.json({ message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u062A\u0643\u060C \u0633\u0646\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0642\u0631\u064A\u0628\u0627\u064B", id: msg.id });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/support/messages", authMiddleware, async (req, res) => {
    try {
      const role = req.userRole;
      if (role !== "supervisor") {
        return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
      }
      const messages = await storage.getSupportMessages();
      return res.json({ messages });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/notifications/register-token", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { expoPublicToken } = req.body;
      if (!expoPublicToken || typeof expoPublicToken !== "string") {
        return res.status(400).json({ message: "\u0627\u0644\u062A\u0648\u0643\u0646 \u0645\u0637\u0644\u0648\u0628" });
      }
      if (!expoPublicToken.startsWith("ExponentPushToken[") && !expoPublicToken.startsWith("ExpoPushToken[")) {
        return res.status(400).json({ message: "\u0635\u064A\u063A\u0629 \u0627\u0644\u062A\u0648\u0643\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      await storage.updateAuthUser(userId, { expoPublicToken });
      console.log(`[PUSH] Token registered for user ${userId}`);
      return res.json({ message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u062A\u0648\u0643\u0646" });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/admin/send-notification", authMiddleware, async (req, res) => {
    try {
      const role = req.userRole;
      if (role !== "supervisor" && role !== "owner") {
        return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
      }
      const { title, body, target, image } = req.body;
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
      }
      const allUsers = await storage.getAllAuthUsers();
      let targets = allUsers;
      if (target === "players") targets = allUsers.filter((u) => u.role === "player");
      else if (target === "owners") targets = allUsers.filter((u) => u.role === "owner");
      const tokens = targets.map((u) => u.expoPublicToken).filter((t) => !!t);
      await sendPushNotifications(tokens, title.trim(), body.trim(), void 0, image);
      console.log(`[PUSH] Admin broadcast to ${tokens.length} users`);
      return res.json({ message: `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u0625\u0644\u0649 ${tokens.length} \u0645\u0633\u062A\u062E\u062F\u0645`, count: tokens.length });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/auth/supervisor-token", async (req, res) => {
    try {
      const { masterKey, expiryMinutes = 120 } = req.body;
      if (masterKey !== getSupervisorMasterKey()) {
        return res.status(403).json({ message: "\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0648\u0635\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
      const clampedExpiry = Math.min(Math.max(expiryMinutes, 10), 480);
      const token = signToken("supervisor", "supervisor", `${clampedExpiry}m`);
      const expiresAt = new Date(Date.now() + clampedExpiry * 60 * 1e3).toISOString();
      console.log(`[SUPERVISOR] Token created, expires at ${expiresAt}`);
      return res.json({
        token,
        role: "supervisor",
        expiresAt,
        expiryMinutes: clampedExpiry,
        message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632 \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u0624\u0642\u062A",
        permissions: ["view:bookings", "view:venues", "view:revenue", "view:support"]
      });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  const VENUE_COLORS2 = ["#1A2F1A", "#1A1A2F", "#2F1A1A", "#2F2A1A", "#1A2A2F"];
  function getVenueColor2(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    return VENUE_COLORS2[Math.abs(hash) % VENUE_COLORS2.length];
  }
  function ownerToVenue(owner) {
    const amenities = [];
    if (owner.hasBathrooms) amenities.push("\u062F\u0648\u0631\u0627\u062A \u0645\u064A\u0627\u0647");
    if (owner.hasMarket) amenities.push("\u0645\u0637\u0639\u0645/\u0643\u0627\u0641\u064A\u062A\u064A\u0631\u064A\u0627");
    const price = parseInt(String(owner.bookingPrice ?? "").replace(/[^\d]/g, ""), 10) || 0;
    return {
      id: owner.id,
      name: owner.venueName ?? "\u0645\u0644\u0639\u0628",
      location: owner.areaName ? `${owner.areaName}\u060C \u0627\u0644\u0645\u0648\u0635\u0644` : "\u0627\u0644\u0645\u0648\u0635\u0644",
      district: owner.areaName ?? "\u0627\u0644\u0645\u0648\u0635\u0644",
      rating: 0,
      reviewCount: 0,
      pricePerHour: price,
      fieldSizes: owner.fieldSize ? [owner.fieldSize] : ["5 \u0636\u062F 5"],
      amenities,
      imageColor: getVenueColor2(owner.id),
      isOpen: true,
      openHours: "08:00 - 24:00",
      lat: parseFloat(owner.latitude ?? "36.335") || 36.335,
      lon: parseFloat(owner.longitude ?? "43.119") || 43.119
    };
  }
  async function listVenuesMerged() {
    const owners = await storage.getAllOwners();
    const fromOwners = owners.map(ownerToVenue);
    if (!isFirebaseEnvConfigured()) {
      return fromOwners;
    }
    let fromFs = [];
    try {
      fromFs = await fetchVenuesFromFirestore();
    } catch (e) {
      console.error("[GET /api/venues] Firestore read failed (rules/network?) \u2014 returning owners only:", e);
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
  app2.get("/api/venues", async (_req, res) => {
    try {
      const venues = await listVenuesMerged();
      return res.json({ venues });
    } catch (e) {
      console.error("[GET /api/venues]", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/venues", async (req, res) => {
    try {
      if (!isFirebaseEnvConfigured()) {
        return res.status(503).json({ message: "Firebase \u063A\u064A\u0631 \u0645\u064F\u0636\u0628\u0637 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645" });
      }
      const rawName = String(req.body?.name ?? "").trim();
      const rawLocation = String(req.body?.location ?? "").trim();
      const rawPrice = Number(req.body?.price ?? req.body?.pricePerHour ?? 0);
      if (!rawName || !rawLocation || !Number.isFinite(rawPrice) || rawPrice <= 0) {
        return res.status(400).json({ message: "Missing or invalid venue data" });
      }
      ensureFirebaseAdminApp();
      const db = admin5.firestore();
      const docRef = db.collection("fields").doc();
      const payload = {
        name: rawName,
        location: rawLocation,
        district: rawLocation,
        pricePerHour: Math.round(rawPrice),
        fieldSizes: ["5 \u0636\u062F 5"],
        amenities: [],
        imageColor: getVenueColor2(docRef.id),
        isOpen: true,
        openHours: "08:00 \u2013 24:00",
        lat: 36.335,
        lon: 43.119,
        rating: 0,
        reviewCount: 0,
        createdAt: admin5.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin5.firestore.FieldValue.serverTimestamp()
      };
      await docRef.set(payload);
      return res.status(201).json({
        id: docRef.id,
        ...payload,
        createdAt: void 0,
        updatedAt: void 0
      });
    } catch (e) {
      console.error("[POST /api/venues]", e);
      return res.status(500).json({ message: "Server error" });
    }
  });
  app2.get("/api/venues/:id", async (req, res) => {
    try {
      if (isFirebaseEnvConfigured()) {
        const fromFs = await getVenueByIdFromFirestore(req.params.id);
        if (fromFs) return res.json(fromFs);
      }
      const owner = await storage.getAuthUserById(req.params.id);
      if (!owner || owner.role !== "owner" || !owner.venueName) {
        return res.status(404).json({ message: "\u0627\u0644\u0645\u0644\u0639\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      }
      return res.json(ownerToVenue(owner));
    } catch (e) {
      console.error("[GET /api/venues/:id]", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/venues/:id/bookings", async (req, res) => {
    try {
      const { id } = req.params;
      const date = String(req.query.date ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "\u0627\u0633\u062A\u062E\u062F\u0645 ?date=YYYY-MM-DD" });
      }
      const resolved = await resolveOwnerForVenueBooking(id);
      if (!resolved) return res.json({ bookings: [] });
      const all = await storage.getOwnerBookings(resolved.ownerId);
      const day = all.filter((b) => b.date === date && b.status !== "cancelled");
      return res.json({
        bookings: day.map((b) => ({ time: b.time, duration: b.duration, status: b.status }))
      });
    } catch (e) {
      console.error("[GET /api/venues/:id/bookings]", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/bookings", async (req, res) => {
    try {
      const body = req.body;
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
        return res.status(400).json({ message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u0646\u0627\u0642\u0635\u0629" });
      }
      if (!Number.isFinite(totalPrice) || totalPrice < 0) {
        return res.status(400).json({ message: "\u0627\u0644\u0633\u0639\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" });
      }
      const resolved = await resolveOwnerForVenueBooking(venueId);
      if (!resolved) {
        return res.status(404).json({ message: "\u0627\u0644\u0645\u0644\u0639\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      }
      const normalizedTime = time.includes(":") ? time : `${String(time).padStart(2, "0")}:00`;
      const hourlyPrice = duration > 0 ? Math.round(totalPrice / duration * 100) / 100 : totalPrice;
      const todayBaghdad = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Baghdad",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(/* @__PURE__ */ new Date());
      const bh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) * 60 + parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
      const [th, tm] = normalizedTime.split(":").map((x) => parseInt(x, 10));
      const startMin = (Number.isFinite(th) ? th : 0) * 60 + (Number.isFinite(tm) ? tm : 0);
      if (date < todayBaghdad || date === todayBaghdad && startMin < bh) {
        return res.status(400).json({ message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u062C\u0632 \u0648\u0642\u062A \u0642\u062F \u0645\u0631\u0651 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645" });
      }
      const allBookings = await storage.getOwnerBookings(resolved.ownerId);
      const dayBookings = allBookings.filter((b) => b.date === date && b.status !== "cancelled");
      const conflict = dayBookings.find(
        (b) => bookingsOverlapMinutes(normalizedTime, duration, b.time, b.duration)
      );
      if (conflict) {
        return res.status(409).json({
          message: `\u0627\u0644\u0648\u0642\u062A \u0645\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u062D\u062C\u0632 \u0622\u062E\u0631 (${conflict.time})`
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
        venueNameSnapshot: venueName || null
      });
      const ownerUser = await storage.getAuthUserById(resolved.ownerId);
      if (ownerUser?.expoPublicToken) {
        sendPushToUser(
          ownerUser.expoPublicToken,
          "\u062D\u062C\u0632 \u062C\u062F\u064A\u062F \u0645\u0646 \u0627\u0644\u062A\u0637\u0628\u064A\u0642",
          `${playerName} \u2014 ${date} ${normalizedTime}`,
          { bookingId: booking.id }
        ).catch(() => {
        });
      }
      return res.status(201).json({ booking: { id: booking.id } });
    } catch (e) {
      console.error("[POST /api/bookings]", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/bookings/player", async (req, res) => {
    try {
      const playerUserId = String(req.query.playerUserId ?? "").trim() || null;
      const phone = String(req.query.phone ?? "").trim() || null;
      if (!playerUserId && !phone) {
        return res.status(400).json({ message: "playerUserId \u0623\u0648 phone \u0645\u0637\u0644\u0648\u0628" });
      }
      const list = await storage.getBookingsForPlayer(playerUserId, phone);
      return res.json({ bookings: list });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.patch("/api/bookings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const status = String(body?.status ?? "");
      if (status !== "cancelled") {
        return res.status(400).json({ message: "\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629" });
      }
      const playerUserId = String(req.query.playerUserId ?? "").trim() || null;
      const phone = String(req.query.phone ?? "").trim() || null;
      if (!playerUserId && !phone) {
        return res.status(400).json({ message: "playerUserId \u0623\u0648 phone \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u062A\u062D\u0642\u0642" });
      }
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      const byUid = Boolean(playerUserId && booking.playerUserId && booking.playerUserId === playerUserId);
      const byPhone = Boolean(phone && booking.playerPhone) && normalizePhone(booking.playerPhone) === normalizePhone(phone);
      if (!byUid && !byPhone) {
        return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
      }
      const w = body.cancelledWhileUiStatus;
      const cancelledWhileUiStatus = w === "upcoming" || w === "active" || w === "completed" ? w : void 0;
      await storage.cancelOwnerBooking(id, {
        cancelledWhileUiStatus,
        cancellationSnapshot: body.cancellationSnapshot
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[PATCH /api/bookings/:id]", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/owner/venue", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getAuthUserById(userId);
      if (!user) return res.status(404).json({ message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return res.json(safeOwnerUser(user));
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.patch("/api/owner/venue", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const { venueName, areaName, fieldSize, bookingPrice, hasBathrooms, hasMarket } = req.body;
      if (venueName) {
        const existing = await storage.getAuthUserByVenueName(venueName);
        if (existing && existing.id !== userId) {
          return res.status(409).json({ message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0639\u0628 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B" });
        }
      }
      const updates = {};
      if (venueName !== void 0) updates.venueName = venueName;
      if (areaName !== void 0) updates.areaName = areaName;
      if (fieldSize !== void 0) updates.fieldSize = fieldSize;
      if (bookingPrice !== void 0) updates.bookingPrice = bookingPrice;
      if (hasBathrooms !== void 0) updates.hasBathrooms = hasBathrooms;
      if (hasMarket !== void 0) updates.hasMarket = hasMarket;
      await storage.updateAuthUser(userId, updates);
      const user = await storage.getAuthUserById(userId);
      return res.json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0644\u0639\u0628", venue: safeOwnerUser(user) });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/owner/bookings", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const { filter } = req.query;
      const now = /* @__PURE__ */ new Date();
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
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.post("/api/owner/bookings", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getAuthUserById(userId);
      const { playerName, playerPhone, date, time, duration, price, source = "manual" } = req.body;
      if (!playerName?.trim() || !date || !time || !duration || price === void 0) {
        return res.status(400).json({ message: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629" });
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
          message: `\u064A\u0648\u062C\u062F \u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u062D\u062C\u0632 ${conflict.playerName} \u0627\u0644\u0633\u0627\u0639\u0629 ${conflict.time}`
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
        fieldSize: user?.fieldSize ?? "5\xD75",
        status: "upcoming",
        source
      });
      console.log(`[BOOKING] New booking by owner ${userId}: ${playerName} on ${date} at ${time}`);
      if (playerPhone) {
        const player = await storage.getAuthUserByPhone(playerPhone.replace(/\D/g, "").slice(-10).padStart(10, "0")).catch(() => null) ?? await storage.getAuthUserByPhone(playerPhone.trim()).catch(() => null);
        if (player?.expoPublicToken) {
          sendPushToUser(
            player.expoPublicToken,
            "\u062D\u062C\u0632 \u062C\u062F\u064A\u062F \u26BD",
            `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u062D\u062C\u0632\u0643 \u0627\u0644\u0633\u0627\u0639\u0629 ${time} \u0628\u062A\u0627\u0631\u064A\u062E ${date} \u0641\u064A ${user?.venueName ?? "\u0627\u0644\u0645\u0644\u0639\u0628"}`,
            { bookingId: booking.id }
          ).catch(() => {
          });
        }
      }
      return res.status(201).json({ message: "\u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062D\u062C\u0632 \u0628\u0646\u062C\u0627\u062D", booking });
    } catch (e) {
      console.error("Create booking error:", e);
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.patch("/api/owner/bookings/:id", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (booking.ownerId !== userId) return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
      const { playerName, playerPhone, date, time, duration, price, status } = req.body;
      const updates = {};
      if (playerName !== void 0) updates.playerName = playerName;
      if (playerPhone !== void 0) updates.playerPhone = playerPhone;
      if (date !== void 0) updates.date = date;
      if (time !== void 0) updates.time = time;
      if (duration !== void 0) updates.duration = Number(duration);
      if (price !== void 0) updates.price = Number(price);
      if (status !== void 0) updates.status = status;
      const updated = await storage.updateOwnerBooking(id, updates);
      return res.json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062D\u062C\u0632", booking: updated });
    } catch (e) {
      return res.status(500).json({ message: e?.message ?? "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.delete("/api/owner/bookings/:id", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const booking = await storage.getOwnerBookingById(id);
      if (!booking) return res.status(404).json({ message: "\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      if (booking.ownerId !== userId) return res.status(403).json({ message: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
      await storage.cancelOwnerBooking(id);
      if (booking.playerPhone) {
        const player = await storage.getAuthUserByPhone(booking.playerPhone.trim()).catch(() => null);
        if (player?.expoPublicToken) {
          sendPushToUser(
            player.expoPublicToken,
            "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632",
            `\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632\u0643 \u0627\u0644\u0633\u0627\u0639\u0629 ${booking.time} \u0628\u062A\u0627\u0631\u064A\u062E ${booking.date}`,
            { bookingId: booking.id }
          ).catch(() => {
          });
        }
      }
      return res.json({ message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062D\u062C\u0632" });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/owner/stats", authMiddleware, ownerGuard, async (req, res) => {
    try {
      const userId = req.userId;
      const allBookings = await storage.getOwnerBookings(userId);
      const nonCancelled = allBookings.filter((b) => b.status !== "cancelled");
      const now = /* @__PURE__ */ new Date();
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
      const occupancyRate = totalAvailableHours > 0 ? Math.round(bookedHours / totalAvailableHours * 100) : 0;
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const count = nonCancelled.filter((b) => b.date === dateStr).length;
        const revenue = nonCancelled.filter((b) => b.date === dateStr).reduce((sum, b) => sum + b.price * b.duration, 0);
        last7Days.push({ date: dateStr, count, revenue });
      }
      const hourCounts = {};
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
        count: hourCounts[i + 8] || 0
      }));
      return res.json({
        totalBookings: nonCancelled.length,
        appBookings: appBookings.length,
        totalRevenue,
        todayBookings: todayBookings.length,
        todayRevenue,
        occupancyRate,
        last7Days,
        peakHours
      });
    } catch {
      return res.status(500).json({ message: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = /* @__PURE__ */ new Date();
      const todayStr = now.toISOString().split("T")[0];
      const owners = await storage.getAllOwners();
      for (const owner of owners) {
        const bookings = await storage.getOwnerBookings(owner.id);
        const upcoming = bookings.filter(
          (b) => b.status === "upcoming" && b.date === todayStr && !b.reminderSent
        );
        for (const booking of upcoming) {
          const [bHour, bMin] = booking.time.split(":").map(Number);
          const bookingTime = new Date(now);
          bookingTime.setHours(bHour, bMin ?? 0, 0, 0);
          const diffMs = bookingTime.getTime() - now.getTime();
          const diffMin = diffMs / 6e4;
          if (diffMin > 0 && diffMin <= 60) {
            const tokens = [];
            if (owner.expoPublicToken) tokens.push(owner.expoPublicToken);
            if (booking.playerPhone) {
              const player = await storage.getAuthUserByPhone(booking.playerPhone.trim()).catch(() => null);
              if (player?.expoPublicToken) tokens.push(player.expoPublicToken);
            }
            if (tokens.length > 0) {
              await sendPushNotifications(
                tokens,
                "\u0645\u0628\u0627\u0631\u062A\u0643 \u0628\u0639\u062F \u0633\u0627\u0639\u0629 \u26BD",
                `\u0627\u0633\u062A\u0639\u062F \u0644\u0645\u0628\u0627\u0631\u0627\u062A\u0643 \u0641\u064A ${owner.venueName ?? "\u0627\u0644\u0645\u0644\u0639\u0628"} \u0627\u0644\u0633\u0627\u0639\u0629 ${booking.time}`,
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
  registerPitchRatingsRoute(app2);
  registerPromoRoutes(app2, getJwtSecret());
  registerWaylRoutes(app2);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs4 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    hidePoweredBy: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);
function resolveCorsOrigin() {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) {
    console.warn(
      "[security] ALLOWED_ORIGINS \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u0641\u064A \u0627\u0644\u0625\u0646\u062A\u0627\u062C \u2014 \u064A\u064F\u0633\u0645\u062D \u0628\u0623\u064A Origin (\u0639\u064A\u0651\u0646 \u0642\u0627\u0626\u0645\u0629 \u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0641\u0648\u0627\u0635\u0644 \u0644\u0627\u062D\u0642\u0627\u064B)."
    );
    return true;
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "shootha-api" });
});
app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "512kb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "256kb" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      const sensitive = path3.includes("/auth/") || path3.includes("/otp/") || path3.includes("custom-token") || path3.includes("bridge-ticket") || path3.includes("/wallet") || path3.includes("/promo") || path3.includes("/payments") || path3.includes("webhook");
      if (capturedJsonResponse && !sensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(ENV_PROJECT_ROOT, "app.json");
    const appJsonContent = fs4.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    ENV_PROJECT_ROOT,
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs4.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs4.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    ENV_PROJECT_ROOT,
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs4.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(ENV_PROJECT_ROOT, "assets")));
  app2.use(express.static(path2.resolve(ENV_PROJECT_ROOT, "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
function isPortFree(port) {
  return new Promise((resolve2) => {
    const s = net.createServer();
    s.once("error", () => resolve2(false));
    s.listen(port, "0.0.0.0", () => {
      s.close(() => resolve2(true));
    });
  });
}
async function findFirstFreePort(startPort, maxAttempts = 15) {
  for (let p = startPort; p < startPort + maxAttempts; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port in range ${startPort}-${startPort + maxAttempts - 1}`);
}
(async () => {
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const preferredPort = parseInt(process.env.PORT || "4001", 10);
  const port = process.env.PORT ? preferredPort : await findFirstFreePort(preferredPort);
  if (!process.env.PORT && port !== preferredPort) {
    log(`Port ${preferredPort} busy \u2014 using ${port}. Set EXPO_PUBLIC_API_URL=http://localhost:${port}`);
  }
  server.listen(port, "0.0.0.0", () => {
    log(`Server running on http://localhost:${port}`);
    log(`API: http://localhost:${port}/api/venues`);
  });
})();
