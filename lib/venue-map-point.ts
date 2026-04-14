import type { Venue } from "@/context/BookingsContext";

/** نقطة خريطة بسيطة لـ OSM / Leaflet (خط الطول باسم `lng`). */
export type VenueMapPoint = {
  name: string;
  lat: number;
  lng: number;
};

export function toVenueMapPoint(v: Venue): VenueMapPoint {
  return { name: v.name, lat: v.lat, lng: v.lon };
}
