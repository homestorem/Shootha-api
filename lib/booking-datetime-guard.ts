/**
 * رفض حجز وقت بداية قد مضى في نفس يوم التقويم المحلي للجهاز.
 */

export function formatLocalDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function bookingWallClockToMinutes(t: string): number {
  const parts = String(t ?? "").trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const rawM = parts[1] ?? "0";
  const m = parseInt(String(rawM).replace(/\D/g, "") || "0", 10) || 0;
  return h * 60 + m;
}

function localNowTotalMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** هل وقت البداية (ساعة:دقيقة) قد مضى بالنسبة لـ `dateStr`؟ يُقارن بتاريخ الجهاز المحلي فقط. */
export function isBookingWallStartInPastForLocalCalendarDate(
  dateStr: string,
  startTime: string,
  now = new Date(),
): boolean {
  const today = formatLocalDateKey(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  return bookingWallClockToMinutes(startTime) < localNowTotalMinutes(now);
}

export function assertBookingStartNotInPastLocal(dateStr: string, startTime: string, now = new Date()): void {
  if (isBookingWallStartInPastForLocalCalendarDate(dateStr, startTime, now)) {
    throw new Error("انتهى وقت الحجز المختار. عدْ لصفحة الملعب واختر وقتاً قادماً.");
  }
}
