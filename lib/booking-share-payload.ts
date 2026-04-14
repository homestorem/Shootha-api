import type { RandomMatchItem } from "@/context/RandomMatchContext";
import { decodeMatchFromInviteQuery } from "@/lib/random-match-invite";

/** نسخة حمولة رابط مشاركة الحجز — تتضمن بيانات الحجز + اختيارياً المباراة العشوائية */
export type BookingShareEnvelopeV2 = {
  v: 2;
  bookingId: string;
  venueId: string;
  venueName: string;
  fieldSize: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  match?: RandomMatchItem;
};

export type ParsedBookingShareParam =
  | { kind: "v2"; envelope: BookingShareEnvelopeV2 }
  | { kind: "legacy_match"; match: RandomMatchItem };

function isEnvelopeV2(x: unknown): x is BookingShareEnvelopeV2 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 2) return false;
  const id = String(o.bookingId ?? "").trim();
  const venueId = String(o.venueId ?? "").trim();
  const venueName = String(o.venueName ?? "").trim();
  const date = String(o.date ?? "").trim();
  const time = String(o.time ?? "").trim();
  const duration = Number(o.duration);
  const price = Number(o.price);
  if (!id || !venueId || !venueName || !date || !time) return false;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (!Number.isFinite(price) || price < 0) return false;
  return true;
}

/**
 * يفكّ معامل ?p= من رابط المشاركة.
 * يدعم v:2 (حجز + مباراة) والنسخة القديمة (RandomMatchItem فقط).
 */
export function parseBookingShareParam(p: string): ParsedBookingShareParam | null {
  let raw = String(p ?? "").trim();
  if (!raw) return null;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* */
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (isEnvelopeV2(data)) {
    const o = data as BookingShareEnvelopeV2;
    let match: RandomMatchItem | undefined;
    const matchRaw = o.match;
    if (matchRaw && typeof matchRaw === "object" && matchRaw.id && matchRaw.venueName) {
      match = matchRaw as RandomMatchItem;
    }
    return {
      kind: "v2",
      envelope: {
        v: 2,
        bookingId: String(o.bookingId).trim(),
        venueId: String(o.venueId).trim(),
        venueName: String(o.venueName).trim(),
        fieldSize: String(o.fieldSize ?? "").trim() || "—",
        date: String(o.date).trim(),
        time: String(o.time).trim(),
        duration: Number(o.duration),
        price: Number(o.price),
        ...(match ? { match } : {}),
      },
    };
  }
  try {
    const match = decodeMatchFromInviteQuery(raw);
    return { kind: "legacy_match", match };
  } catch {
    return null;
  }
}
