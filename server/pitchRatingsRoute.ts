import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as admin from "firebase-admin";
import { ensureFirebaseAdminApp } from "./walletFirestore.ts";

const RATINGS_COLLECTION = "التقييمات";
const LEADERBOARD_STATS = "leaderboardPlayerStats";

const BAGHDAD_UTC_OFFSET_H = 3;

function wallBaghdadStartUtcMs(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  const [th, tm] = time.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  const hh = Number.isFinite(th) ? th : 0;
  const mm = Number.isFinite(tm) ? tm : 0;
  return Date.UTC(y, mo - 1, d, hh - BAGHDAD_UTC_OFFSET_H, mm, 0, 0);
}

/** يطابق العميل: التقييم مسموح بعد دقيقة من نهاية الحجز (مثال 17:00 → من 17:01). */
const POST_MATCH_RATING_GRACE_MS = 60 * 1000;

function sessionReadyForPostMatchRatingBaghdad(
  date: string,
  startTime: string,
  durationH: number,
  nowMs: number,
): boolean {
  const dur = Number(durationH);
  if (!Number.isFinite(dur) || dur <= 0) return false;
  const startMs = wallBaghdadStartUtcMs(date, startTime);
  if (!Number.isFinite(startMs)) return false;
  const endMs = startMs + Math.max(0.25, dur) * 60 * 60 * 1000;
  return nowMs >= endMs + POST_MATCH_RATING_GRACE_MS;
}

function playerStatDocId(name: string): string {
  const raw = name.trim().replace(/\s+/g, " ").normalize("NFC").slice(0, 200);
  const h = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
  return `p_${h}`;
}

function computePlayerPoints(stars: number, goals: number): number {
  const s = Math.min(5, Math.max(1, Math.round(stars)));
  const g = Math.min(99, Math.max(0, Math.round(goals)));
  return s * 15 + g * 5;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function verifyCallerOwnsRater(req: Request, raterUserId: string): Promise<boolean> {
  const h = String(req.headers.authorization ?? "");
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) return false;
  try {
    const dec = await admin.auth().verifyIdToken(m[1]);
    if (dec.uid === raterUserId) return true;
    const e164 = String((dec as { e164?: string }).e164 ?? "").trim();
    if (e164 && e164 === raterUserId) return true;
    const playerId = String((dec as { playerId?: string }).playerId ?? "").trim();
    if (playerId && playerId === raterUserId) return true;
    return false;
  } catch {
    return false;
  }
}

type PlayerIn = { name?: string; stars?: number; goals?: number };

export function registerPitchRatingsRoute(app: Express): void {
  app.post("/api/pitch-ratings", async (req: Request, res: Response) => {
    try {
      ensureFirebaseAdminApp();
    } catch {
      return res.status(503).json({ message: "خادم التقييم غير مهيأ (Firebase Admin)" });
    }

    const body = req.body as Record<string, unknown>;
    const bookingId = String(body.bookingId ?? "").trim();
    const raterUserId = String(body.raterUserId ?? "").trim();
    const venueId = String(body.venueId ?? "").trim();
    const venueName = String(body.venueName ?? "").trim().slice(0, 200);
    const venueStars = Number(body.venueStars);
    const venueFeedback = String(body.venueFeedback ?? "").trim().slice(0, 2000);
    const playersRaw = Array.isArray(body.players) ? (body.players as PlayerIn[]) : [];

    if (!bookingId || !raterUserId || !venueId) {
      return res.status(400).json({ message: "بيانات ناقصة (الحجز أو المستخدم أو الملعب)" });
    }
    const authOk = await verifyCallerOwnsRater(req, raterUserId);
    if (!authOk) {
      return res.status(401).json({ message: "يجب تسجيل الدخول أو أن الحساب لا يطابق المقيّم" });
    }
    if (!Number.isFinite(venueStars) || venueStars < 1 || venueStars > 5) {
      return res.status(400).json({ message: "تقييم الملعب يجب أن يكون بين 1 و 5" });
    }

    const players: { name: string; stars: number; goals: number }[] = [];
    for (const p of playersRaw.slice(0, 24)) {
      const name = String(p.name ?? "").trim();
      if (!name) continue;
      const stars = Number(p.stars);
      const goals = Number(p.goals ?? 0);
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
        return res.status(400).json({ message: `تقييم غير صالح للاعب: ${name.slice(0, 40)}` });
      }
      if (!Number.isFinite(goals) || goals < 0 || goals > 99) {
        return res.status(400).json({ message: `عدد الأهداف غير صالح للاعب: ${name.slice(0, 40)}` });
      }
      players.push({ name: name.slice(0, 80), stars: Math.round(stars), goals: Math.round(goals) });
    }

    const db = admin.firestore();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const ratingRef = db.collection(RATINGS_COLLECTION).doc(bookingId);
    const fieldRef = db.collection("fields").doc(venueId);

    try {
      await db.runTransaction(async (tx) => {
        const [bSnap, rSnap, fSnap] = await Promise.all([
          tx.get(bookingRef),
          tx.get(ratingRef),
          tx.get(fieldRef),
        ]);

        if (!bSnap.exists) {
          throw Object.assign(new Error("BOOKING_NOT_FOUND"), { code: 404 });
        }
        if (rSnap.exists) {
          throw Object.assign(new Error("ALREADY_RATED"), { code: 409 });
        }

        const b = bSnap.data()!;
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
        const startTime = String(b.startTime ?? "").includes(":")
          ? String(b.startTime)
          : `${String(b.startTime ?? "0").padStart(2, "0")}:00`;
        const duration = Number(b.duration);
        if (!sessionReadyForPostMatchRatingBaghdad(date, startTime, duration, Date.now())) {
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
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const prevC = fSnap.exists ? Number(fSnap.data()?.reviewCount ?? 0) : 0;
        const prevR = fSnap.exists ? Number(fSnap.data()?.rating ?? 0) : 0;
        const newC = prevC + 1;
        const newR = newC === 1 ? venueStars : (prevR * prevC + venueStars) / newC;
        tx.set(
          fieldRef,
          {
            rating: round2(newR),
            reviewCount: newC,
          },
          { merge: true },
        );

        for (const p of players) {
          const pid = playerStatDocId(p.name);
          const pref = db.collection(LEADERBOARD_STATS).doc(pid);
          const pts = computePlayerPoints(p.stars, p.goals);
          tx.set(
            pref,
            {
              displayName: p.name,
              totalPoints: admin.firestore.FieldValue.increment(pts),
              matchesRated: admin.firestore.FieldValue.increment(1),
              totalGoals: admin.firestore.FieldValue.increment(p.goals),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        tx.set(
          bookingRef,
          {
            postMatchRatingAt: admin.firestore.FieldValue.serverTimestamp(),
            postMatchRatingVenueStars: Math.round(venueStars),
          },
          { merge: true },
        );
      });

      return res.json({ ok: true });
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code === 404) return res.status(404).json({ message: "الحجز غير موجود" });
      if (err.code === 409) return res.status(409).json({ message: "تم إرسال تقييم هذا الحجز مسبقاً" });
      if (err.code === 403) return res.status(403).json({ message: "غير مصرح بتقييم هذا الحجز" });
      if (err.code === 400) {
        if (err.message === "VENUE_MISMATCH") {
          return res.status(400).json({ message: "معرّف الملعب لا يطابق الحجز" });
        }
        if (err.message === "CANCELLED") {
          return res.status(400).json({ message: "لا يمكن تقييم حجز ملغى" });
        }
        if (err.message === "SESSION_NOT_ENDED") {
          return res.status(400).json({ message: "لم ينتهِ وقت الحجز بعد" });
        }
      }
      console.error("[pitch-ratings]", e);
      return res.status(500).json({ message: "تعذر حفظ التقييم" });
    }
  });
}
