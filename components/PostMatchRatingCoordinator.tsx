import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useBookings, type Booking } from "@/context/BookingsContext";
import { bookingSessionEndUtcMs, isBookingReadyForPostMatchRating } from "@/lib/booking-session-end";
import { PostMatchRatingModal } from "@/components/PostMatchRatingModal";

const DONE_PREFIX = "post_match_rating_done_v1:";
const SNOOZE_PREFIX = "post_match_rating_snooze_until_v1:";
/** يمنع إعادة فتح النافذة فوراً بعد ريلود/تحديث سريع (نفس الحجز ما زال مؤهلاً) */
const LAST_SHOWN_PREFIX = "post_match_rating_last_shown_v1:";
const PROMPT_COOLDOWN_MS = 2 * 60 * 1000;
/** بعد «تخطي»: لا نافذة تقييم حتى يظهر حجز جديد (معرّف غير موجود وقت التخطي) */
const GLOBAL_SUPPRESS_KEY = "post_match_rating_suppress_until_new_booking_v1";
const GLOBAL_SUPPRESS_SNAPSHOT_KEY = "post_match_rating_suppress_snapshot_v1";

type SuppressSnapshot = { userId: string; bookingIds: string[] };

export function PostMatchRatingCoordinator() {
  const { user } = useAuth();
  const { bookings, isLoading } = useBookings();
  const [target, setTarget] = useState<Booking | null>(null);
  const targetRef = useRef<Booking | null>(null);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const pickNext = useCallback(async () => {
    if (!user?.id || user.id === "guest" || user.role !== "player" || isLoading) {
      setTarget(null);
      return;
    }

    const suppressRaw = await AsyncStorage.getItem(GLOBAL_SUPPRESS_KEY);
    if (suppressRaw === "1") {
      let snap: SuppressSnapshot = { userId: "", bookingIds: [] };
      try {
        snap = JSON.parse(
          (await AsyncStorage.getItem(GLOBAL_SUPPRESS_SNAPSHOT_KEY)) || "{}",
        ) as SuppressSnapshot;
      } catch {
        snap = { userId: "", bookingIds: [] };
      }
      if (snap.userId !== user.id) {
        await AsyncStorage.multiRemove([GLOBAL_SUPPRESS_KEY, GLOBAL_SUPPRESS_SNAPSHOT_KEY]);
      } else {
        const baseline = new Set(snap.bookingIds);
        const hasNewBooking = bookings.some((b) => !baseline.has(b.id));
        if (hasNewBooking) {
          await AsyncStorage.multiRemove([GLOBAL_SUPPRESS_KEY, GLOBAL_SUPPRESS_SNAPSHOT_KEY]);
        } else {
          const prev = targetRef.current;
          if (prev && bookings.some((b) => b.id === prev.id)) return;
          setTarget(null);
          return;
        }
      }
    }

    /** بعد اكتمال الحجز + دقيقة بعد نهاية السلوت؛ استبعاد من قيّم فعلياً في Firestore */
    const eligibleEnded = bookings
      .filter(
        (b) =>
          b.status === "completed" &&
          isBookingReadyForPostMatchRating(b) &&
          !b.postMatchRated,
      )
      .sort((a, z) => bookingSessionEndUtcMs(a) - bookingSessionEndUtcMs(z));

    const now = Date.now();
    let chosen: Booking | null = null;

    for (const b of eligibleEnded) {
      const done = await AsyncStorage.getItem(DONE_PREFIX + b.id);
      if (done === "1") continue;
      const snoozeRaw = await AsyncStorage.getItem(SNOOZE_PREFIX + b.id);
      if (snoozeRaw) {
        const t = parseInt(snoozeRaw, 10);
        if (Number.isFinite(t) && now < t) continue;
      }
      const lsRaw = await AsyncStorage.getItem(LAST_SHOWN_PREFIX + b.id);
      const ls = parseInt(lsRaw ?? "", 10);
      if (Number.isFinite(ls) && now - ls < PROMPT_COOLDOWN_MS) continue;
      chosen = b;
      break;
    }

    if (chosen) {
      await AsyncStorage.setItem(LAST_SHOWN_PREFIX + chosen.id, String(now));
      setTarget(chosen);
      return;
    }

    const prev = targetRef.current;
    if (prev && eligibleEnded.some((b) => b.id === prev.id)) {
      return;
    }
    setTarget(null);
  }, [bookings, isLoading, user?.id, user?.role]);

  useEffect(() => {
    void pickNext();
  }, [pickNext]);

  useEffect(() => {
    const id = setInterval(() => void pickNext(), 30_000);
    return () => clearInterval(id);
  }, [pickNext]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void pickNext();
    });
    return () => sub.remove();
  }, [pickNext]);

  const markDone = useCallback(async (bookingId: string) => {
    await AsyncStorage.setItem(DONE_PREFIX + bookingId, "1");
    await AsyncStorage.removeItem(SNOOZE_PREFIX + bookingId);
    await AsyncStorage.removeItem(LAST_SHOWN_PREFIX + bookingId);
  }, []);

  const snooze = useCallback(
    async (bookingId: string) => {
      await AsyncStorage.setItem(SNOOZE_PREFIX + bookingId, String(Date.now() + 6 * 60 * 60 * 1000));
      setTarget(null);
      void pickNext();
    },
    [pickNext],
  );

  const handleSubmitted = useCallback(
    async (bookingId: string) => {
      await markDone(bookingId);
      setTarget(null);
      void pickNext();
    },
    [markDone, pickNext],
  );

  const handleSkipForever = useCallback(
    async (bookingId: string) => {
      const snapshot: SuppressSnapshot = {
        userId: user?.id ?? "",
        bookingIds: bookings.map((b) => b.id),
      };
      await AsyncStorage.multiSet([
        [GLOBAL_SUPPRESS_KEY, "1"],
        [GLOBAL_SUPPRESS_SNAPSHOT_KEY, JSON.stringify(snapshot)],
      ]);
      await markDone(bookingId);
      setTarget(null);
      void pickNext();
    },
    [bookings, markDone, pickNext, user?.id],
  );

  if (!target || !user?.id) return null;

  return (
    <PostMatchRatingModal
      key={target.id}
      visible
      booking={target}
      raterUserId={user.id}
      onRemindLater={() => snooze(target.id)}
      onSkipForever={() => void handleSkipForever(target.id)}
      onSubmitted={() => void handleSubmitted(target.id)}
    />
  );
}
