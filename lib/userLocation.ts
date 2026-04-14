import * as Location from "expo-location";

export async function getUserLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const loc = await Location.getCurrentPositionAsync({});

  const geo = await Location.reverseGeocodeAsync({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  });

  return {
    lat: loc.coords.latitude,
    lon: loc.coords.longitude,
    name: geo?.[0]?.city || geo?.[0]?.region || "Unknown",
  };
}
