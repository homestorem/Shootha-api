import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { getBrowserGeolocation } from "@/lib/web-geolocation";

const MOSUL_LAT = 36.34;
const MOSUL_LON = 43.13;

interface LocationContextValue {
  latitude: number;
  longitude: number;
  hasPermission: boolean | null;
  isLocating: boolean;
  requestLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [latitude, setLatitude] = useState(MOSUL_LAT);
  const [longitude, setLongitude] = useState(MOSUL_LON);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLocating, setIsLocating] = useState(() => Platform.OS === "web");

  const hydrateWebLocation = useCallback(async () => {
    if (Platform.OS !== "web") return;
    setIsLocating(true);
    try {
      const pos = await getBrowserGeolocation();
      setLatitude(pos.lat);
      setLongitude(pos.lng);
      setHasPermission(true);
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      void hydrateWebLocation();
    }
  }, [hydrateWebLocation]);

  const requestLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      await hydrateWebLocation();
      return;
    }
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setHasPermission(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLatitude(loc.coords.latitude);
        setLongitude(loc.coords.longitude);
      } else {
        setHasPermission(false);
      }
    } catch {
      setHasPermission(false);
    } finally {
      setIsLocating(false);
    }
  }, [hydrateWebLocation]);

  return (
    <LocationContext.Provider
      value={{ latitude, longitude, hasPermission, isLocating, requestLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
