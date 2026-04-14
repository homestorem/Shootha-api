/**
 * قراءة أسعار المدد (1.5 / 2 / 3 ساعات) من وثائق مجموعة Firestore `fields`
 * بكل الأشكال الشائعة: حقول مسطّحة، metadata، pricing، وخرائط المزامنة.
 */

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

function nearDuration(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

function tiersFromDurationBlob(blob: unknown): { t15: number; t2: number; t3: number } {
  const out = { t15: 0, t2: 0, t3: 0 };
  if (blob == null) return out;

  if (Array.isArray(blob)) {
    for (const item of blob) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
      const o = item as Record<string, unknown>;
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
  const map = blob as Record<string, unknown>;
  for (const [rawKey, val] of Object.entries(map)) {
    const key = rawKey.trim().toLowerCase().replace(/\s/g, "").replace(/،/g, "");
    const n = toNum(val);
    if (n <= 0) continue;
    const is15 =
      key === "1.5" ||
      key === "1_5" ||
      key === "90" ||
      key.includes("1.5") ||
      key.includes("1_5") ||
      key.includes("ساعةونصف") ||
      key === "onehalf";
    const is2 =
      key === "2" ||
      key === "120" ||
      key === "2h" ||
      key === "two" ||
      (key.startsWith("2") && key.includes("hour"));
    const is3 =
      key === "3" ||
      key === "180" ||
      key === "3h" ||
      key === "three" ||
      (key.startsWith("3") && key.includes("hour"));
    if (is15) out.t15 = Math.round(n);
    else if (is2 && !key.includes("1.5")) out.t2 = Math.round(n);
    else if (is3) out.t3 = Math.round(n);
  }
  return out;
}

function firstPositiveTier(...nums: number[]): number {
  for (const x of nums) {
    if (x > 0) return Math.round(x);
  }
  return 0;
}

function collectDurationPriceBlobs(v: Record<string, unknown>, meta: Record<string, unknown>): unknown[] {
  const m = meta ?? {};
  const keys = [
    "durationPrices",
    "duration_prices",
    "packagePrices",
    "package_prices",
    "tierPrices",
    "tier_prices",
    "أسعار_المدد",
    "fieldDurationPrices",
  ];
  const out: unknown[] = [];
  for (const k of keys) {
    if (v[k] != null) out.push(v[k]);
    if (m[k] != null) out.push(m[k]);
  }
  return out;
}

/**
 * @param v جذر وثيقة `fields` (أو نفس الشكل بعد JSON من الـ API)
 * @param meta `v.metadata` إن وُجد
 */
export function readFirestorePackageTiers(
  v: Record<string, unknown>,
  meta: Record<string, unknown> | undefined,
): { t15: number; t2: number; t3: number } {
  const m = meta ?? {};
  const metaPricing =
    m.pricing != null && typeof m.pricing === "object" && !Array.isArray(m.pricing)
      ? (m.pricing as Record<string, unknown>)
      : undefined;
  const rootPricing =
    v.pricing != null && typeof v.pricing === "object" && !Array.isArray(v.pricing)
      ? (v.pricing as Record<string, unknown>)
      : undefined;

  const pick = (snake: string, camel: string, shortKeys: string[]): number => {
    const candidates: unknown[] = [
      v[camel],
      v[snake],
      m[camel],
      m[snake],
      ...shortKeys.map((k) => v[k]),
      ...shortKeys.map((k) => m[k]),
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

  const fromBlobs: { t15: number; t2: number; t3: number } = { t15: 0, t2: 0, t3: 0 };
  for (const blob of collectDurationPriceBlobs(v, m)) {
    const part = tiersFromDurationBlob(blob);
    if (part.t15 > 0) fromBlobs.t15 = part.t15;
    if (part.t2 > 0) fromBlobs.t2 = part.t2;
    if (part.t3 > 0) fromBlobs.t3 = part.t3;
  }
  const fromRootPricing = rootPricing
    ? tiersFromDurationBlob(rootPricing)
    : { t15: 0, t2: 0, t3: 0 };
  const fromMetaPricing = metaPricing ? tiersFromDurationBlob(metaPricing) : { t15: 0, t2: 0, t3: 0 };

  t15 = firstPositiveTier(t15, fromBlobs.t15, fromRootPricing.t15, fromMetaPricing.t15);
  t2 = firstPositiveTier(t2, fromBlobs.t2, fromRootPricing.t2, fromMetaPricing.t2);
  t3 = firstPositiveTier(t3, fromBlobs.t3, fromRootPricing.t3, fromMetaPricing.t3);

  return { t15, t2, t3 };
}

/** وثيقة `fields` كاملة (بما فيها metadata) */
export function readPackageTiersFromFieldDoc(data: Record<string, unknown>): {
  t15: number;
  t2: number;
  t3: number;
} {
  const meta =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : undefined;
  return readFirestorePackageTiers(data, meta);
}
