/**
 * قراءة ملاعب مجموعة Firestore `fields` عبر Firebase JS SDK (متوافق مع Node).
 * الإعداد من نفس متغيرات بيئة الواجهة EXPO_PUBLIC_FIREBASE_*.
 */
import { readPackageTiersFromFieldDoc } from "../lib/venue-package-tiers";
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  type Firestore,
} from "firebase/firestore";

export type VenueApiShape = {
  id: string;
  name: string;
  location: string;
  district: string;
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  fieldSizes: string[];
  amenities: string[];
  paidAmenities?: string[];
  /** خدمات بسعر ثابت يمكن للتطبيق جمعها مع المجموع */
  paidServiceOptions?: { id: string; label: string; price: number }[];
  priceTier1_5Hours?: number;
  priceTier2Hours?: number;
  priceTier3Hours?: number;
  imageColor: string;
  image?: string;
  imageUrls?: string[];
  isOpen: boolean;
  openHours: string;
  lat: number;
  lon: number;
};

const VENUE_COLORS = ["#1A2F1A", "#1A1A2F", "#2F1A1A", "#2F2A1A", "#1A2A2F"];

function getVenueColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return VENUE_COLORS[Math.abs(hash) % VENUE_COLORS.length];
}

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(/,/g, "");
    const n = parseFloat(cleaned.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function firstNum(data: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const k of keys) {
    if (data[k] !== undefined && data[k] !== null) {
      const n = num(data[k], NaN);
      if (Number.isFinite(n)) return n;
    }
  }
  return fallback;
}

function str(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return fallback;
}

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/** قائمة نصوص من مصفوفة، سلسلة مفصولة، أو خريطة { "خدمة": true } */
function stringListFromUnknown(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x != null && typeof x === "object" && !Array.isArray(x)) {
          const o = x as Record<string, unknown>;
          return String(o.name ?? o.label ?? o.title ?? "").trim();
        }
        return String(x).trim();
      })
      .filter(Boolean);
  }
  if (typeof v === "string") {
    return v
      .split(/[,،؛;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val === true || val === 1 || val === "true")
      .map(([k]) => k.trim())
      .filter(Boolean);
  }
  return [];
}

function splitServicesObjects(
  v: unknown,
): { free: string[]; paid: string[] } {
  if (!Array.isArray(v)) return { free: [], paid: [] };
  const free: string[] = [];
  const paid: string[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      free.push(item.trim());
      continue;
    }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const name = String(o.name ?? o.label ?? o.title ?? "").trim();
      if (!name) continue;
      const isPaid =
        o.paid === true ||
        o.isPaid === true ||
        o.type === "paid" ||
        o.premium === true;
      if (isPaid) paid.push(name);
      else free.push(name);
    }
  }
  return { free, paid };
}

/** مصفوفة نصوص، أو مصفوفة كائنات { name, paid } */
function listOrSplitAmenities(v: unknown): { free: string[]; paid: string[] } {
  if (!Array.isArray(v)) return { free: stringListFromUnknown(v), paid: [] };
  if (
    v.some(
      (x) => x != null && typeof x === "object" && !Array.isArray(x),
    )
  ) {
    return splitServicesObjects(v);
  }
  return { free: stringListFromUnknown(v), paid: [] };
}

function mergeUnique(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
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

/** مفاتيح لوحة التحكم / Firestore (إنجليزي) → عربي للعرض */
const SERVICE_KEY_TO_AR: Record<string, string> = {
  ball: "كرة",
  bathroom: "حمام / دورات مياه",
  commentary: "تعليق",
  first_aid: "إسعافات أولية",
  kits: "ملابس",
  photography: "تصوير",
  referee: "حكم",
  seats: "مقاعد",
  sinks: "مغاسل",
  speakers: "مكبرات صوت",
};

function labelForServiceKey(key: string): string {
  const k = key.trim().toLowerCase();
  return SERVICE_KEY_TO_AR[k] ?? key;
}

function mergePaidServiceOptions(
  ...lists: { id: string; label: string; price: number }[][]
): { id: string; label: string; price: number }[] {
  const byId = new Map<string, { id: string; label: string; price: number }>();
  for (const list of lists) {
    for (const o of list) {
      const id = o.id.trim().toLowerCase();
      if (!byId.has(id)) byId.set(id, { ...o, id });
    }
  }
  return Array.from(byId.values());
}

/**
 * شكل شائع: metadata.amenities = { ball: { enabled: true }, referee: { enabled: true, price: 5000 }, price: 5000 }
 * المفتاح price على مستوى amenities = سعر أساسي (مثلاً للساعة) وليس خدمة.
 */
function parseNestedAmenitiesMap(
  amenitiesMap: unknown,
): {
  free: string[];
  paid: string[];
  paidServiceOptions: { id: string; label: string; price: number }[];
  defaultPriceHint?: number;
} {
  const free: string[] = [];
  const paid: string[] = [];
  const paidServiceOptions: { id: string; label: string; price: number }[] = [];
  let defaultPriceHint: number | undefined;
  if (!amenitiesMap || typeof amenitiesMap !== "object" || Array.isArray(amenitiesMap)) {
    return { free, paid, paidServiceOptions, defaultPriceHint };
  }
  const map = amenitiesMap as Record<string, unknown>;
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
      const o = raw as Record<string, unknown>;
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

/** مصفوفة مفاتيح إنجليزية مثل services: ["ball","seats",...] */
function mapServiceKeysToLabels(services: unknown): string[] {
  if (!Array.isArray(services)) return [];
  return services.map((s) => labelForServiceKey(String(s))).filter(Boolean);
}

function tieredHourlyFallback(data: Record<string, unknown>): number {
  const p2 = num(data.price_2_hours, 0);
  if (p2 > 0) return Math.round(p2 / 2);
  const p15 = num(data.price_1_5_hours, 0);
  if (p15 > 0) return Math.round(p15 / 1.5);
  const p3 = num(data.price_3_hours, 0);
  if (p3 > 0) return Math.round(p3 / 3);
  return 0;
}

function scheduleToOpenHours(schedule: unknown): string | null {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;
  const values = Object.values(schedule as Record<string, unknown>);
  for (const v of values) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
      return v[0].replace(/-/g, " – ");
    }
  }
  return null;
}

function readLatLng(data: Record<string, unknown>): { lat: number; lon: number } {
  const geo =
    (data.geo as unknown) ??
    (data.location as unknown) ??
    (data.coordinates as unknown) ??
    (data.position as unknown);
  if (geo && typeof geo === "object" && geo !== null && "latitude" in geo && "longitude" in geo) {
    const g = geo as { latitude: number; longitude: number };
    if (typeof g.latitude === "number" && typeof g.longitude === "number") {
      return { lat: g.latitude, lon: g.longitude };
    }
  }
  return {
    lat: firstNum(data, ["lat", "latitude", "Lat", "LAT"], 36.335),
    lon: firstNum(data, ["lng", "lon", "longitude", "Lng", "LNG"], 43.119),
  };
}

export function mapFieldDocToVenue(
  id: string,
  data: Record<string, unknown>,
): VenueApiShape {
  const { lat, lon } = readLatLng(data);

  const meta =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : undefined;

  const nestedFromMeta = parseNestedAmenitiesMap(meta?.amenities);
  const nestedFromRoot =
    data.amenities != null &&
    typeof data.amenities === "object" &&
    !Array.isArray(data.amenities)
      ? parseNestedAmenitiesMap(data.amenities)
      : {
          free: [] as string[],
          paid: [] as string[],
          paidServiceOptions: [] as { id: string; label: string; price: number }[],
          defaultPriceHint: undefined,
        };

  const fieldSizesRaw = strArr(data.fieldSizes);
  const singleSize =
    data.fieldSize != null
      ? str(data.fieldSize, "")
      : data.field_size != null
        ? str(data.field_size, "")
        : "";
  const fieldSizes =
    fieldSizesRaw.length > 0
      ? fieldSizesRaw
      : singleSize
        ? [singleSize]
        : ["5 ضد 5"];

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
    stringListFromUnknown(data.free_amenities),
  );

  const paidAmenities = mergeUnique(
    nestedFromMeta.paid,
    nestedFromRoot.paid,
    fromAmenitiesField.paid,
    fromServicesField.paid,
    stringListFromUnknown(data.paidAmenities),
    stringListFromUnknown(data.paidServices),
    stringListFromUnknown(data.premiumServices),
    stringListFromUnknown(data.paid_services),
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
      "سعر_الساعة",
      "سعرالساعة",
    ],
    0,
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
  const tier15 =
    tiersFromDoc.t15 ||
    num(data.price_1_5_hours, 0) ||
    num(meta?.price_1_5_hours, 0);
  const tier2 =
    tiersFromDoc.t2 || num(data.price_2_hours, 0) || num(meta?.price_2_hours, 0);
  const tier3 =
    tiersFromDoc.t3 || num(data.price_3_hours, 0) || num(meta?.price_3_hours, 0);

  const mergedPaidOptions = mergePaidServiceOptions(
    nestedFromMeta.paidServiceOptions,
    nestedFromRoot.paidServiceOptions,
  );

  const openFromSchedule = scheduleToOpenHours(data.schedule);
  const openHours =
    str(data.openHours, "") ||
    (openFromSchedule ?? "") ||
    "08:00 – 24:00";

  const venueImageCandidates = mergeUnique(
    [str(data.image, ""), str(data.imageUrl, ""), str(data.imageURI, ""), str(data.photo, "")],
    stringListFromUnknown(data.images),
    stringListFromUnknown(data.imageUrls),
    stringListFromUnknown(data.photos),
  ).filter((x) => x.startsWith("http://") || x.startsWith("https://"));

  const out: VenueApiShape = {
    id,
    name: str(data.name ?? data.venueName ?? data.title, "ملعب"),
    location: str(data.location ?? data.address, "الموصل"),
    district: str(data.district ?? data.areaName ?? data.neighborhood, "الموصل"),
    rating: num(data.rating, 0),
    reviewCount: num(data.reviewCount, 0),
    pricePerHour,
    fieldSizes,
    amenities,
    imageColor: str(data.imageColor, getVenueColor(id)),
    isOpen:
      data.status === "closed" || data.status === "rejected" || data.status === "suspended"
        ? false
        : data.isOpen !== false,
    openHours,
    lat,
    lon,
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

function firebaseOptionsFromEnv(): FirebaseOptions {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

export function isFirebaseEnvConfigured(): boolean {
  const o = firebaseOptionsFromEnv();
  return Boolean(o.apiKey && o.projectId && o.appId);
}

let firestoreInstance: Firestore | null = null;

function getFirestoreSingleton(): Firestore {
  if (firestoreInstance) return firestoreInstance;
  const opts = firebaseOptionsFromEnv();
  if (!opts.apiKey || !opts.projectId || !opts.appId) {
    throw new Error(
      "Firebase غير مُضبط: أضف EXPO_PUBLIC_FIREBASE_API_KEY و EXPO_PUBLIC_FIREBASE_PROJECT_ID و EXPO_PUBLIC_FIREBASE_APP_ID",
    );
  }
  const app = getApps().length === 0 ? initializeApp(opts) : getApp();
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}

/** مجموعة Firestore: `fields` */
export async function fetchVenuesFromFirestore(): Promise<VenueApiShape[]> {
  const db = getFirestoreSingleton();
  const snap = await getDocs(collection(db, "fields"));
  return snap.docs.map((d) =>
    mapFieldDocToVenue(d.id, d.data() as Record<string, unknown>),
  );
}

export async function getVenueByIdFromFirestore(
  id: string,
): Promise<VenueApiShape | null> {
  const db = getFirestoreSingleton();
  const ref = doc(db, "fields", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapFieldDocToVenue(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * معرّف حساب المالك في التطبيق إن وُجد في مستند Firestore (لربط الحجز بداشبورد المالك).
 * يدعم: ownerId، owner_id، ownerUserId، أو داخل metadata.ownerId
 */
export async function getFirestoreFieldOwnerUserId(venueId: string): Promise<string | null> {
  try {
    const db = getFirestoreSingleton();
    const snap = await getDoc(doc(db, "fields", venueId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const meta =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : undefined;
    const raw = str(
      data.ownerId ??
        data.owner_id ??
        data.ownerUserId ??
        meta?.ownerId ??
        meta?.owner_user_id ??
        "",
      "",
    );
    return raw.trim() || null;
  } catch {
    return null;
  }
}
