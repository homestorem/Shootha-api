import type { Venue } from "@/context/BookingsContext";
import { enrichVenueFromFirestoreRaw } from "@/lib/venue-field-metadata";
import { readFirestorePackageTiers } from "@/lib/venue-package-tiers";

function toNum(x: unknown, defaultIfMissing = 0): number {
  if (x == null) return defaultIfMissing;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string") {
    const n = parseFloat(x.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** يضمن ظهور الأسعار في الواجهة حتى لو وصلت كسلسلة أو من مفاتيح بديلة */
export function normalizeVenue(raw: unknown): Venue {
  const v = raw as Record<string, unknown>;
  const meta =
    v.metadata && typeof v.metadata === "object" && !Array.isArray(v.metadata)
      ? (v.metadata as Record<string, unknown>)
      : undefined;
  const pricePerHour = toNum(
    v.pricePerHour ?? v.price_per_hour ?? v.hourlyPrice ?? v.hourly_price,
  );
  const packs = readFirestorePackageTiers(v, meta);
  const t15 = packs.t15;
  const t2 = packs.t2;
  const t3 = packs.t3;

  let hourly = pricePerHour;
  if (!hourly || hourly <= 0) {
    if (t2 > 0) hourly = Math.round(t2 / 2);
    else if (t15 > 0) hourly = Math.round(t15 / 1.5);
    else if (t3 > 0) hourly = Math.round(t3 / 3);
  }

  const paidOpts = Array.isArray(v.paidServiceOptions)
    ? (v.paidServiceOptions as { id: string; label: string; price: unknown }[]).map((o) => ({
        id: String(o.id),
        label: String(o.label ?? ""),
        price: toNum(o.price),
      }))
    : undefined;

  const base = { ...(raw as object) } as Venue;
  const name = String(v.name ?? v.venueName ?? v.title ?? base.name ?? "ملعب");
  const location = String(v.location ?? v.address ?? base.location ?? "الموصل");
  const district = String(v.district ?? v.areaName ?? base.district ?? "الموصل");
  const ratingRaw = toNum(v.rating ?? base.rating, 0);
  const reviewCountRaw = toNum(v.reviewCount ?? base.reviewCount, 0);
  const latRaw = toNum(v.lat ?? v.latitude ?? base.lat, 36.335);
  const lonRaw = toNum(v.lon ?? v.lng ?? v.longitude ?? base.lon, 43.119);
  const fieldSizesRaw = Array.isArray(v.fieldSizes)
    ? (v.fieldSizes as unknown[]).map((x) => String(x))
    : Array.isArray(v.sizes)
      ? (v.sizes as unknown[]).map((x) => String(x))
      : typeof v.field_size === "string"
        ? [String(v.field_size)]
        : typeof meta?.field_size === "string"
          ? [String(meta.field_size)]
    : Array.isArray(base.fieldSizes)
      ? (base.fieldSizes as unknown[]).map((x) => String(x))
      : [];
  const amenitiesRaw = Array.isArray(v.amenities)
    ? (v.amenities as unknown[]).map((x) => String(x))
    : Array.isArray(v.services)
      ? (v.services as unknown[]).map((x) => String(x))
    : Array.isArray(base.amenities)
      ? (base.amenities as unknown[]).map((x) => String(x))
      : [];
  const imageColor = String(v.imageColor ?? base.imageColor ?? "#1A2F1A");
  const image = String(
    v.image ??
      v.imageUrl ??
      v.imageURI ??
      (Array.isArray(v.images) ? v.images[0] : undefined) ??
      (Array.isArray(v.imageUrls) ? v.imageUrls[0] : undefined) ??
      (Array.isArray(v.photos) ? v.photos[0] : undefined) ??
      base.image ??
      "",
  ).trim();
  const openHours = String(v.openHours ?? base.openHours ?? "08:00 – 24:00");
  const isOpen = typeof (v.isOpen ?? base.isOpen) === "boolean" ? Boolean(v.isOpen ?? base.isOpen) : true;
  const br = base as Record<string, unknown>;
  const outT15 =
    t15 > 0 ? t15 : toNum(br.priceTier1_5Hours ?? br.price_1_5_hours ?? br.price_1_5h);
  const outT2 = t2 > 0 ? t2 : toNum(br.priceTier2Hours ?? br.price_2_hours ?? br.price_2h);
  const outT3 = t3 > 0 ? t3 : toNum(br.priceTier3Hours ?? br.price_3_hours ?? br.price_3h);

  const enriched = enrichVenueFromFirestoreRaw(v, meta);
  const amenitiesFinal =
    enriched.amenities.length > 0 ? enriched.amenities : amenitiesRaw;
  const scheduleKeys = Object.keys(enriched.scheduleSlotsByDay);
  return {
    ...base,
    name,
    location,
    district,
    rating: Number.isFinite(ratingRaw) ? ratingRaw : 0,
    reviewCount: Number.isFinite(reviewCountRaw) ? reviewCountRaw : 0,
    fieldSizes: fieldSizesRaw.length ? fieldSizesRaw : ["5 ضد 5"],
    amenities: amenitiesFinal,
    paidAmenities:
      enriched.paidAmenities.length > 0 ? enriched.paidAmenities : base.paidAmenities,
    imageColor,
    image: image || undefined,
    isOpen,
    openHours,
    lat: Number.isFinite(latRaw) ? latRaw : 36.335,
    lon: Number.isFinite(lonRaw) ? lonRaw : 43.119,
    pricePerHour: hourly,
    priceTier1_5Hours: outT15 > 0 ? outT15 : undefined,
    priceTier2Hours: outT2 > 0 ? outT2 : undefined,
    priceTier3Hours: outT3 > 0 ? outT3 : undefined,
    paidServiceOptions:
      enriched.paidServiceOptions.length > 0
        ? enriched.paidServiceOptions
        : paidOpts ?? base.paidServiceOptions,
    discountWindow: enriched.discountWindow ?? base.discountWindow,
    scheduleSlotsByDay:
      scheduleKeys.length > 0 ? enriched.scheduleSlotsByDay : base.scheduleSlotsByDay,
  };
}

export function normalizeVenues(list: unknown[]): Venue[] {
  if (!Array.isArray(list)) return [];
  return list.map((x) => normalizeVenue(x));
}
