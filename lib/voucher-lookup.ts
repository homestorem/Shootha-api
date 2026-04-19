const VOUCHERS_COLLECTION = "vouchers";

export { VOUCHERS_COLLECTION };

/**
 * قيم `code` المحتملة للمطابقة مع Firestore (مع شرطة SH-… أو بدونها).
 */
export function buildVoucherLookupCodes(raw: string): string[] {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  const upper = s.toUpperCase().replace(/\s+/g, "");
  const set = new Set<string>();
  if (upper) set.add(upper);
  const noHyphen = upper.replace(/-/g, "");
  if (noHyphen && noHyphen !== upper) set.add(noHyphen);
  if (noHyphen.startsWith("SH") && noHyphen.length > 2 && !upper.includes("-")) {
    set.add(`SH-${noHyphen.slice(2)}`);
  }
  return [...set].filter(Boolean).slice(0, 10);
}

/** انتهت صلاحية القسيمة إذا كان expiryDate نصاً بصيغة YYYY-MM-DD */
export function isVoucherExpired(expiryDate: unknown): boolean {
  if (expiryDate == null) return false;
  const str = String(expiryDate).trim();
  if (!str) return false;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T23:59:59.999Z` : str;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() > d.getTime();
}

export type VoucherRedeemFields = {
  amount?: unknown;
  code?: unknown;
  isUsed?: unknown;
  used?: unknown;
  expiryDate?: unknown;
};

export function isVoucherMarkedUsed(data: VoucherRedeemFields): boolean {
  return data.isUsed === true || data.used === true;
}

export function readVoucherAmount(data: VoucherRedeemFields): number {
  return Math.round(Number(data.amount ?? 0));
}

/** مفتاح idempotency ثابت لكل قسيمة (مستند Firestore) */
export function voucherRedeemLedgerId(voucherDocId: string): string {
  return `redeem:voucher:${String(voucherDocId ?? "").trim()}`;
}

