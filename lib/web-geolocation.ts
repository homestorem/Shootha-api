export type WebLatLng = { lat: number; lng: number };

/** الموصل — عند رفض الصلاحية أو فشل القراءة */
export const WEB_LOCATION_MOSUL_FALLBACK: WebLatLng = {
  lat: 36.34,
  lng: 43.13,
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
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
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
