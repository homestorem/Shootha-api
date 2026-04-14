import { formatIqd } from "@/lib/format-currency";

export type OwnerBooking = {
  id: string;
  ownerId: string;
  playerName: string;
  playerPhone: string | null;
  date: string;
  time: string;
  duration: number;
  price: number;
  fieldSize: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  source: "app" | "manual";
  createdAt: string;
};

export type VenueOwner = {
  id: string;
  name: string;
  phone: string;
  role: string;
  dateOfBirth: string | null;
  profileImage: string | null;
  venueName: string | null;
  areaName: string | null;
  fieldSize: string | null;
  bookingPrice: string | null;
  hasBathrooms: boolean | null;
  hasMarket: boolean | null;
  latitude: string | null;
  longitude: string | null;
  venueImages: string[];
};

export type OwnerStats = {
  totalBookings: number;
  appBookings: number;
  totalRevenue: number;
  todayBookings: number;
  todayRevenue: number;
  occupancyRate: number;
  last7Days: { date: string; count: number; revenue: number }[];
  peakHours: { hour: number; count: number }[];
};

export const FIELD_SIZE_OPTIONS = ["5×5", "7×7", "11×11"];
export const DURATION_OPTIONS = [1, 2, 3, 4];
export const BOOKING_HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

export function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? "م" : "ص";
  return `${h}:00 ${ampm}`;
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getActiveBooking(bookings: OwnerBooking[]): OwnerBooking | null {
  const now = new Date();
  const todayStr = getTodayString();
  const currentDecimal = now.getHours() + now.getMinutes() / 60;
  return (
    bookings.find((b) => {
      if (b.status === "cancelled" || b.date !== todayStr) return false;
      const startH = parseInt(b.time.split(":")[0]);
      return currentDecimal >= startH && currentDecimal < startH + b.duration;
    }) ?? null
  );
}

export function getTimeRemaining(booking: OwnerBooking): string {
  const now = new Date();
  const startH = parseInt(booking.time.split(":")[0]);
  const end = new Date();
  end.setHours(startH + booking.duration, 0, 0, 0);
  const remaining = end.getTime() - now.getTime();
  if (remaining <= 0) return "انتهى";
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatBookingTime(b: OwnerBooking): string {
  const start = parseInt(b.time.split(":")[0]);
  const end = start + b.duration;
  return `${String(start).padStart(2, "0")}:00 — ${String(end).padStart(2, "0")}:00`;
}

export function formatPrice(price: number, duration: number): string {
  return formatIqd(price * duration);
}
