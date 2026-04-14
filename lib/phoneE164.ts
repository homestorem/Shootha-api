/**
 * تحويل أرقام الجوال العراقية الشائعة إلى E.164 (+9647XXXXXXXXX)
 * ليتوافق مع التحقق في خادم OTP ومع تخزين الهاتف في الخادم.
 */
export function normalizeIqPhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("964")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    return `+964${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("7")) {
    return `+964${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+964${digits}`;
  }
  return `+${digits}`;
}

/** +964 متبوعاً بـ 10 أرقام (صيغة الجوال العراقي) */
export function isValidIqMobileE164(e164: string): boolean {
  return /^\+964\d{10}$/.test(e164.trim());
}

/**
 * استرجاع E.164 من معامل المسار (قد يفقد + في الرابط أو يصبح مسافة).
 */
export function normalizePhoneFromOtpRouteParam(raw: string): string {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return normalizeIqPhoneToE164(cleaned);
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("964")) {
    const core = digits.slice(0, 13);
    return core.length === 13 ? `+${core}` : normalizeIqPhoneToE164(digits);
  }
  return normalizeIqPhoneToE164(digits);
}
