import { randomBytes } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 50_000;

type Entry = { ticket: string; expiresAt: number };

const byPhoneDigits = new Map<string, Entry>();

function pruneIfNeeded(): void {
  if (byPhoneDigits.size < MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of byPhoneDigits) {
    if (v.expiresAt <= now) byPhoneDigits.delete(k);
  }
}

/** يُستدعى بعد نجاح التحقق من OTP — المفتاح: أرقام الهاتف كما في normalizePhone بالخادم */
export function issueFirebaseBridgeTicket(phoneDigits: string): string {
  pruneIfNeeded();
  const key = phoneDigits.replace(/\D/g, "");
  if (!key) throw new Error("empty_phone_digits");
  const ticket = randomBytes(32).toString("hex");
  byPhoneDigits.set(key, { ticket, expiresAt: Date.now() + TTL_MS });
  return ticket;
}

export function consumeFirebaseBridgeTicket(phoneDigits: string, ticket: string): boolean {
  const key = phoneDigits.replace(/\D/g, "");
  if (!key || !ticket?.trim()) return false;
  const row = byPhoneDigits.get(key);
  if (!row || row.ticket !== ticket.trim()) return false;
  if (Date.now() > row.expiresAt) {
    byPhoneDigits.delete(key);
    return false;
  }
  byPhoneDigits.delete(key);
  return true;
}
