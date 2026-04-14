/**
 * استخراج حقول لوحة التحكم / Firestore: metadata.amenities، الخصم، schedule الأسبوعي.
 */

export type ParsedPaidOption = { id: string; label: string; price: number };

export type VenueDiscountWindow = {
  timeFrom: string;
  timeTo: string;
  percent: number;
};

const SERVICE_KEY_TO_AR: Record<string, string> = {
  ball: "كرة",
  bathroom: "حمام / دورات مياه",
  cafeteria: "كافتيريا",
  changing_room: "غرف تبديل",
  commentary: "تعليق",
  first_aid: "إسعافات أولية",
  generator: "مولد كهرباء",
  internet: "إنترنت",
  kits: "ملابس",
  parking: "موقف سيارات",
  photography: "تصوير",
  referee: "حكم",
  seats: "مقاعد",
  sinks: "مغاسل",
  speakers: "مكبرات صوت",
  whistle: "صافرة",
};

function labelForServiceKey(key: string): string {
  const k = key.trim().toLowerCase();
  return SERVICE_KEY_TO_AR[k] ?? key;
}

function num(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string") {
    const n = parseFloat(x.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** metadata.amenities كخريطة { ball: { enabled }, referee: { enabled, price } } */
export function parseMetadataAmenities(amenitiesMap: unknown): {
  freeLabels: string[];
  paidLabels: string[];
  paidServiceOptions: ParsedPaidOption[];
  defaultPriceHint?: number;
} {
  const freeLabels: string[] = [];
  const paidLabels: string[] = [];
  const paidServiceOptions: ParsedPaidOption[] = [];
  let defaultPriceHint: number | undefined;

  if (!amenitiesMap || typeof amenitiesMap !== "object" || Array.isArray(amenitiesMap)) {
    return { freeLabels, paidLabels, paidServiceOptions, defaultPriceHint };
  }

  const map = amenitiesMap as Record<string, unknown>;
  for (const [key, raw] of Object.entries(map)) {
    const k = key.trim().toLowerCase();
    if (k === "price") {
      const p = num(raw);
      if (p > 0) defaultPriceHint = Math.round(p);
      continue;
    }
    if (raw === true) {
      freeLabels.push(labelForServiceKey(key));
      continue;
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (o.enabled === false) continue;
      const label = labelForServiceKey(key);
      const p = num(o.price);
      if (p > 0) {
        paidLabels.push(`${label} (+${Math.round(p).toLocaleString("en-US")} IQD)`);
        paidServiceOptions.push({ id: k, label, price: Math.round(p) });
      } else {
        freeLabels.push(label);
      }
    }
  }
  return { freeLabels, paidLabels, paidServiceOptions, defaultPriceHint };
}

export function mapServicesArrayToArabicLabels(services: unknown): string[] {
  if (!Array.isArray(services)) return [];
  return services.map((s) => labelForServiceKey(String(s))).filter(Boolean);
}

/** لا تُدرج مفاتيح الخدمات المدفوعة في قائمة «مشمولة» */
export function mapServicesArrayToArabicLabelsExcluding(
  services: unknown,
  paidIds: Set<string>,
): string[] {
  if (!Array.isArray(services)) return [];
  const out: string[] = [];
  for (const s of services) {
    const key = String(s).trim().toLowerCase();
    if (paidIds.has(key)) continue;
    out.push(labelForServiceKey(key));
  }
  return out.filter(Boolean);
}

function mergeUniqueStrings(...lists: string[][]): string[] {
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

function mergePaidOptions(...lists: ParsedPaidOption[][]): ParsedPaidOption[] {
  const byId = new Map<string, ParsedPaidOption>();
  for (const list of lists) {
    for (const o of list) {
      const id = o.id.trim().toLowerCase();
      if (!byId.has(id)) byId.set(id, { ...o, id });
    }
  }
  return Array.from(byId.values());
}

export function enrichVenueFromFirestoreRaw(
  v: Record<string, unknown>,
  meta: Record<string, unknown> | undefined,
): {
  amenities: string[];
  paidAmenities: string[];
  paidServiceOptions: ParsedPaidOption[];
  defaultPriceHint?: number;
  discountWindow?: VenueDiscountWindow;
  scheduleSlotsByDay: Record<string, string[]>;
} {
  const nestedMeta = parseMetadataAmenities(meta?.amenities);
  const nestedRoot =
    v.amenities != null && typeof v.amenities === "object" && !Array.isArray(v.amenities)
      ? parseMetadataAmenities(v.amenities)
      : { freeLabels: [], paidLabels: [], paidServiceOptions: [] as ParsedPaidOption[] };

  const paidIdsEarly = new Set<string>([
    ...nestedMeta.paidServiceOptions.map((o) => o.id),
    ...nestedRoot.paidServiceOptions.map((o) => o.id),
  ]);
  if (Array.isArray(v.paidServiceOptions)) {
    for (const o of v.paidServiceOptions as { id?: string }[]) {
      const id = String(o.id ?? "").trim().toLowerCase();
      if (id) paidIdsEarly.add(id);
    }
  }

  const fromServices = mapServicesArrayToArabicLabelsExcluding(v.services, paidIdsEarly);

  const amenities = mergeUniqueStrings(
    nestedMeta.freeLabels,
    nestedRoot.freeLabels,
    fromServices,
    Array.isArray(v.amenities)
      ? (v.amenities as unknown[]).map((x) => String(x))
      : [],
  );

  const paidAmenities = mergeUniqueStrings(nestedMeta.paidLabels, nestedRoot.paidLabels);

  const paidServiceOptions = mergePaidOptions(
    nestedMeta.paidServiceOptions,
    nestedRoot.paidServiceOptions,
    Array.isArray(v.paidServiceOptions)
      ? (v.paidServiceOptions as { id?: string; label?: string; price?: unknown }[]).map((o) => ({
          id: String(o.id ?? o.label ?? "").trim().toLowerCase() || "opt",
          label: String(o.label ?? ""),
          price: num(o.price),
        }))
      : [],
  ).filter((o) => o.label && o.price > 0);

  const defaultPriceHint = nestedMeta.defaultPriceHint ?? nestedRoot.defaultPriceHint;

  const discountRaw =
    meta?.discount && typeof meta.discount === "object" && !Array.isArray(meta.discount)
      ? (meta.discount as Record<string, unknown>)
      : undefined;
  let discountWindow: VenueDiscountWindow | undefined;
  if (discountRaw) {
    const tf = String(discountRaw.timeFrom ?? "").trim();
    const tt = String(discountRaw.timeTo ?? "").trim();
    const pct = num(discountRaw.percent ?? discountRaw.percent_off);
    if (tf && tt && pct > 0) {
      discountWindow = { timeFrom: tf, timeTo: tt, percent: Math.min(100, Math.round(pct)) };
    }
  }
  if (!discountWindow) {
    const p = num(v.discount_percent ?? meta?.discount_percent);
    if (p > 0 && discountRaw) {
      const tf = String(discountRaw.timeFrom ?? "").trim();
      const tt = String(discountRaw.timeTo ?? "").trim();
      if (tf && tt) discountWindow = { timeFrom: tf, timeTo: tt, percent: Math.min(100, Math.round(p)) };
    }
  }

  const scheduleSlotsByDay = parseScheduleMap(v.schedule);

  return {
    amenities,
    paidAmenities,
    paidServiceOptions,
    defaultPriceHint,
    discountWindow,
    scheduleSlotsByDay,
  };
}

/** أسماء الأيام في schedule قد تختلف قليلاً */
const DAY_KEY_ALIASES: Record<string, string> = {
  الإثنين: "الاثنين",
  اثنين: "الاثنين",
};

export function parseScheduleMap(schedule: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return out;
  for (const [k, v] of Object.entries(schedule as Record<string, unknown>)) {
    let key = k.trim();
    key = DAY_KEY_ALIASES[key] ?? key;
    if (Array.isArray(v)) {
      out[key] = v.filter((x): x is string => typeof x === "string" && x.includes("-"));
    }
  }
  return out;
}

/** اسم يوم عربي من تاريخ ISO محلي (YYYY-MM-DD) */
export function arabicWeekdayNameFromIsoLocal(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return "السبت";
  const dt = new Date(y, m - 1, d);
  const map: Record<number, string> = {
    0: "الأحد",
    1: "الاثنين",
    2: "الثلاثاء",
    3: "الأربعاء",
    4: "الخميس",
    5: "الجمعة",
    6: "السبت",
  };
  return map[dt.getDay()] ?? "السبت";
}

function timeToMinutes(t: string): number {
  const [h, mm] = t.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (mm || 0);
}

/** هل [start, end) ضمن نافذة واحدة على الأقل من "09:00-23:00" */
export function isRangeInsideScheduleWindows(
  startTime: string,
  endTime: string,
  windows: string[],
): boolean {
  if (!windows.length) return true;
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  if (e <= s) return false;
  for (const w of windows) {
    const parts = w.split("-").map((x) => x.trim());
    if (parts.length < 2) continue;
    const ws = timeToMinutes(parts[0]);
    const we = timeToMinutes(parts[1]);
    if (we <= ws) continue;
    if (s >= ws && e <= we) return true;
  }
  return false;
}

export function getScheduleWindowsForDay(
  scheduleSlotsByDay: Record<string, string[]> | undefined,
  isoDate: string,
): string[] | null {
  if (!scheduleSlotsByDay || Object.keys(scheduleSlotsByDay).length === 0) return null;
  const day = arabicWeekdayNameFromIsoLocal(isoDate);
  const w = scheduleSlotsByDay[day];
  if (w?.length) return w;
  const alt = DAY_KEY_ALIASES[day] ? scheduleSlotsByDay[DAY_KEY_ALIASES[day]] : undefined;
  if (alt?.length) return alt;
  /** جدول مُعرّف لكن هذا اليوم غير مذكور — نعتبره مغلقاً */
  return [];
}
