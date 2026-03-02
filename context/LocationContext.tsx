import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import * as Location from "expo-location";

const MOSUL_LAT = 36.335;
const MOSUL_LON = 43.119;

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
  const [isLocating, setIsLocating] = useState(false);

  const requestLocation = useCallback(async () => {
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
  }, []);

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
