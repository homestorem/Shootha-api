import type { Venue } from "@/context/BookingsContext";

export type VenueWithMeta = Venue & {
  description?: string;
  distanceKm?: number;
};

/** خدمات الملعب مع الأيقونة (لصفحة التفاصيل) */
export const SERVICE_ICONS: Record<string, string> = {
  "كرة": "football",
  "حكم": "flag",
  "مقاعد": "people",
  "تعليق": "mic",
  "حمام / دورات مياه": "water",
  "حمام": "water",
  "إنترنت": "wifi",
  "إسعافات أولية": "medkit",
  "غرفة ملابس": "shirt",
  "تصوير": "camera",
  "ملابس": "shirt",
  "صافرة": "megaphone",
  "مولد كهرباء": "flash",
  "مغاسل": "water",
  "مكان توقف": "car",
  "مكبرات صوت": "volume-high",
  "مشروبات ساخنة": "cafe",
  "دورات مياه": "water",
  "مطعم/كافيتيريا": "restaurant",
  كافتيريا: "restaurant",
  "غرف تبديل": "shirt",
  "موقف سيارات": "car",
};

/** معاينة في صفحة الاستكشاف فقط؛ المعرف يبدأ بـ exp- لصفحة التفاصيل */
export const EXPLORER_PREVIEW_VENUE_ID = "exp-preview-explore";

export const EXPERIMENTAL_VENUES: VenueWithMeta[] = [
  {
    id: EXPLORER_PREVIEW_VENUE_ID,
    name: "ملعب معاينة Shoot'ha",
    location: "الموصل — معاينة واجهة",
    district: "مركز المدينة",
    rating: 4.8,
    reviewCount: 12,
    pricePerHour: 25000,
    fieldSizes: ["5 ضد 5", "6x6", "7 ضد 7"],
    amenities: ["إضاءة ليد", "مظلة", "مقاعد", "موقف"],
    imageColor: "#0F7A4C",
    isOpen: true,
    openHours: "8:00 – 24:00",
    lat: 36.335,
    lon: 43.119,
    description: "ملعب افتراضي للمعاينة — يظهر أولاً في الاستكشاف والخريطة حتى بدون بيانات من السيرفر.",
  },
  {
    id: "exp-preview-north",
    name: "ملعب الشمال التجريبي",
    location: "الموصل — حي الزهور",
    district: "الزهور",
    rating: 4.5,
    reviewCount: 8,
    pricePerHour: 20000,
    fieldSizes: ["5 ضد 5", "6x6"],
    amenities: ["إضاءة", "مقاعد", "مياه"],
    imageColor: "#1565C0",
    isOpen: true,
    openHours: "9:00 – 23:00",
    lat: 36.342,
    lon: 43.108,
    description: "ملعب معاينة ثانٍ — موقع مختلف قليلاً على الخريطة.",
  },
  {
    id: "exp-preview-south",
    name: "ملعب الجنوب التجريبي",
    location: "الموصل — حي المثنى",
    district: "المثنى",
    rating: 4.2,
    reviewCount: 5,
    pricePerHour: 18000,
    fieldSizes: ["6x6", "7 ضد 7", "11 ضد 11"],
    amenities: ["مظلة", "حمام", "واي فاي"],
    imageColor: "#C62828",
    isOpen: true,
    openHours: "7:00 – 22:00",
    lat: 36.328,
    lon: 43.13,
    description: "ملعب معاينة ثالث — للمقارنة بين البطاقات والأسعار.",
  },
];

export function getExperimentalVenueById(id: string): VenueWithMeta | null {
  return EXPERIMENTAL_VENUES.find((v) => v.id === id) ?? null;
}

export function isExperimentalVenueId(id: string): boolean {
  return id.startsWith("exp-");
}
