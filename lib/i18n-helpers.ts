import type { Language } from "@/context/LanguageContext";

export function isRtlLanguage(lang: Language): boolean {
  return lang === "ar" || lang === "ku";
}

export function normalizeLocalizedInput(input: string, lang: Language): string {
  let v = String(input ?? "").replace(/\s{2,}/g, " ").trim();
  if (lang === "ar" || lang === "ku") {
    // Normalize common Arabic variants for stable validation/search.
    v = v
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه");
  }
  return v;
}

export function getDirectionalTextProps(lang: Language): {
  textAlign: "left" | "right";
  writingDirection: "ltr" | "rtl";
} {
  const rtl = isRtlLanguage(lang);
  return {
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
  };
}
