/**
 * معرّف لاعب عام قصير (8 أحرف) — يُنشأ مرة واحدة ولا يُغيَّر.
 * يُستخدم لربط الحجوزات والإشعارات والعمليات داخل التطبيق.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateImmutablePlayerPublicId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
