/**
 * حجوزات الملاعب — مصدر الحقيقة: مجموعة Firestore `bookings`
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { firebaseConfig } from "@/lib/firebaseConfig";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";
import { assertBookingStartNotInPastLocal } from "@/lib/booking-datetime-guard";

/** يطابق Booking في الواجهة — يُعرَّف هنا لتجنب اعتماد دائري مع السياق */
type UiBookingStatus = "upcoming" | "active" | "completed" | "cancelled";
export type PlayerBookingRow = {
  id: string;
  venueId: string;
  venueName: string;
  fieldSize: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: UiBookingStatus;
  players: { id: string; name: string; paid: boolean }[];
  createdAt: string;
  randomMatchId?: string;
};

export type FirestoreBookingStatus = "confirmed" | "cancelled";
export type FirestoreBookingLifecycleStatus = FirestoreBookingStatus | "pending";

/** لقطة وقت الإلغاء — تُحفَظ في مستند `bookings/{id}` مع الحقول `cancelledAt` و`cancelledWhileUiStatus` */
export type CancellationSnapshot = {
  recordedAtIso: string;
  cancelledWhileUiStatus: Exclude<UiBookingStatus, "cancelled">;
  player: {
    playerUserId: string;
    playerId: string;
    playerName: string;
    phone: string;
  };
  booking: {
    bookingId: string;
    ownerId: string;
    venueId: string;
    venueName: string;
    fieldSize: string;
    date: string;
    startTime: string;
    duration: number;
    pricePerHour: number;
    totalPrice: number;
    paymentMethod: string;
    randomMatchId?: string | null;
    promoCode?: string;
    promoDiscountAmount?: number;
    bookingSubtotalBeforePromo?: number;
    playerLat?: number | null;
    playerLon?: number | null;
  };
  /** لاعبون إضافيون كما في واجهة التطبيق (إن وُجد) */
  uiPlayers?: { id: string; name: string; paid: boolean }[];
};

export type FirestoreBookingDoc = {
  venueId: string;
  ownerId: string;
  /** Firebase Auth UID */
  playerUserId: string;
  /** معرّف التطبيق القصير الثابت (من users.playerId) */
  playerId?: string;
  playerName: string;
  phone: string;
  date: string;
  startTime: string;
  duration: number;
  /** سعر الساعة */
  price: number;
  totalPrice: number;
  paymentMethod: "cash" | "online";
  status: FirestoreBookingLifecycleStatus;
  createdAt?: unknown;
  venueName: string;
  fieldSize: string;
  randomMatchId?: string | null;
  /** موقع اللاعب لحظة الحجز (إن وُجد إذن الموقع) */
  playerLat?: number | null;
  playerLon?: number | null;
  /** عند تطبيق كوبون من التطبيق (Firestore promoCodes) */
  promoCode?: string;
  promoDiscountAmount?: number;
  bookingSubtotalBeforePromo?: number;
  /** وقت الإلغاء (Firestore serverTimestamp) */
  cancelledAt?: unknown;
  /** هل كان الحجز قادماً أو جارياً (أو منتهياً زمنياً) لحظة الإلغاء */
  cancelledWhileUiStatus?: Exclude<UiBookingStatus, "cancelled">;
  /** نسخة ثابتة من بيانات اللاعب والحجز عند الإلغاء */
  cancellationSnapshot?: CancellationSnapshot;
  /** معرّف مستند walletTransactions عند الدفع من المحفظة */
  walletLedgerId?: string;
};

export function isFirebaseBookingsEnabled(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function timeToMinutes(t: string): number {
  const parts = String(t).split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  return h * 60 + m;
}

function rangesOverlapMin(
  startA: string,
  durHoursA: number,
  startB: string,
  durHoursB: number,
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = a0 + durHoursA * 60;
  const b0 = timeToMinutes(startB);
  const b1 = b0 + durHoursB * 60;
  return a0 < b1 && a1 > b0;
}

async function resolveOwnerIdForVenue(venueId: string): Promise<string> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, "fields", venueId));
  if (snap.exists()) {
    const d = snap.data() as Record<string, unknown>;
    const meta =
      d.metadata && typeof d.metadata === "object" && !Array.isArray(d.metadata)
        ? (d.metadata as Record<string, unknown>)
        : undefined;
    const raw = String(
      d.ownerId ?? d.owner_id ?? d.ownerUserId ?? meta?.ownerId ?? meta?.owner_user_id ?? "",
    ).trim();
    if (raw) return raw;
  }
  return venueId;
}

function mapPaymentToFirestore(appMethod: string, paymentPaid: boolean): "cash" | "online" {
  const m = String(appMethod || "").toLowerCase();
  if (m === "cash" || m === "card_venue" || m === "card_at_venue") return "cash";
  return "online";
}

function deriveUiStatus(
  dateYmd: string,
  startTime: string,
  duration: number,
  fs: FirestoreBookingLifecycleStatus,
): UiBookingStatus {
  if (fs === "cancelled") return "cancelled";
  if (fs === "pending") return "upcoming";
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const [th, tm] = startTime.split(":").map(Number);
  const start = new Date(y, mo - 1, d, th, tm || 0, 0, 0);
  const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
  const now = new Date();
  if (now < start) return "upcoming";
  if (now >= start && now < end) return "active";
  return "completed";
}

function docToBooking(id: string, data: FirestoreBookingDoc): PlayerBookingRow {
  const status = deriveUiStatus(data.date, data.startTime, data.duration, data.status);
  const created =
    data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === "function"
      ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
      : new Date().toISOString();
  return {
    id,
    venueId: data.venueId,
    venueName: data.venueName || "ملعب",
    fieldSize: data.fieldSize || "",
    date: data.date,
    time: data.startTime,
    duration: data.duration,
    price: data.totalPrice,
    status,
    players: [{ id: "p_me", name: data.playerName || "لاعب", paid: true }],
    createdAt: created,
    randomMatchId: data.randomMatchId ?? undefined,
  };
}

export async function fetchVenueBookingsForDayFromFirestore(
  venueId: string,
  dateYmd: string,
): Promise<{ time: string; duration: number; status: string }[]> {
  if (!isFirebaseBookingsEnabled() || !venueId || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return [];
  }
  try {
    const db = getFirestoreDb();
    const q = query(
      collection(db, "bookings"),
      where("venueId", "==", venueId),
      where("date", "==", dateYmd),
      where("status", "==", "confirmed"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const x = d.data() as FirestoreBookingDoc;
      return { time: x.startTime, duration: x.duration, status: x.status };
    });
  } catch (e) {
    console.warn("[firestore-bookings] fetchVenueBookingsForDay:", e);
    return [];
  }
}

async function assertNoTimeConflict(
  venueId: string,
  date: string,
  startTime: string,
  duration: number,
): Promise<void> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, "bookings"),
    where("venueId", "==", venueId),
    where("date", "==", date),
  );
  const snap = await getDocs(q);
  const norm = startTime.includes(":") ? startTime : `${String(startTime).padStart(2, "0")}:00`;
  for (const docSnap of snap.docs) {
    const x = docSnap.data() as FirestoreBookingDoc;
    if (x.status !== "confirmed" && x.status !== "pending") continue;
    if (rangesOverlapMin(norm, duration, x.startTime, x.duration)) {
      throw new Error("الوقت محجوز مسبقاً");
    }
  }
}

export type CreateBookingInput = {
  venueId: string;
  playerUserId: string;
  playerId: string;
  playerName: string;
  phone: string;
  date: string;
  startTime: string;
  duration: number;
  /** إجمالي المبلغ (كما في واجهة التطبيق) */
  totalPrice: number;
  venueName: string;
  fieldSize: string;
  appPaymentMethod: string;
  paymentPaid: boolean;
  randomMatchId?: string;
  playerLat?: number | null;
  playerLon?: number | null;
  promoCode?: string;
  promoDiscountAmount?: number;
  bookingSubtotalBeforePromo?: number;
  /** نسخة دعوة لنفس الموعد — لا يُعاد فحص تعارض الملعب (المنظم يملك الحجز الأصلي) */
  skipTimeConflictCheck?: boolean;
};

export async function createBookingInFirestore(input: CreateBookingInput): Promise<string> {
  const db = getFirestoreDb();
  const ownerId = await resolveOwnerIdForVenue(input.venueId);
  const normTime = input.startTime.includes(":")
    ? input.startTime
    : `${String(input.startTime).padStart(2, "0")}:00`;
  const duration = Number(input.duration);
  const totalPrice = Number(input.totalPrice);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("مدة الحجز غير صالحة");
  }
  const pricePerHour = duration > 0 ? Math.round((totalPrice / duration) * 100) / 100 : totalPrice;

  assertBookingStartNotInPastLocal(input.date, normTime);

  if (!input.skipTimeConflictCheck) {
    await assertNoTimeConflict(input.venueId, input.date, normTime, duration);
  }

  const paymentMethod = mapPaymentToFirestore(input.appPaymentMethod, input.paymentPaid);

  const payload: Omit<FirestoreBookingDoc, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    venueId: input.venueId,
    ownerId,
    playerUserId: input.playerUserId,
    playerId: input.playerId?.trim() ?? "",
    playerName: input.playerName.trim() || "لاعب",
    phone: String(input.phone ?? "").replace(/\s+/g, "") || "",
    date: input.date,
    startTime: normTime,
    duration,
    price: pricePerHour,
    totalPrice,
    paymentMethod,
    status: "confirmed",
    venueName: input.venueName,
    fieldSize: input.fieldSize,
    createdAt: serverTimestamp(),
  };
  if (input.randomMatchId) {
    (payload as FirestoreBookingDoc).randomMatchId = input.randomMatchId;
  }
  if (
    input.playerLat != null &&
    input.playerLon != null &&
    Number.isFinite(input.playerLat) &&
    Number.isFinite(input.playerLon)
  ) {
    (payload as FirestoreBookingDoc).playerLat = input.playerLat;
    (payload as FirestoreBookingDoc).playerLon = input.playerLon;
  }
  const code = String(input.promoCode ?? "").trim().toUpperCase();
  if (code && input.promoDiscountAmount != null && input.bookingSubtotalBeforePromo != null) {
    (payload as FirestoreBookingDoc).promoCode = code;
    (payload as FirestoreBookingDoc).promoDiscountAmount = Math.round(
      Number(input.promoDiscountAmount),
    );
    (payload as FirestoreBookingDoc).bookingSubtotalBeforePromo = Math.round(
      Number(input.bookingSubtotalBeforePromo),
    );
  }

  const ref = await addDoc(collection(db, "bookings"), payload);
  const newId = ref.id;
  void mirrorBookingToApi({
    id: newId,
    venueId: input.venueId,
    ownerId,
    playerUserId: input.playerUserId,
    playerId: input.playerId?.trim() ?? "",
    playerName: payload.playerName,
    phone: payload.phone,
    date: input.date,
    startTime: normTime,
    duration,
    price: pricePerHour,
    totalPrice,
    paymentMethod,
    status: "confirmed",
    venueName: input.venueName,
    fieldSize: input.fieldSize,
    ...(input.playerLat != null &&
    input.playerLon != null &&
    Number.isFinite(input.playerLat) &&
    Number.isFinite(input.playerLon)
      ? { playerLat: input.playerLat, playerLon: input.playerLon }
      : {}),
    ...(code && input.promoDiscountAmount != null && input.bookingSubtotalBeforePromo != null
      ? {
          promoCode: code,
          promoDiscountAmount: Math.round(Number(input.promoDiscountAmount)),
          bookingSubtotalBeforePromo: Math.round(
            Number(input.bookingSubtotalBeforePromo),
          ),
        }
      : {}),
  });
  return newId;
}

export async function createPendingBookingInFirestore(
  input: CreateBookingInput,
): Promise<string> {
  const db = getFirestoreDb();
  const ownerId = await resolveOwnerIdForVenue(input.venueId);
  const normTime = input.startTime.includes(":")
    ? input.startTime
    : `${String(input.startTime).padStart(2, "0")}:00`;
  const duration = Number(input.duration);
  const totalPrice = Number(input.totalPrice);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("مدة الحجز غير صالحة");
  }
  const pricePerHour = duration > 0 ? Math.round((totalPrice / duration) * 100) / 100 : totalPrice;

  assertBookingStartNotInPastLocal(input.date, normTime);

  if (!input.skipTimeConflictCheck) {
    await assertNoTimeConflict(input.venueId, input.date, normTime, duration);
  }

  const payload: Omit<FirestoreBookingDoc, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    venueId: input.venueId,
    ownerId,
    playerUserId: input.playerUserId,
    playerId: input.playerId?.trim() ?? "",
    playerName: input.playerName.trim() || "لاعب",
    phone: String(input.phone ?? "").replace(/\s+/g, "") || "",
    date: input.date,
    startTime: normTime,
    duration,
    price: pricePerHour,
    totalPrice,
    paymentMethod: "online",
    status: "pending",
    venueName: input.venueName,
    fieldSize: input.fieldSize,
    createdAt: serverTimestamp(),
  };
  if (input.randomMatchId) {
    payload.randomMatchId = input.randomMatchId;
  }
  if (
    input.playerLat != null &&
    input.playerLon != null &&
    Number.isFinite(input.playerLat) &&
    Number.isFinite(input.playerLon)
  ) {
    (payload as FirestoreBookingDoc).playerLat = input.playerLat;
    (payload as FirestoreBookingDoc).playerLon = input.playerLon;
  }
  const code = String(input.promoCode ?? "").trim().toUpperCase();
  if (code && input.promoDiscountAmount != null && input.bookingSubtotalBeforePromo != null) {
    (payload as FirestoreBookingDoc).promoCode = code;
    (payload as FirestoreBookingDoc).promoDiscountAmount = Math.round(Number(input.promoDiscountAmount));
    (payload as FirestoreBookingDoc).bookingSubtotalBeforePromo = Math.round(
      Number(input.bookingSubtotalBeforePromo),
    );
  }
  const ref = await addDoc(collection(db, "bookings"), payload);
  return ref.id;
}

export async function confirmBookingPaymentInFirestore(
  bookingId: string,
  extras?: { transactionId?: string; checkoutUrl?: string; walletLedgerId?: string },
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("الحجز غير موجود");
  await updateDoc(ref, {
    status: "confirmed" as FirestoreBookingStatus,
    paymentMethod: "online",
    ...(extras?.transactionId ? { paymentTransactionId: extras.transactionId } : {}),
    ...(extras?.checkoutUrl ? { paymentCheckoutUrl: extras.checkoutUrl } : {}),
    ...(extras?.walletLedgerId ? { walletLedgerId: extras.walletLedgerId } : {}),
    paidAt: serverTimestamp(),
  });
}

export async function failPendingBookingPaymentInFirestore(
  bookingId: string,
  reason?: string,
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as FirestoreBookingDoc;
  if (data.status !== "pending") return;
  await updateDoc(ref, {
    status: "cancelled" as FirestoreBookingStatus,
    cancelledAt: serverTimestamp(),
    cancellationReason: reason || "payment_validation_failed",
  });
}

function buildCancellationSnapshot(
  bookingId: string,
  data: FirestoreBookingDoc,
  cancelledWhileUiStatus: Exclude<UiBookingStatus, "cancelled">,
  uiPlayers?: { id: string; name: string; paid: boolean }[],
): CancellationSnapshot {
  const snap: CancellationSnapshot = {
    recordedAtIso: new Date().toISOString(),
    cancelledWhileUiStatus,
    player: {
      playerUserId: data.playerUserId,
      playerId: String(data.playerId ?? "").trim(),
      playerName: data.playerName,
      phone: data.phone,
    },
    booking: {
      bookingId,
      ownerId: data.ownerId,
      venueId: data.venueId,
      venueName: data.venueName,
      fieldSize: data.fieldSize,
      date: data.date,
      startTime: data.startTime,
      duration: data.duration,
      pricePerHour: data.price,
      totalPrice: data.totalPrice,
      paymentMethod: data.paymentMethod,
      randomMatchId: data.randomMatchId ?? null,
      playerLat: data.playerLat ?? null,
      playerLon: data.playerLon ?? null,
    },
  };
  if (data.promoCode) {
    snap.booking.promoCode = data.promoCode;
    if (data.promoDiscountAmount != null) snap.booking.promoDiscountAmount = data.promoDiscountAmount;
    if (data.bookingSubtotalBeforePromo != null) {
      snap.booking.bookingSubtotalBeforePromo = data.bookingSubtotalBeforePromo;
    }
  }
  if (uiPlayers?.length) {
    snap.uiPlayers = uiPlayers.map((p) => ({ id: p.id, name: p.name, paid: p.paid }));
  }
  return snap;
}

export async function cancelBookingInFirestore(
  bookingId: string,
  playerUserId: string,
  options?: {
    uiPlayers?: { id: string; name: string; paid: boolean }[];
    phoneForMirror?: string;
  },
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("الحجز غير موجود");
  const data = snap.data() as FirestoreBookingDoc;
  if (data.playerUserId !== playerUserId) {
    throw new Error("غير مصرح بإلغاء هذا الحجز");
  }
  if (data.status === "cancelled") return;

  /** لحظة الإلغاء: هل كان الحجز ما يزال «قادماً» أم «جارياً» أم انتهى زمنياً */
  const whileStatus = deriveUiStatus(
    data.date,
    data.startTime,
    data.duration,
    "confirmed",
  ) as Exclude<UiBookingStatus, "cancelled">;

  const cancellationSnapshot = buildCancellationSnapshot(
    bookingId,
    data,
    whileStatus,
    options?.uiPlayers,
  );

  await updateDoc(ref, {
    status: "cancelled" as FirestoreBookingStatus,
    cancelledAt: serverTimestamp(),
    cancelledWhileUiStatus: whileStatus,
    cancellationSnapshot,
  });

  void mirrorCancellationToApi(bookingId, playerUserId, options?.phoneForMirror, {
    cancelledWhileUiStatus: whileStatus,
    cancellationSnapshot,
  });
}

export async function updateBookingRandomMatchId(
  bookingId: string,
  playerUserId: string,
  randomMatchId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, "bookings", bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as FirestoreBookingDoc;
  if (data.playerUserId !== playerUserId) return;
  await updateDoc(ref, { randomMatchId });
}

export async function fetchPlayerBookingsFromFirestore(
  playerUserId: string,
): Promise<PlayerBookingRow[]> {
  if (!playerUserId?.trim()) return [];
  try {
    const db = getFirestoreDb();
    const q = query(collection(db, "bookings"), where("playerUserId", "==", playerUserId.trim()));
    const snap = await getDocs(q);
    const rows = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as FirestoreBookingDoc }))
      .filter((x) => x.data.status !== "pending")
      .map((x) => docToBooking(x.id, x.data));
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.time < b.time ? 1 : -1));
    return rows;
  } catch (e) {
    console.warn("[firestore-bookings] fetchPlayerBookings failed:", e);
    return [];
  }
}

export function subscribePlayerBookings(
  playerUserId: string,
  onNext: (bookings: PlayerBookingRow[]) => void,
  onError?: (e: unknown) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const qSimple = query(
    collection(db, "bookings"),
    where("playerUserId", "==", playerUserId.trim()),
  );
  return onSnapshot(
    qSimple,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, data: d.data() as FirestoreBookingDoc }))
        .filter((x) => x.data.status !== "pending")
        .map((x) => docToBooking(x.id, x.data));
      rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.time < b.time ? 1 : -1));
      onNext(rows);
    },
    onError,
  );
}

/** مرآة اختيارية للخادم — Firestore يبقى المصدر الرسمي */
export async function mirrorBookingToApi(payload: Record<string, unknown>): Promise<void> {
  const base = getResolvedApiBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* non-fatal */
  }
}

async function mirrorCancellationToApi(
  bookingId: string,
  playerUserId: string,
  phone: string | undefined,
  body: {
    cancelledWhileUiStatus: Exclude<UiBookingStatus, "cancelled">;
    cancellationSnapshot: CancellationSnapshot;
  },
): Promise<void> {
  const base = getResolvedApiBaseUrl();
  if (!base) return;
  const qs = new URLSearchParams();
  if (playerUserId.trim()) qs.set("playerUserId", playerUserId.trim());
  const ph = String(phone ?? "").trim();
  if (ph) qs.set("phone", ph);
  if (!qs.toString()) return;
  try {
    await fetch(`${base}/api/bookings/${encodeURIComponent(bookingId)}?${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        status: "cancelled",
        cancelledWhileUiStatus: body.cancelledWhileUiStatus,
        cancellationSnapshot: body.cancellationSnapshot,
      }),
    });
  } catch {
    /* non-fatal */
  }
}
