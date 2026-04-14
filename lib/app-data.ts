import type { QueryClient } from "@tanstack/react-query";
import type { Booking, Venue } from "@/context/BookingsContext";
import { normalizeVenue, normalizeVenues } from "@/lib/venue-normalize";
import { getExperimentalVenueById } from "@/constants/experimentalVenues";
import { DEMO_ADS_WHEN_EMPTY, type BannerAd } from "@/constants/fallbackBannerAds";
import {
  normalizeBannerImageUrl,
  pickPreferredBannerImageUrl,
  sanitizeBannerLinkUrl,
} from "@/lib/banner-ad-utils";
import {
  fetchVenueBookingsForDayFromFirestore,
  isFirebaseBookingsEnabled,
} from "@/lib/firestore-bookings";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** عنوان Express — على الجهاز يُستبدل localhost بـ IP من Expo أو EXPO_PUBLIC_DEV_LAN_HOST */
function apiBase(): string {
  return getResolvedApiBaseUrl();
}

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** إعلانات الشريط من Firestore: مجموعة `ads` فقط. */
export async function fetchBannerAds(): Promise<BannerAd[]> {
  try {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, "ads"));
    type RawAdDoc = { id: string } & Record<string, unknown>;
    const rawAds: RawAdDoc[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    }));

    console.log("[Ads] Firestore fetch OK — raw count:", rawAds.length, rawAds);

    const mappedAds = rawAds
      .filter((ad) => ad.isActive === true)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((item) => {
        const id = String(item.id ?? "").trim();
        const picked = pickPreferredBannerImageUrl(
          typeof item.image === "string" ? item.image : null,
          typeof item.imageUri === "string" ? item.imageUri : null,
        );
        const image = normalizeBannerImageUrl(picked) ?? "";
        const title = String(item.title ?? "").trim();
        const subtitle = String(item.subtitle ?? "").trim();
        const linkUrl =
          sanitizeBannerLinkUrl(item.linkUrl) ?? sanitizeBannerLinkUrl(item.link);

        const ad: BannerAd = {
          id: id || "ad-unknown",
          image,
          title: title || "عرض مميز",
          subtitle: subtitle || "اضغط للمزيد",
          ...(linkUrl ? { linkUrl } : {}),
        };
        return ad;
      })
      .filter((ad) => Boolean(ad.image));

    console.log("[Ads] active + sorted mapped count:", mappedAds.length, mappedAds);

    if (mappedAds.length === 0) {
      console.log("[Ads] empty from Firestore — using DEMO_ADS_WHEN_EMPTY");
      return DEMO_ADS_WHEN_EMPTY;
    }
    return mappedAds;
  } catch (error) {
    console.error("[Ads] fetch failed (returning empty, no demo):", error);
    return [];
  }
}

/**
 * قائمة الملاعب من قاعدة البيانات عبر الخادم — `GET /api/venues`
 * (مالكو الملاعب `role=owner` ولديهم `venue_name` في `auth_users`).
 */
export async function fetchVenues(): Promise<Venue[]> {
  const base = apiBase();
  if (base) {
    try {
      const res = await fetch(`${base}/api/venues`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { venues?: unknown[] };
        return normalizeVenues(Array.isArray(data.venues) ? data.venues : []);
      }
    } catch {
      /* fallback to Firestore مباشرة */
    }
  }

  if (!isFirebaseBookingsEnabled()) {
    return [];
  }

  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, "fields"));
    const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    return normalizeVenues(raw);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "تعذّر تحميل الملاعب من قاعدة البيانات");
  }
}

/** مهلة قصيرة لـ HTTP — إن كان الخادم غير متاح لا ننتظر عشرات الثواني */
const FETCH_VENUE_HTTP_TIMEOUT_MS = 3_500;
/** سقف لـ getDoc عند بطء الشبكة فقط */
const FETCH_VENUE_FIRESTORE_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("venue fetch timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** أول استجابة تحتوي ملعباً صالحاً؛ إن رجعتا null ننتظر حتى تكتمل الأخيرة */
function firstResolvedVenue(sources: Promise<Venue | null>[]): Promise<Venue | null> {
  return new Promise((resolve) => {
    let remaining = sources.length;
    if (remaining === 0) {
      resolve(null);
      return;
    }
    let settled = false;
    const onResult = (v: Venue | null) => {
      if (settled) return;
      if (v) {
        settled = true;
        resolve(v);
        return;
      }
      remaining -= 1;
      if (remaining === 0 && !settled) resolve(null);
    };
    for (const s of sources) {
      void s.then(onResult).catch(() => onResult(null));
    }
  });
}

async function fetchVenueFromHttp(base: string, id: string): Promise<Venue | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_VENUE_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/venues/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.ok) return normalizeVenue(await res.json());
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchVenueFromFirestore(id: string): Promise<Venue | null> {
  if (!isFirebaseBookingsEnabled()) return null;
  try {
    const db = getFirestoreDb();
    const snap = await withTimeout(
      getDoc(doc(db, "fields", id)),
      FETCH_VENUE_FIRESTORE_TIMEOUT_MS,
    );
    if (!snap.exists()) return null;
    return normalizeVenue({ id: snap.id, ...(snap.data() as Record<string, unknown>) });
  } catch {
    return null;
  }
}

/** تحميل مسبق لصفحة التفاصيل — نفس مفتاح الاستعلام في `app/venue/[id].tsx` */
export function prefetchVenueDetailQuery(queryClient: QueryClient, venueId: string) {
  const trimmed = venueId.trim();
  if (!trimmed || trimmed.startsWith("exp-")) return;
  void queryClient.prefetchQuery({
    queryKey: ["venue", trimmed],
    queryFn: () => fetchVenueById(trimmed),
    staleTime: 30_000,
    retry: false,
  });
}

export async function fetchVenueById(id: string): Promise<Venue | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("exp-")) {
    return getExperimentalVenueById(trimmed);
  }
  const base = apiBase();
  const httpEnabled = Boolean(base);
  const fsEnabled = isFirebaseBookingsEnabled();

  if (httpEnabled && fsEnabled) {
    return firstResolvedVenue([
      fetchVenueFromHttp(base, trimmed),
      fetchVenueFromFirestore(trimmed),
    ]);
  }
  if (httpEnabled) return fetchVenueFromHttp(base, trimmed);
  if (fsEnabled) return fetchVenueFromFirestore(trimmed);
  return null;
}

type OwnerBookingApiRow = {
  id: string;
  ownerId: string;
  playerName: string;
  playerPhone: string | null;
  date: string;
  time: string;
  duration: number;
  price: number;
  fieldSize: string;
  status: Booking["status"];
  createdAt: string;
  venueNameSnapshot?: string | null;
};

function mapOwnerRowToPlayerBooking(row: OwnerBookingApiRow): Booking {
  const totalPrice = Math.round(row.price * row.duration * 100) / 100;
  return {
    id: row.id,
    venueId: row.ownerId,
    venueName: row.venueNameSnapshot?.trim() || "ملعب",
    fieldSize: row.fieldSize,
    date: row.date,
    time: row.time,
    duration: row.duration,
    price: totalPrice,
    status: row.status,
    players: [{ id: "p_me", name: row.playerName, paid: true }],
    createdAt: row.createdAt,
  };
}

export async function fetchPlayerBookings(
  playerId: string,
  phone: string
): Promise<Booking[]> {
  const base = apiBase();
  if (!base) return [];
  const qs = new URLSearchParams();
  if (playerId?.trim()) qs.set("playerUserId", playerId.trim());
  if (phone?.trim()) qs.set("phone", phone.trim());
  if (!qs.toString()) return [];
  try {
    const res = await fetch(`${base}/api/bookings/player?${qs.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { bookings?: OwnerBookingApiRow[] };
    const rows = Array.isArray(data.bookings) ? data.bookings : [];
    return rows.map(mapOwnerRowToPlayerBooking);
  } catch {
    return [];
  }
}

export async function fetchVenueBookingsForDay(
  venueId: string,
  dateYmd: string
): Promise<{ time: string; duration: number; status: string }[]> {
  if (!venueId || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return [];
  if (isFirebaseBookingsEnabled()) {
    return fetchVenueBookingsForDayFromFirestore(venueId, dateYmd);
  }
  const base = apiBase();
  if (!base) return [];
  try {
    const res = await fetch(
      `${base}/api/venues/${encodeURIComponent(venueId)}/bookings?date=${encodeURIComponent(dateYmd)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      bookings?: { time: string; duration: number; status: string }[];
    };
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch {
    return [];
  }
}

export async function upsertAppUser(_user: {
  id: string;
  phone: string;
  name: string;
  role: string;
}): Promise<boolean> {
  return false;
}

export async function insertBookingRemote(
  playerId: string,
  playerName: string,
  playerPhone: string,
  b: Booking,
  opts: { paymentMethod: string; paymentPaid: boolean }
): Promise<{ id: string } | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        venueId: b.venueId,
        playerName: playerName?.trim() || "لاعب",
        playerPhone: playerPhone?.trim() ?? "",
        playerUserId: playerId?.trim() ?? "",
        date: b.date,
        time: b.time,
        duration: b.duration,
        price: b.price,
        fieldSize: b.fieldSize,
        venueName: b.venueName,
        paymentMethod: opts.paymentMethod,
        paymentPaid: opts.paymentPaid,
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = (await res.json()) as { message?: string };
        if (err?.message) msg = err.message;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const data = (await res.json()) as { booking?: { id: string } };
    const id = data.booking?.id;
    return id ? { id } : null;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("تعذّر حفظ الحجز");
  }
}

export async function updateBookingRemote(
  bookingId: string,
  updates: Partial<{ status: string }>,
  identity: { playerUserId: string; phone: string }
): Promise<boolean> {
  if (updates.status !== "cancelled") return false;
  const base = apiBase();
  if (!base) return false;
  const qs = new URLSearchParams();
  if (identity.playerUserId?.trim()) qs.set("playerUserId", identity.playerUserId.trim());
  if (identity.phone?.trim()) qs.set("phone", identity.phone.trim());
  if (!qs.toString()) return false;
  try {
    const res = await fetch(`${base}/api/bookings/${encodeURIComponent(bookingId)}?${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
