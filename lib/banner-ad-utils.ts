/** Prefer Cloudinary when both `image` and `imageUri` exist. */
export function pickPreferredBannerImageUrl(
  image?: string | null,
  imageUri?: string | null,
): string | null {
  const a = (image ?? "").trim();
  const b = (imageUri ?? "").trim();
  const isCloudinary = (u: string) => /cloudinary\.com\//i.test(u);
  if (a && isCloudinary(a)) return a;
  if (b && isCloudinary(b)) return b;
  if (a) return a;
  if (b) return b;
  return null;
}

const UNSPLASH_PARAMS = {
  auto: "format",
  fit: "crop",
  w: "800",
  q: "80",
} as const;

/** Returns null if not a usable http(s) URL. Unsplash hosts get stable crop params. */
export function normalizeBannerImageUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.hostname.includes("unsplash.com")) {
      for (const [k, v] of Object.entries(UNSPLASH_PARAMS)) {
        u.searchParams.set(k, v);
      }
      return u.toString();
    }
    return trimmed;
  } catch {
    return null;
  }
}

/** Only https links are opened in-app. */
export function sanitizeBannerLinkUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("https://")) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
