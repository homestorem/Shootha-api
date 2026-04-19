/** إحداثيات افتراضية (الموصل) عند رفض الموقع أو قراءة غير موثوقة خارج العراق */
export const IRAQ_FALLBACK_LAT = 36.34;
export const IRAQ_FALLBACK_LON = 43.13;

/**
 * هل الإحداثيات ضمن العراق تقريباً (لرفض كاش أجهزة يعيد مثلاً إحداثيات الإمارات).
 * حدود مرتخية لتضمين الساحل والحدود.
 */
export function isCoordinateLikelyInIraq(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= 29.0 && lat <= 37.65 && lon >= 38.35 && lon <= 49.25;
}
