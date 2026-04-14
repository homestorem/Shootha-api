import type { Language } from "@/context/LanguageContext";

const COMMON_EN = new Set([
  "hello", "name", "phone", "email", "message", "booking", "promo", "code", "support", "login", "register",
]);
const COMMON_AR = new Set([
  "مرحبا", "الاسم", "الهاتف", "رسالة", "حجز", "كود", "خصم", "دعم", "تسجيل", "الدخول",
]);
const COMMON_KU = new Set([
  "slaw", "nav", "telefon", "peyâm", "rezervasyon", "kod", "dashkandin", "destek",
]);

export function sanitizeInput(value: string, allow: RegExp): string {
  const trimmed = value.replace(/\s{2,}/g, " ").trimStart();
  return Array.from(trimmed).filter((c) => allow.test(c)).join("");
}

export function validatePersonName(name: string): boolean {
  return /^[\p{L}\s'.-]{2,}$/u.test(name.trim());
}

export function validatePhoneByCountry(phone: string, country = "IQ"): boolean {
  const clean = phone.replace(/[^\d+]/g, "");
  if (country === "IQ") {
    return /^(\+964|0)?7\d{9}$/.test(clean);
  }
  return /^\+?[1-9]\d{7,14}$/.test(clean);
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function dictFor(lang: Language): Set<string> {
  if (lang === "en") return COMMON_EN;
  if (lang === "ku") return COMMON_KU;
  return COMMON_AR;
}

export function detectMisspelledWords(text: string, lang: Language): string[] {
  const dict = dictFor(lang);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return words.filter((w) => w.length > 2 && !dict.has(w));
}

export function suggestWord(word: string, lang: Language): string[] {
  const dict = Array.from(dictFor(lang));
  return dict
    .map((w) => ({ w, d: levenshtein(word.toLowerCase(), w.toLowerCase()) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.w);
}
