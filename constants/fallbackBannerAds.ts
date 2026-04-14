export type BannerAd = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  linkUrl?: string | null;
};

/**
 * Shown only when Firestore `ads` returns no active documents (after mapping).
 * Single item — avoids duplicate “demo” stacks in the UI.
 */
export const DEMO_ADS_WHEN_EMPTY: BannerAd[] = [
  {
    id: "demo-fallback",
    title: "بانر تجريبي",
    subtitle: "سيتم عرض المحتوى من لوحة التحكم قريباً",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
  },
];
