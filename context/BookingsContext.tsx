import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  isFirebaseBookingsEnabled,
  createBookingInFirestore,
  subscribePlayerBookings,
  cancelBookingInFirestore,
  updateBookingRandomMatchId,
  type PlayerBookingRow,
} from "@/lib/firestore-bookings";
import { requireLocationForBooking } from "@/lib/bookingLocation";
import { formatIqd } from "@/lib/format-currency";

export type BookingStatus = "upcoming" | "active" | "completed" | "cancelled";

export type Player = {
  id: string;
  name: string;
  paid: boolean;
};

export type Booking = {
  id: string;
  venueId: string;
  venueName: string;
  fieldSize: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: BookingStatus;
  players: Player[];
  createdAt: string;
  /** مرتبط بمباراة عشوائية بعد إنشاء الحجز من مسار المباراة العشوائية */
  randomMatchId?: string;
  /** وُجد تقييم ما بعد الجلسة في Firestore (postMatchRatingAt) */
  postMatchRated?: boolean;
};

export type Venue = {
  id: string;
  name: string;
  location: string;
  district: string;
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  fieldSizes: string[];
  /** خدمات مشمولة / مجانية أو عامة */
  amenities: string[];
  /** خدمات إضافية مدفوعة (من Firestore أو لوحة التحكم) */
  paidAmenities?: string[];
  /** خدمات مدفوعة قابلة للاختيار مع السعر (من الخادم) */
  paidServiceOptions?: { id: string; label: string; price: number }[];
  /** باقات مدة من قاعدة البيانات — لحساب سعر الساعة إن لم يُضبط pricePerHour */
  priceTier1_5Hours?: number;
  priceTier2Hours?: number;
  priceTier3Hours?: number;
  imageColor: string;
  image?: string;
  isOpen: boolean;
  openHours: string;
  lat: number;
  lon: number;
  /** خصم على إيجار الملعب ضمن نافذة زمنية يومية (من metadata.discount) */
  discountWindow?: { timeFrom: string; timeTo: string; percent: number };
  /** جدول الأسبوع: اسم اليوم بالعربي → نطاقات مثل "09:00-23:00" */
  scheduleSlotsByDay?: Record<string, string[]>;
};

function rowToBooking(row: PlayerBookingRow): Booking {
  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    fieldSize: row.fieldSize,
    date: row.date,
    time: row.time,
    duration: row.duration,
    price: row.price,
    status: row.status,
    players: row.players,
    createdAt: row.createdAt,
    randomMatchId: row.randomMatchId,
    postMatchRated: row.postMatchRated,
  };
}

interface BookingsContextValue {
  bookings: Booking[];
  addBooking: (
    booking: Booking,
    options?: {
      paymentMethod?: string;
      paymentPaid?: boolean;
      skipTimeConflictCheck?: boolean;
      promo?: {
        code: string;
        discountAmount: number;
        bookingSubtotalBeforePromo: number;
      };
    }
  ) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  cancelBooking: (id: string, uiBooking?: Booking) => void;
  rebookLast: () => Booking | null;
  activeCount: number;
  isLoading: boolean;
  /** الحجوزات من Firestore (أو لا يوجد إعداد) */
  useRemoteBookings: boolean;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);

/** فتحات كل 30 دقيقة — يظهر 11:30 بعد حجز 10:00–11:30 ليتمكن آخرون من الحجز */
export const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break;
      out.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
    }
  }
  return out;
})();

export function BookingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fsEnabled = isFirebaseBookingsEnabled();

  useEffect(() => {
    if (!fsEnabled || !user || user.id === "guest" || user.role === "guest") {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribePlayerBookings(
      user.id,
      (rows) => {
        setBookings(rows.map(rowToBooking));
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsub();
  }, [fsEnabled, user?.id, user?.role]);

  const addBooking = useCallback(
    async (
      b: Booking,
      options?: {
        paymentMethod?: string;
        paymentPaid?: boolean;
        /** لنسخ حجز من رابط دعوة — يتخطى تعارض نفس الموعد في Firestore */
        skipTimeConflictCheck?: boolean;
        promo?: {
          code: string;
          discountAmount: number;
          bookingSubtotalBeforePromo: number;
        };
      }
    ) => {
      const pay = options?.paymentMethod ?? "app";
      const paymentPaid = options?.paymentPaid !== false;

      if (!fsEnabled) {
        throw new Error(
          "Firebase غير مُضبط — أضف مفاتيح EXPO_PUBLIC_FIREBASE_* في .env لحفظ الحجوزات."
        );
      }
      if (!user || user.id === "guest" || user.role === "guest") {
        throw new Error("سجّل الدخول لإتمام الحجز وحفظه.");
      }
      if (b.venueId.startsWith("exp-")) {
        throw new Error("الملاعب التجريبية لا تدعم الحفظ في السحابة.");
      }
      if (!(user.playerId ?? "").trim()) {
        throw new Error(
          "جارٍ مزامنة معرّف حسابك. انتظر قليلاً ثم أعد المحاولة أو أعد تسجيل الدخول."
        );
      }

      const coords = await requireLocationForBooking();

      const promo = options?.promo;
      const id = await createBookingInFirestore({
        venueId: b.venueId,
        playerUserId: user.id,
        playerId: user.playerId ?? "",
        playerName: user.name ?? "لاعب",
        phone: user.phone ?? "",
        date: b.date,
        startTime: b.time,
        duration: b.duration,
        totalPrice: b.price,
        venueName: b.venueName,
        fieldSize: b.fieldSize,
        appPaymentMethod: pay,
        paymentPaid,
        randomMatchId: b.randomMatchId,
        playerLat: coords.lat,
        playerLon: coords.lon,
        ...(promo
          ? {
              promoCode: promo.code,
              promoDiscountAmount: promo.discountAmount,
              bookingSubtotalBeforePromo: promo.bookingSubtotalBeforePromo,
            }
          : {}),
        ...(options?.skipTimeConflictCheck ? { skipTimeConflictCheck: true } : {}),
      });

      const saved: Booking = { ...b, id };
      return saved;
    },
    [fsEnabled, user]
  );

  const updateBooking = useCallback(
    (bookingId: string, updates: Partial<Booking>) => {
      if (fsEnabled && user && user.id !== "guest" && updates.randomMatchId) {
        void updateBookingRandomMatchId(bookingId, user.id, updates.randomMatchId);
      }
      setBookings((prev) =>
        prev.map((x) => (x.id === bookingId ? { ...x, ...updates } : x))
      );
    },
    [fsEnabled, user]
  );

  const cancelBooking = useCallback(
    (bookingId: string, uiBooking?: Booking) => {
      if (fsEnabled && user && user.id !== "guest") {
        void cancelBookingInFirestore(bookingId, user.id, {
          uiPlayers: uiBooking?.players,
          phoneForMirror: user.phone,
        }).catch((e) => {
          console.warn("[Bookings] cancel:", e);
        });
      }
      setBookings((prev) =>
        prev.map((x) =>
          x.id === bookingId ? { ...x, status: "cancelled" as const } : x
        )
      );
    },
    [fsEnabled, user]
  );

  const rebookLast = useCallback((): Booking | null => {
    const completed = bookings.filter((b) => b.status === "completed");
    if (completed.length === 0) return null;
    const last = completed[0];
    const newDate = getDateString(7, last.date);
    const newBooking: Booking = {
      ...last,
      id: "",
      date: newDate,
      status: "upcoming",
      players: [{ id: "p_me", name: "أنا", paid: true }],
      createdAt: new Date().toISOString(),
    };
    void addBooking(newBooking, { paymentMethod: "rebook", paymentPaid: true });
    return newBooking;
  }, [bookings, addBooking]);

  const activeCount = useMemo(
    () =>
      bookings.filter((b) => b.status === "active" || b.status === "upcoming")
        .length,
    [bookings]
  );

  const value = useMemo(
    () => ({
      bookings,
      addBooking,
      updateBooking,
      cancelBooking,
      rebookLast,
      activeCount,
      isLoading,
      useRemoteBookings: fsEnabled,
    }),
    [
      bookings,
      addBooking,
      updateBooking,
      cancelBooking,
      rebookLast,
      activeCount,
      isLoading,
      fsEnabled,
    ]
  );

  return (
    <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>
  );
}

export function useBookings() {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error("useBookings must be used within BookingsProvider");
  return ctx;
}

function getDateString(daysOffset: number, fromDate?: string): string {
  const base = fromDate ? new Date(fromDate) : new Date();
  base.setDate(base.getDate() + daysOffset);
  return base.toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const d = new Date(dateStr);
  return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatPrice(price: number): string {
  return formatIqd(price);
}

/** عرض المدة بالعربية — لا يُقرّب 1.5 إلى 2 */
export function formatDurationAr(hours: number): string {
  const h = Math.round(hours * 1000) / 1000;
  if (Math.abs(h - 1) < 0.01) return "ساعة";
  if (Math.abs(h - 1.5) < 0.01) return "ساعة ونص";
  if (Math.abs(h - 2) < 0.01) return "ساعتين";
  if (Math.abs(h - 3) < 0.01) return "3 ساعات";
  if (Number.isInteger(h) && h > 2) return `${h} ساعات`;
  if (h < 1 && h > 0) return `${h} ساعة`;
  return `${h} ساعة`;
}
