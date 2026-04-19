import { IRAQ_FALLBACK_LAT, IRAQ_FALLBACK_LON, isCoordinateLikelyInIraq } from "@/lib/location-iraq-bounds";

export type WebLatLng = { lat: number; lng: number };

/** الموصل — عند رفض الصلاحية أو فشل القراءة */
export const WEB_LOCATION_MOSUL_FALLBACK: WebLatLng = {
  lat: IRAQ_FALLBACK_LAT,
  lng: IRAQ_FALLBACK_LON,
};

export type WebGeolocationResult = WebLatLng & { usedFallback: boolean };

/**
 * موقع المستخدم من `navigator.geolocation` (بدون Google / بدون API keys).
 * عند الرفض أو الخطأ أو عدم الدعم يعيد إحداثيات الموصل الافتراضية.
 */
export function getBrowserGeolocation(): Promise<WebGeolocationResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator?.geolocation?.getCurrentPosition) {
      resolve({ ...WEB_LOCATION_MOSUL_FALLBACK, usedFallback: true });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!isCoordinateLikelyInIraq(lat, lng)) {
          resolve({ ...WEB_LOCATION_MOSUL_FALLBACK, usedFallback: true });
          return;
        }
        resolve({
          lat,
          lng,
          usedFallback: false,
        });
      },
      () => {
        resolve({ ...WEB_LOCATION_MOSUL_FALLBACK, usedFallback: true });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 20_000,
      },
    );
  });
}
