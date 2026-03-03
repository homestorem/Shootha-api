import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const authUsers = pgTable("auth_users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("player"),
  deviceId: text("device_id"),
  noShowCount: text("no_show_count").notNull().default("0"),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
  passwordHash: text("password_hash"),
  dateOfBirth: text("date_of_birth"),
  profileImage: text("profile_image"),
  venueName: text("venue_name"),
  areaName: text("area_name"),
  fieldSize: text("field_size"),
  bookingPrice: text("booking_price"),
  hasBathrooms: boolean("has_bathrooms"),
  hasMarket: boolean("has_market"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  venueImages: text("venue_images"),
  ownerDeviceLat: text("owner_device_lat"),
  ownerDeviceLon: text("owner_device_lon"),
  expoPublicToken: text("expo_public_token"),
  gender: text("gender"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAuthUserSchema = createInsertSchema(authUsers).pick({
  phone: true,
  name: true,
  role: true,
  deviceId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
