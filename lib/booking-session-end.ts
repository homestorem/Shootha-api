import type { Booking } from "@/context/BookingsContext";

/** مواعيد الحجز تُفسَّر كتوقيت محلي لبغداد (يتوافق مع تحقق الخادم). */
const BAGHDAD_UTC_OFFSET_H = 3;

export function bookingSessionEndUtcMs(b: Booking): number {
  const dur = Number(b.duration);
  if (!Number.isFinite(dur) || dur <= 0) return NaN;
  const startMs = wallBaghdadStartUtcMs(b.date, b.time);
  if (!Number.isFinite(startMs)) return NaN;
  return startMs + Math.max(0.25, dur) * 60 * 60 * 1000;
}

function wallBaghdadStartUtcMs(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  const [th, tm] = time.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  const hh = Number.isFinite(th) ? th : 0;
  const mm = Number.isFinite(tm) ? tm : 0;
  return Date.UTC(y, mo - 1, d, hh - BAGHDAD_UTC_OFFSET_H, mm, 0, 0);
}

/** نهاية فترة الحجز (بعد انتهاء المدة) — جدار بغداد */
export function isBookingSessionEnded(b: Booking, nowMs = Date.now()): boolean {
  if (b.status === "cancelled") return false;
  const end = bookingSessionEndUtcMs(b);
  return Number.isFinite(end) && nowMs >= end;
}
