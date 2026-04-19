/**
 * تذكرة لمرة واحدة بعد نجاح OTP — تُرسل مع طلب custom-token لمنع إصدار توكن لأي رقم معروف.
 * تُمسح بعد نجاح تسجيل الدخول بـ Firebase أو عند انتهاء المهلة.
 */
type Pending = { ticket: string; expiresAt: number };

const TTL_MS = 14 * 60 * 1000;
let pending: Pending | null = null;
let lastPhone: string | null = null;

export function setPendingFirebaseBridgeTicket(phoneE164: string, ticket: string): void {
  const phone = phoneE164.trim();
  const t = ticket.trim();
  if (!phone || !t) return;
  lastPhone = phone;
  pending = { ticket: t, expiresAt: Date.now() + TTL_MS };
}

export function peekFirebaseBridgeTicket(phoneE164: string): string | null {
  const phone = phoneE164.trim();
  if (!pending || !lastPhone || lastPhone !== phone) return null;
  if (Date.now() > pending.expiresAt) {
    pending = null;
    lastPhone = null;
    return null;
  }
  return pending.ticket;
}

export function clearPendingFirebaseBridgeTicket(): void {
  pending = null;
  lastPhone = null;
}
