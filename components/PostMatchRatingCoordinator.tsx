import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useBookings, type Booking } from "@/context/BookingsContext";
import { bookingSessionEndUtcMs, isBookingSessionEnded } from "@/lib/booking-session-end";
import { PostMatchRatingModal } from "@/components/PostMatchRatingModal";

const DONE_PREFIX = "post_match_rating_done_v1:";
const SNOOZE_PREFIX = "post_match_rating_snooze_until_v1:";

export function PostMatchRatingCoordinator() {
  const { user } = useAuth();
  const { bookings, isLoading } = useBookings();
  const [target, setTarget] = useState<Booking | null>(null);

  const pickNext = useCallback(async () => {
    if (!user?.id || user.id === "guest" || user.role !== "player" || isLoading) {
      setTarget(null);
      return;
    }

    /** فقط بعد «إتمام» الحجز في الواجهة (`completed`) وبعد انتهاء وقت الجلسة فعلياً */
    const ended = bookings
      .filter((b) => b.status === "completed" && isBookingSessionEnded(b))
      .sort((a, z) => bookingSessionEndUtcMs(a) - bookingSessionEndUtcMs(z));

    const now = Date.now();
    for (const b of ended) {
      const done = await AsyncStorage.getItem(DONE_PREFIX + b.id);
      if (done === "1") continue;
      const snoozeRaw = await AsyncStorage.getItem(SNOOZE_PREFIX + b.id);
      if (snoozeRaw) {
        const t = parseInt(snoozeRaw, 10);
        if (Number.isFinite(t) && now < t) continue;
      }
      setTarget(b);
      return;
    }
    setTarget(null);
  }, [bookings, isLoading, user?.id, user?.role]);

  useEffect(() => {
    void pickNext();
  }, [pickNext]);

  useEffect(() => {
    const id = setInterval(() => void pickNext(), 60_000);
    return () => clearInterval(id);
  }, [pickNext]);

  const markDone = useCallback(async (bookingId: string) => {
    await AsyncStorage.setItem(DONE_PREFIX + bookingId, "1");
    await AsyncStorage.removeItem(SNOOZE_PREFIX + bookingId);
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
      await markDone(bookingId);
      setTarget(null);
      void pickNext();
    },
    [markDone, pickNext],
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
