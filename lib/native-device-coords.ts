/**
 * قراءة موقع الجهاز (أندرويد/iOS) مع دقة عالية واستبعاد إحداثيات واضحة خارج العراق
 * (مثل كاش موقع سابق في الخليج).
 */
import * as Location from "expo-location";
import {
  IRAQ_FALLBACK_LAT,
  IRAQ_FALLBACK_LON,
  isCoordinateLikelyInIraq,
} from "@/lib/location-iraq-bounds";

export type SanitizedCoords = {
  latitude: number;
  longitude: number;
  /** true إذا تجاهلنا قراءة الجهاز واستخدمنا الموصل */
  usedIraqFallback: boolean;
};

async function tryRead(accuracy: Location.Accuracy): Promise<{ lat: number; lon: number } | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy,
      mayShowUserSettingsDialog: true,
    });
    return { lat: loc.coords.latitude, lon: loc.coords.longitude };
  } catch {
    return null;
  }
}

/** يفترض أنّ صلاحية الموقع ممنوحة مسبقاً */
export async function readSanitizedNativeCoordinates(): Promise<SanitizedCoords> {
  const order: Location.Accuracy[] = [
    Location.Accuracy.Highest,
    Location.Accuracy.BestForNavigation,
    Location.Accuracy.High,
    Location.Accuracy.Balanced,
  ];
  for (const accuracy of order) {
    const c = await tryRead(accuracy);
    if (c && isCoordinateLikelyInIraq(c.lat, c.lon)) {
      return { latitude: c.lat, longitude: c.lon, usedIraqFallback: false };
    }
  }
  return {
    latitude: IRAQ_FALLBACK_LAT,
    longitude: IRAQ_FALLBACK_LON,
    usedIraqFallback: true,
  };
}
