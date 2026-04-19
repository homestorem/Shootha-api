import * as Location from "expo-location";
import { readSanitizedNativeCoordinates } from "@/lib/native-device-coords";

export async function getUserLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const { latitude, longitude } = await readSanitizedNativeCoordinates();

  const geo = await Location.reverseGeocodeAsync({
    latitude,
    longitude,
  });

  return {
    lat: latitude,
    lon: longitude,
    name: geo?.[0]?.city || geo?.[0]?.region || "Unknown",
  };
}
