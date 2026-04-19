import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
  ImageBackground,
  Animated,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useGuestPrompt } from "@/context/GuestPromptContext";
import {
  TIME_SLOTS,
  useBookings,
  formatPrice,
  formatDate,
  formatDurationAr,
  Booking,
  Venue,
} from "@/context/BookingsContext";
import {
  getExperimentalVenueById,
  isExperimentalVenueId,
  SERVICE_ICONS,
  type VenueWithMeta,
} from "@/constants/experimentalVenues";
import { fetchVenueById, fetchVenueBookingsForDay } from "@/lib/app-data";
import { GUEST_FULL_ACCESS } from "@/constants/guestAccess";
import { useLocation } from "@/context/LocationContext";
import { haversineKm } from "@/lib/distance";
import {
  getHourlyRate,
  getFieldPriceForDuration,
  getPricingTableRows,
  applyVenueDiscountToFieldPrice,
} from "@/lib/venue-pricing";
import {
  getScheduleWindowsForDay,
  isRangeInsideScheduleWindows,
} from "@/lib/venue-field-metadata";
import {
  useRandomMatch,
  RANDOM_MATCH_MAX_PLAYERS,
  type RandomMatchItem,
} from "@/context/RandomMatchContext";
import { applyPromoCodeFromFirestore } from "@/lib/firestore-promo";
import { useLang } from "@/context/LanguageContext";
import {
  formatLocalDateKey,
  isBookingWallStartInPastForLocalCalendarDate,
} from "@/lib/booking-datetime-guard";

/** يتوافق مع Date.getDay(): 0 = الأحد … 6 = السبت */
const JS_DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** مدة الحجز: ساعة، ساعة ونص، ساعتين، 3 ساعات */
const DURATION_OPTIONS = [
  { value: 1, label: "ساعة" },
  { value: 1.5, label: "ساعة ونص" },
  { value: 2, label: "ساعتين" },
  { value: 3, label: "3 ساعات" },
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function addDuration(time: string, hours: number): string {
  return minutesToTime(timeToMinutes(time) + hours * 60);
}
/** 30-min slots covered by a booking starting at time with duration (hours) */
function getSlotsCovered30(time: string, durationHours: number): string[] {
  const startMin = timeToMinutes(time);
  const endMin = startMin + durationHours * 60;
  const out: string[] = [];
  for (let m = startMin; m < endMin; m += 30) {
    out.push(minutesToTime(m));
  }
  return out;
}
/** 30-min slots in [from, toExclusive) */
function getSlotsInRange30(from: string, toExclusive: string): string[] {
  const startMin = timeToMinutes(from);
  const endMin = timeToMinutes(toExclusive);
  const out: string[] = [];
  for (let m = startMin; m < endMin; m += 30) {
    out.push(minutesToTime(m));
  }
  return out;
}

function generateDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayName = JS_DAY_NAMES_AR[d.getDay()];
    const dayNum = d.getDate();
    dates.push({
      label: `${dayName}\n${dayNum}`,
      value: formatLocalDateKey(d),
    });
  }
  return dates;
}

function normalizeRouteId(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return "";
}

function isTruthyRouteFlag(raw: string | string[] | undefined): boolean {
  const v = normalizeRouteId(raw).toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export default function VenueDetailScreen() {
  const queryClient = useQueryClient();
  const { id: idParam, onlinePaymentOnly, fromRandomMatch } = useLocalSearchParams<{
    id?: string | string[];
    onlinePaymentOnly?: string;
    fromRandomMatch?: string;
  }>();
  const id = normalizeRouteId(idParam);
  /** تقييد نادر: دفع من التطبيق فقط (مثلاً روابط خارجية) */
  const fromRandomMatchFlow = isTruthyRouteFlag(fromRandomMatch as string | string[] | undefined);
  const restrictToOnlinePayment =
    isTruthyRouteFlag(onlinePaymentOnly as string | string[] | undefined) || fromRandomMatchFlow;
  /** من شاشة «إنشاء مباراة عشوائية» — يُضاف الحجز لقائمة المباريات العشوائية */
  
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { bookings, addBooking, updateBooking } = useBookings();
  const { addMatch } = useRandomMatch();
  const { isGuest, user } = useAuth();
  const { promptLogin } = useGuestPrompt();
  const { t } = useLang();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  type PayMethod = "cash" | "card_venue" | "transfer" | null;
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>(null);
  const [showSuccessShare, setShowSuccessShare] = useState(false);
  const [shareBundle, setShareBundle] = useState<{
    venueId: string;
    venueName: string;
    fieldSize: string;
    date: string;
    time: string;
    duration: number;
    price: number;
    bookingId: string;
    match: RandomMatchItem | null;
  } | null>(null);

  const dates = generateDates();

  const [selectedDate, setSelectedDate] = useState(dates[0].value);
  /** يُحدَّث كل 30ث لتصفية أوقات اليوم التي انتهت دون إعادة فتح الشاشة */
  const [bookingClockTick, setBookingClockTick] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoLocked, setPromoLocked] = useState(false);
  const [promoState, setPromoState] = useState<{
    valid: boolean;
    message: string;
    discountAmount: number;
    finalPrice: number;
    appliedCode?: string;
  } | null>(null);
  const priceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setBookingClockTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const isExp = id ? isExperimentalVenueId(id) : false;
  const expVenue = id ? getExperimentalVenueById(id) : null;
  const sbVenueEnabled = !!id && !isExp;

  const { data: sbVenue, isPending: sbPending } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => fetchVenueById(id),
    enabled: sbVenueEnabled,
    retry: false,
    staleTime: 30_000,
    /** نفس صف الملعب من الشاشة الرئيسية/البحث — يظهر فوراً ثم يُحدَّث من الشبكة عند الحاجة */
    initialData: () =>
      queryClient.getQueryData<Venue[]>(["venues", "fields"])?.find((v) => v.id === id),
  });

  const venue: VenueWithMeta | Venue | undefined = isExp
    ? expVenue ?? undefined
    : sbVenueEnabled
      ? (sbVenue ?? undefined)
      : undefined;

  const [selectedPaidIds, setSelectedPaidIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedPaidIds([]);
  }, [venue?.id]);

  const hourlyRate = useMemo(() => (venue ? getHourlyRate(venue) : 0), [venue]);

  const pricingRows = useMemo(() => (venue ? getPricingTableRows(venue) : []), [venue]);

  const paidExtrasTotal = useMemo(() => {
    if (!venue?.paidServiceOptions?.length) return 0;
    const sel = new Set(selectedPaidIds);
    return venue.paidServiceOptions
      .filter((o) => sel.has(o.id))
      .reduce((s, o) => s + o.price, 0);
  }, [venue, selectedPaidIds]);

  const fieldRentalBasePrice = useMemo(() => {
    if (!venue) return 0;
    return getFieldPriceForDuration(venue, selectedDuration);
  }, [venue, selectedDuration]);

  const fieldDiscountMeta = useMemo(
    () =>
      venue
        ? applyVenueDiscountToFieldPrice(venue, selectedTime, fieldRentalBasePrice)
        : { final: 0, percentApplied: 0 },
    [venue, selectedTime, fieldRentalBasePrice],
  );

  const fieldRentalPrice = fieldDiscountMeta.final;

  const totalPrice = useMemo(
    () => fieldRentalPrice + paidExtrasTotal,
    [fieldRentalPrice, paidExtrasTotal],
  );

  const amountToCharge = promoState?.valid ? promoState.finalPrice : totalPrice;

  useEffect(() => {
    setPromoState(null);
    setPromoInput("");
    setPromoLocked(false);
  }, [totalPrice]);

  useEffect(() => {
    if (!showPaymentModal) {
      setPromoState(null);
      setPromoInput("");
      setPromoLocked(false);
    }
  }, [showPaymentModal]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(priceScale, {
        toValue: 1.05,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(priceScale, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [amountToCharge, priceScale]);

  const { data: dayBookingsSb = [] } = useQuery({
    queryKey: ["venue-day", id, selectedDate],
    queryFn: () => fetchVenueBookingsForDay(id, selectedDate),
    enabled: !!id && !isExp,
  });

  useEffect(() => {
    if (venue && !selectedSize) {
      setSelectedSize(venue.fieldSizes[0] ?? "");
    }
  }, [venue, selectedSize]);

  useEffect(() => {
    if (showPaymentModal && restrictToOnlinePayment) {
      setPaymentMethod(null);
    }
  }, [showPaymentModal, restrictToOnlinePayment]);

  /** لا تعتمد على `!sbVenue` أثناء التحميل — `data` تكون undefined حتى يكتمل الطلب */
  const isLoading = !isExp && sbVenueEnabled && sbPending;
  const isServerVenueMissing = !isExp && sbVenueEnabled && !sbPending && !sbVenue;
  const isExpNotFound = isExp && !expVenue;

  const bookedSlots30 = useMemo(() => {
    if (!id) return new Set<string>();
    const set = new Set<string>();
    dayBookingsSb.forEach((b) => {
      getSlotsCovered30(b.time, b.duration).forEach((s) => set.add(s));
    });
    const active = bookings.filter(
      (b) =>
        b.venueId === id &&
        b.date === selectedDate &&
        (b.status === "upcoming" || b.status === "active")
    );
    active.forEach((b) => {
      getSlotsCovered30(b.time, b.duration).forEach((s) => set.add(s));
    });
    return set;
  }, [id, selectedDate, bookings, dayBookingsSb]);

  useEffect(() => {
    if (!selectedTime) return;
    const end = addDuration(selectedTime, selectedDuration);
    if (timeToMinutes(end) > 24 * 60) {
      setSelectedTime(null);
      return;
    }
    const range = getSlotsInRange30(selectedTime, end);
    const ok =
      range.length > 0 && range.every((s) => !bookedSlots30.has(s));
    if (!ok) setSelectedTime(null);
  }, [selectedDuration, selectedTime, bookedSlots30]);

  const scheduleWindows = useMemo(() => {
    if (!venue) return null as string[] | null;
    return getScheduleWindowsForDay(venue.scheduleSlotsByDay, selectedDate);
  }, [venue, selectedDate]);

  /** أوقات البداية المسموحة ضمن نفس اليوم حسب المدة المختارة وجدول الملعب */
  const slotsForDuration = useMemo(() => {
    return TIME_SLOTS.filter((slot) => {
      const end = addDuration(slot, selectedDuration);
      if (timeToMinutes(end) > 24 * 60) return false;
      if (scheduleWindows != null) {
        if (scheduleWindows.length === 0) return false;
        if (!isRangeInsideScheduleWindows(slot, end, scheduleWindows)) return false;
      }
      return true;
    });
  }, [selectedDuration, scheduleWindows]);

  /** تعارض مع حجز موجود (بدون فحص «الوقت مضى» — يُعرَض في الشبكة بشكل منفصل) */
  const slotHasBookingOverlap = useMemo(() => {
    return (slot: string) => {
      const end = addDuration(slot, selectedDuration);
      if (timeToMinutes(end) > 24 * 60) return true;
      const range = getSlotsInRange30(slot, end);
      return !(range.length > 0 && range.every((s) => !bookedSlots30.has(s)));
    };
  }, [bookedSlots30, selectedDuration]);

  useEffect(() => {
    if (!selectedTime) return;
    if (!slotsForDuration.includes(selectedTime)) setSelectedTime(null);
  }, [slotsForDuration, selectedTime]);

  useEffect(() => {
    if (!selectedTime) return;
    if (isBookingWallStartInPastForLocalCalendarDate(selectedDate, selectedTime)) {
      setSelectedTime(null);
    }
  }, [selectedDate, selectedTime, bookingClockTick]);

  const { latitude, longitude, hasPermission } = useLocation();
  const meta = (venue ?? {}) as VenueWithMeta;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: topPadding, backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isExpNotFound || isServerVenueMissing || !venue) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: topPadding, backgroundColor: colors.background }]}>
        <Pressable style={[styles.backBtnTop, { backgroundColor: colors.surface }]} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Ionicons name="football-outline" size={52} color={colors.textTertiary} />
        <Text style={{ color: colors.text, fontSize: 17, fontFamily: "Cairo_700Bold", marginTop: 12 }}>
          الملعب غير موجود
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: "Cairo_400Regular", marginTop: 6 }}>
          ربما تم حذف الملعب أو تغيير بياناته
        </Text>
      </View>
    );
  }

  const endTime = selectedTime ? addDuration(selectedTime, selectedDuration) : null;
  const rangeSlots30 = selectedTime && endTime && timeToMinutes(endTime) <= 24 * 60 ? getSlotsInRange30(selectedTime, endTime) : [];
  const selectedStartNotPast =
    !!selectedTime &&
    !isBookingWallStartInPastForLocalCalendarDate(selectedDate, selectedTime);
  const isRangeAvailable =
    selectedStartNotPast &&
    rangeSlots30.length > 0 &&
    rangeSlots30.every((s) => !bookedSlots30.has(s));

  const handlePayAndBook = () => {
    if (isGuest && !GUEST_FULL_ACCESS) {
      promptLogin();
      return;
    }
    if (!selectedTime) {
      Alert.alert("اختر وقتًا", "الرجاء اختيار وقت البداية (من) للحجز");
      return;
    }
    if (isBookingWallStartInPastForLocalCalendarDate(selectedDate, selectedTime)) {
      Alert.alert(
        "الوقت غير صالح",
        "لا يمكن حجز وقت قد مضى اليوم. اختر ساعة لاحقة أو يوماً آخر.",
      );
      return;
    }
    if (!isRangeAvailable) {
      Alert.alert(
        "الوقت غير متاح",
        "الفترة من " + selectedTime + " إلى " + endTime + " تتقاطع مع حجز موجود. اختر وقتًا آخر أو مدة أقل."
      );
      return;
    }
    setPaymentMethod("cash");
    setShowPaymentModal(true);
  };

  const handleApplyPromo = async () => {
    if (!venue || isExp) return;
    if (isGuest && !GUEST_FULL_ACCESS) {
      promptLogin();
      return;
    }
    if (promoLocked || promoState?.valid) {
      return;
    }
    const code = promoInput.trim();
    if (!code) {
      setPromoState({
        valid: false,
        message: "Invalid code",
        discountAmount: 0,
        finalPrice: totalPrice,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!user?.id || user.id === "guest") {
      Alert.alert("تسجيل الدخول", "سجّل الدخول لاستخدام الكوبون");
      return;
    }
    setPromoLoading(true);
    setPromoState(null);
    try {
      const res = await applyPromoCodeFromFirestore(promoInput, totalPrice);
      if (res.ok) {
        setPromoState({
          valid: true,
          message: res.message,
          discountAmount: res.discountAmount,
          finalPrice: res.finalPrice,
          appliedCode: res.appliedCode,
        });
        setPromoLocked(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setPromoState({
          valid: false,
          message: res.message,
          discountAmount: 0,
          finalPrice: totalPrice,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setPromoState({
        valid: false,
        message: "Server error",
        discountAmount: 0,
        finalPrice: totalPrice,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!paymentMethod) {
      Alert.alert("اختر طريقة الدفع", "الرجاء اختيار طريقة الدفع أو الحجز بدون دفع مسبق");
      return;
    }
    if (!venue || !selectedTime || !isRangeAvailable) return;
    if (isBookingWallStartInPastForLocalCalendarDate(selectedDate, selectedTime)) {
      setShowPaymentModal(false);
      Alert.alert(
        "الوقت غير صالح",
        "انتهى وقت الحجز المختار. اختر وقتاً قادماً ثم أعد المحاولة.",
      );
      return;
    }

    // الدفع الإلكتروني من الفاتورة يوجّه مباشرةً إلى بوابة Wayl عبر شاشة pay-card.
    if (paymentMethod === "transfer") {
      setShowPaymentModal(false);
      router.push({
        pathname: "/booking/pay-card",
        params: {
          amount: String(amountToCharge),
          venueId: String(venue.id),
          venueName: venue.name,
          date: selectedDate,
          time: selectedTime,
          duration: String(selectedDuration),
          fieldSize: selectedSize,
          ...(fromRandomMatchFlow || restrictToOnlinePayment ? { fromRandomMatch: "1" } : {}),
        },
      });
      return;
    }

    const payAtVenue = paymentMethod === "cash" || paymentMethod === "card_venue";
    const methodKey =
      paymentMethod === "cash"
        ? "cash"
        : paymentMethod === "card_venue"
          ? "card_at_venue"
          : "transfer";
    const paymentPaid = !payAtVenue;

    setIsBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((res) => setTimeout(res, payAtVenue ? 350 : 900));

    const newBooking: Booking = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      venueId: venue.id,
      venueName: venue.name,
      fieldSize: selectedSize,
      date: selectedDate,
      time: selectedTime,
      duration: selectedDuration,
      price: amountToCharge,
      status: "upcoming",
      players: [{ id: "p_me", name: "أنا", paid: paymentPaid }],
      createdAt: new Date().toISOString(),
    };
    let savedBooking: Booking;
    try {
      savedBooking = await addBooking(newBooking, {
        paymentMethod: methodKey,
        paymentPaid,
        ...(promoState?.valid && promoState.appliedCode
          ? {
              promo: {
                code: promoState.appliedCode,
                discountAmount: promoState.discountAmount,
                bookingSubtotalBeforePromo: totalPrice,
              },
            }
          : {}),
      });
      if (id && !isExp) {
        queryClient.invalidateQueries({ queryKey: ["venue-day", id] });
      }
    } catch (e) {
      setIsBooking(false);
      Alert.alert(
        "تعذر الحجز",
        e instanceof Error ? e.message : "تحقق من الاتصال وصلاحيات قاعدة البيانات"
      );
      return;
    }
    if (fromRandomMatchFlow) {
      const matchItem = addMatch({
        venueId: venue.id,
        venueName: venue.name,
        time: selectedTime,
        date: selectedDate,
        totalPrice: amountToCharge,
        maxPlayers: RANDOM_MATCH_MAX_PLAYERS,
        pricingMode: "split",
        organizerName: user?.name,
        durationHours: selectedDuration,
        fieldSize: selectedSize,
        bookingId: savedBooking.id,
      });
      updateBooking(savedBooking.id, { randomMatchId: matchItem.id });
      setShareBundle({
        venueId: venue.id,
        venueName: venue.name,
        fieldSize: selectedSize,
        date: selectedDate,
        time: selectedTime,
        duration: selectedDuration,
        price: amountToCharge,
        bookingId: savedBooking.id,
        match: matchItem,
      });
    } else {
      setShareBundle({
        venueId: venue.id,
        venueName: venue.name,
        fieldSize: selectedSize,
        date: selectedDate,
        time: selectedTime,
        duration: selectedDuration,
        price: amountToCharge,
        bookingId: savedBooking.id,
        match: null,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsBooking(false);
    setShowPaymentModal(false);
    setPaymentMethod(null);
    setPromoState(null);
    setPromoInput("");
    setPromoLocked(false);
    setShowSuccessShare(true);
  };

  const handleShareBooking = async () => {
    if (!shareBundle) return;
    const { venueName, fieldSize, date, time, duration, price } = shareBundle;
    const dateStr = formatDate(date);
    const message = t("booking.shareMessage", {
      venue: venueName,
      date: dateStr,
      time,
      duration: formatDurationAr(duration),
      field: fieldSize?.trim() ? fieldSize : "—",
      price: formatPrice(price),
    });
    try {
      await Share.share({
        message,
        title: t("booking.shareTitle"),
      });
    } catch {
      /* إلغاء المشاركة */
    }
  };

  const distanceKmComputed =
    venue && hasPermission === true
      ? haversineKm(latitude, longitude, venue.lat, venue.lon)
      : undefined;
  const distanceKm =
    meta.distanceKm != null
      ? `${meta.distanceKm.toFixed(2)} كم`
      : distanceKmComputed != null
        ? distanceKmComputed > 400
          ? "—"
          : `${distanceKmComputed.toFixed(2)} كم`
        : "—";
  const description = meta.description ?? "ملعب خماسي";
  const venueImage = String(meta.image ?? "").trim();

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>تفاصيل الملعب</Text>
        <Pressable style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={colors.text} />
          <Text style={[styles.shareText, { color: colors.text }]}>مشاركة</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 100 }]}
        showsVerticalScrollIndicator
        bounces
        nestedScrollEnabled
        {...(Platform.OS === "android" ? { overScrollMode: "always" as const } : {})}
      >
        <View style={[styles.venueHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {venueImage ? (
            <ImageBackground
              source={{ uri: venueImage }}
              style={styles.venueHeroImage}
              imageStyle={styles.venueHeroImageStyle}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.venueHeroImage, { backgroundColor: venue.imageColor }]} />
          )}
        </View>

        <View style={[styles.greenCard, { backgroundColor: colors.primary }]}>
          <View style={styles.greenCardRow}>
            <View style={styles.greenCardLabelWrap}>
              <Ionicons name="location" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greenCardLabel}>يبعد عنك:</Text>
            </View>
            <Text style={styles.greenCardValue}>{distanceKm}</Text>
          </View>
          <View style={styles.greenCardRow}>
            <View style={styles.greenCardLabelWrap}>
              <Ionicons name="wallet-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.greenCardLabel}>سعر الحجز:</Text>
            </View>
            <Text style={styles.greenCardValue}>
              {hourlyRate > 0
                ? `${formatPrice(hourlyRate)} / hr`
                : pricingRows.some((r) => r.amount > 0)
                  ? "بالجدول ↓"
                  : "—"}
            </Text>
          </View>
        </View>

        {pricingRows.some((r) => r.amount > 0) && (
          <View
            style={[
              styles.pricingGridCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.pricingGridHeader}>
              <Ionicons name="pricetags-outline" size={15} color={colors.primary} />
              <Text style={[styles.pricingGridTitle, { color: colors.text }]}>أسعار المدد</Text>
            </View>
            <View style={styles.pricingGridWrap}>
              {pricingRows
                .filter((r) => r.amount > 0)
                .map((row) => (
                  <View
                    key={row.key}
                    style={[
                      styles.pricingCellGrid,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[styles.pricingCellLabel, { color: colors.textSecondary }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.pricingCellAmount, { color: colors.primary }]}>
                      {formatPrice(row.amount)}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {venue.discountWindow && venue.discountWindow.percent > 0 ? (
          <View
            style={[
              styles.discountBanner,
              { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
          >
            <Ionicons name="pricetag" size={18} color={colors.primary} />
            <Text style={[styles.discountBannerText, { color: colors.text }]}>
              خصم {venue.discountWindow.percent}% على إيجار الملعب للحجوزات التي تبدأ بين{" "}
              {venue.discountWindow.timeFrom} و {venue.discountWindow.timeTo}
            </Text>
          </View>
        ) : null}

        {restrictToOnlinePayment && (
          <View style={[styles.onlineOnlyBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
            <Text style={[styles.onlineOnlyBannerText, { color: colors.textSecondary }]}>
              الدفع من التطبيق فقط: بطاقة إلكترونية أو محفظة (لا يتوفر الدفع عند الملعب من هذا المسار)
            </Text>
          </View>
        )}
        {fromRandomMatchFlow && (
          <View style={[styles.onlineOnlyBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="shuffle-outline" size={18} color={colors.primary} />
            <Text style={[styles.onlineOnlyBannerText, { color: colors.textSecondary }]}>
              Random match: Pay Now (card) from the app only.
            </Text>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={[styles.detailVenueName, { color: colors.text }]}>{venue.name}</Text>
          <View style={styles.detailMetaRow}>
            <View style={[styles.sizePillDetail, { borderColor: colors.primary }]}>
              <Text style={[styles.sizePillText, { color: colors.primary }]}>{venue.fieldSizes[0] ?? "5x5"}</Text>
            </View>
            <Text style={[styles.reviewCountText, { color: colors.textSecondary }]}>[{venue.reviewCount} تقييم]</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < Math.floor(venue.rating) ? "star" : "star-outline"}
                  size={16}
                  color="#FFD700"
                />
              ))}
            </View>
          </View>
          <View style={styles.sportRow}>
            <Ionicons name="football" size={18} color={colors.primary} />
            <Text style={[styles.sportText, { color: colors.primary }]}>كرة قدم</Text>
          </View>
          <View style={styles.detailLocationRow}>
            <Ionicons name="location" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailLocationText, { color: colors.textSecondary }]}>{venue.location}</Text>
            <Ionicons name="chevron-back" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailDistanceText, { color: colors.textSecondary }]}>{distanceKm}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>وصف الملعب</Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{description}</Text>
        </View>

        <View style={[styles.section, styles.servicesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>الخدمات المتوفرة</Text>
          {venue.amenities.length === 0 ? (
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              لا توجد خدمات مسجّلة ضمن البيانات لهذا الملعب.
            </Text>
          ) : (
            <View style={styles.servicesGrid}>
              {venue.amenities.map((a) => {
                const iconName = SERVICE_ICONS[a] ?? "ellipse";
                return (
                  <View key={a} style={[styles.serviceChip, { backgroundColor: colors.card }]}>
                    <Ionicons name={iconName as any} size={18} color={colors.primary} />
                    <Text style={[styles.serviceChipText, { color: colors.text }]}>{a}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {(venue.paidServiceOptions?.length ?? 0) > 0 ? (
          <View style={[styles.section, styles.servicesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>الخدمات المدفوعة (اختياري)</Text>
            <Text style={[styles.paidHint, { color: colors.textSecondary }]}>
              اختر ما تحتاجه — يُضاف ثمنه إلى المجموع عند الحجز.
            </Text>
            {venue.paidServiceOptions!.map((opt) => {
              const on = selectedPaidIds.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.paidOptionRow,
                    { backgroundColor: colors.card, borderColor: on ? colors.primary : colors.border },
                  ]}
                  onPress={() => {
                    setSelectedPaidIds((prev) =>
                      prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id],
                    );
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name={on ? "checkbox" : "square-outline"}
                    size={22}
                    color={on ? colors.primary : colors.textTertiary}
                  />
                  <Text style={[styles.paidOptionLabel, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.paidOptionPrice, { color: colors.primary }]}>
                    +{formatPrice(opt.price)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (venue.paidAmenities?.length ?? 0) > 0 ? (
          <View style={[styles.section, styles.servicesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>الخدمات المدفوعة</Text>
            <View style={styles.servicesGrid}>
              {(venue.paidAmenities ?? []).map((a) => {
                const iconName = SERVICE_ICONS[a] ?? "card-outline";
                return (
                  <View key={`paid-${a}`} style={[styles.serviceChip, { backgroundColor: colors.card }]}>
                    <Ionicons name={iconName as any} size={18} color={colors.textSecondary} />
                    <Text style={[styles.serviceChipText, { color: colors.text }]}>{a}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>الأوقات والأيام</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesRow}
          >
            {dates.map(d => (
              <Pressable
                key={d.value}
                style={[
                  styles.dateChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedDate === d.value && { backgroundColor: colors.surface, borderColor: colors.primary },
                ]}
                onPress={() => { setSelectedDate(d.value); setSelectedTime(null); }}
              >
                <Text style={[
                  styles.dateChipText,
                  { color: selectedDate === d.value ? colors.primary : colors.textSecondary },
                ]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>مدة الحجز</Text>
          <View style={styles.sizesRow}>
            {DURATION_OPTIONS.map((opt) => {
              const selected = selectedDuration === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.sizeChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selected && { backgroundColor: colors.surface, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedDuration(opt.value)}
                >
                  <Text style={[
                    styles.sizeText,
                    { color: selected ? colors.primary : colors.textSecondary },
                  ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>اختر الوقت (من — إلى)</Text>
          <Text style={[styles.slotHint, { color: colors.textSecondary }]}>
            الأوقات كل 30 دقيقة. المدة المختارة ({formatDurationAr(selectedDuration)}) تُحدد النهاية — حجز ساعة ونص يحرر نصف الساعة التالية للآخرين.
            {scheduleWindows != null && scheduleWindows.length > 0
              ? " تُعرض فقط الأوقات ضمن ساعات عمل الملعب لهذا اليوم."
              : ""}
          </Text>
          {scheduleWindows != null && scheduleWindows.length === 0 ? (
            <Text style={[styles.scheduleClosedHint, { color: colors.textSecondary }]}>
              لا توجد أوقات متاحة لهذا اليوم حسب جدول الملعب.
            </Text>
          ) : null}
          <View style={styles.timeGrid}>
            {slotsForDuration.map((slot) => {
              const past = isBookingWallStartInPastForLocalCalendarDate(selectedDate, slot);
              const overlap = slotHasBookingOverlap(slot);
              const blocked = past || overlap;
              const selected = selectedTime === slot;
              return (
                <Pressable
                  key={slot}
                  style={[
                    styles.timeCell,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selected && { backgroundColor: colors.surface, borderColor: colors.primary },
                    blocked && { borderColor: colors.destructive, opacity: 0.88 },
                  ]}
                  onPress={() => !blocked && setSelectedTime(slot)}
                  disabled={blocked}
                >
                  <Text style={[styles.timeCellTime, { color: colors.text }]}>{slot}</Text>
                  <Text
                    style={[
                      styles.timeCellStatus,
                      { color: blocked ? colors.destructive : colors.primary },
                    ]}
                  >
                    {past ? "انتهى" : overlap ? "محجوز" : "متاح"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedTime && endTime && (
            <View style={[styles.fromToRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.fromToLabel, { color: colors.textSecondary }]}>من</Text>
              <Text style={[styles.fromToValue, { color: colors.text }]}>{selectedTime}</Text>
              <Text style={[styles.fromToLabel, { color: colors.textSecondary }]}>إلى</Text>
              <Text style={[styles.fromToValue, { color: colors.text }]}>{endTime}</Text>
              {!isRangeAvailable && (
                <Text style={[styles.rangeConflict, { color: colors.destructive }]}>— يتقاطع مع حجز</Text>
              )}
            </View>
          )}
          {selectedTime && isRangeAvailable && (
            <View
              style={[
                styles.sessionSummary,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sessionSummaryTitle, { color: colors.text }]}>ملخص السعر</Text>
              <View style={styles.invoiceRow}>
                <Text style={[styles.invoiceLabel, { color: colors.textSecondary }]}>إيجار الملعب</Text>
                <View style={styles.invoiceValueCol}>
                  {fieldDiscountMeta.percentApplied > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.invoiceValueStruck,
                          { color: colors.textTertiary },
                        ]}
                      >
                        {formatPrice(fieldRentalBasePrice)}
                      </Text>
                      <Text style={[styles.invoiceValue, { color: colors.text }]}>
                        {formatPrice(fieldRentalPrice)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.invoiceValue, { color: colors.text }]}>
                      {formatPrice(fieldRentalPrice)}
                    </Text>
                  )}
                </View>
              </View>
              {fieldDiscountMeta.percentApplied > 0 ? (
                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.textSecondary }]}>
                    خصم ({fieldDiscountMeta.percentApplied}%)
                  </Text>
                  <Text style={[styles.invoiceValue, { color: colors.primary }]}>
                    −{formatPrice(fieldRentalBasePrice - fieldRentalPrice)}
                  </Text>
                </View>
              ) : null}
              {paidExtrasTotal > 0 && (
                <View style={styles.invoiceRow}>
                  <Text style={[styles.invoiceLabel, { color: colors.textSecondary }]}>خدمات إضافية</Text>
                  <Text style={[styles.invoiceValue, { color: colors.text }]}>
                    {formatPrice(paidExtrasTotal)}
                  </Text>
                </View>
              )}
              <View style={[styles.invoiceDivider, { backgroundColor: colors.border }]} />
              {!isExp && promoState?.valid ? (
                <>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: colors.textSecondary }]}>قبل الكوبون</Text>
                    <Text style={[styles.invoiceValue, { color: colors.textTertiary, textDecorationLine: "line-through" }]}>
                      {formatPrice(totalPrice)}
                    </Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: colors.textSecondary }]}>خصم الكوبون</Text>
                    <Text style={[styles.invoiceValue, { color: colors.primary }]}>
                      −{formatPrice(promoState.discountAmount)}
                    </Text>
                  </View>
                </>
              ) : null}
              <View style={styles.invoiceRow}>
                <Text style={[styles.invoiceTotalLabel, { color: colors.text }]}>المجموع</Text>
                <Animated.Text
                  style={[
                    styles.invoiceTotalValue,
                    { color: colors.primary, transform: [{ scale: priceScale }] },
                  ]}
                >
                  {formatPrice(amountToCharge)}
                </Animated.Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>حجم الملعب</Text>
          <View style={styles.sizesRow}>
            {venue.fieldSizes.map(size => (
              <Pressable
                key={size}
                style={[
                  styles.sizeChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedSize === size && { backgroundColor: colors.surface, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedSize(size)}
              >
                <Text style={[
                  styles.sizeText,
                  { color: selectedSize === size ? colors.primary : colors.textSecondary },
                ]}>
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>التقييمات</Text>
          <View style={[styles.reviewsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>النظافة</Text>
              <View style={[styles.reviewBar, { backgroundColor: colors.surface }]}>
                <View style={[styles.reviewFill, { width: "90%", backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.reviewScore, { color: colors.text }]}>4.5</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>جودة العشب</Text>
              <View style={[styles.reviewBar, { backgroundColor: colors.surface }]}>
                <View style={[styles.reviewFill, { width: "85%", backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.reviewScore, { color: colors.text }]}>4.2</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>الإضاءة</Text>
              <View style={[styles.reviewBar, { backgroundColor: colors.surface }]}>
                <View style={[styles.reviewFill, { width: "95%", backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.reviewScore, { color: colors.text }]}>4.7</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bookingBar, { paddingBottom: bottomPadding + 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.priceBlock}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>المجموع</Text>
          <Animated.Text style={[styles.price, { color: colors.primary, transform: [{ scale: priceScale }] }]}>
            {formatPrice(amountToCharge)}
          </Animated.Text>
          <Text style={[styles.priceSub, { color: colors.textSecondary }]}>
            ملعب:{" "}
            {fieldDiscountMeta.percentApplied > 0
              ? `${formatPrice(fieldRentalPrice)} (بعد خصم ${fieldDiscountMeta.percentApplied}%)`
              : formatPrice(fieldRentalPrice)}
            {paidExtrasTotal > 0 ? ` + إضافات ${formatPrice(paidExtrasTotal)}` : ""}
          </Text>
        </View>
        <Pressable
          style={[
            styles.bookBtn,
            { backgroundColor: colors.primary },
            (!selectedTime || !isRangeAvailable || isBooking) && { backgroundColor: colors.disabled },
          ]}
          onPress={handlePayAndBook}
          disabled={!selectedTime || !isRangeAvailable || isBooking}
        >
          <Ionicons name={isBooking ? "hourglass" : "calendar"} size={20} color="#000" />
          <Text style={styles.bookBtnText}>
            {isBooking
              ? "جاري الحجز..."
              : restrictToOnlinePayment
                ? "احجز — دفع إلكتروني أو محفظة"
                : "احجز — اختر طريقة الدفع"}
          </Text>
        </Pressable>
      </View>

      <Modal visible={showPaymentModal} transparent animationType="slide">
        <Pressable style={styles.paymentSheetOverlay} onPress={() => !isBooking && setShowPaymentModal(false)}>
          <Pressable
            style={[
              styles.paymentSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(bottomPadding, 12) + 8,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>فاتورة الحجز</Text>
              <Pressable hitSlop={12} onPress={() => !isBooking && setShowPaymentModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.invoiceCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.invoiceMetaLine, { color: colors.text }]} numberOfLines={1}>
                {venue.name}
              </Text>
              <Text style={[styles.invoiceMetaSub, { color: colors.textSecondary }]} numberOfLines={2}>
                {formatDate(selectedDate)} · {selectedTime}–{endTime ?? ""} · {formatDurationAr(selectedDuration)} ·{" "}
                {selectedSize}
              </Text>
              <View style={[styles.invoiceDividerThin, { backgroundColor: colors.border }]} />
              <View style={styles.invoiceRowCompact}>
                <Text style={[styles.invoiceLblSm, { color: colors.textSecondary }]}>الملعب</Text>
                <View style={styles.invoiceValColSm}>
                  {fieldDiscountMeta.percentApplied > 0 ? (
                    <>
                      <Text style={[styles.invoiceValStruckSm, { color: colors.textTertiary }]}>
                        {formatPrice(fieldRentalBasePrice)}
                      </Text>
                      <Text style={[styles.invoiceValSm, { color: colors.text }]}>
                        {formatPrice(fieldRentalPrice)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.invoiceValSm, { color: colors.text }]}>
                      {formatPrice(fieldRentalPrice)}
                    </Text>
                  )}
                </View>
              </View>
              {paidExtrasTotal > 0 && (
                <View style={styles.invoiceRowCompact}>
                  <Text style={[styles.invoiceLblSm, { color: colors.textSecondary }]}>إضافات</Text>
                  <Text style={[styles.invoiceValSm, { color: colors.text }]}>
                    {formatPrice(paidExtrasTotal)}
                  </Text>
                </View>
              )}
              <View style={[styles.invoiceDividerThin, { backgroundColor: colors.border }]} />
              {!isExp && promoState?.valid ? (
                <>
                  <View style={styles.invoiceRowCompact}>
                    <Text style={[styles.invoiceLblSm, { color: colors.textSecondary }]}>قبل الكوبون</Text>
                    <Text style={[styles.invoiceValSm, { color: colors.textTertiary, textDecorationLine: "line-through" }]}>
                      {formatPrice(totalPrice)}
                    </Text>
                  </View>
                  <View style={styles.invoiceRowCompact}>
                    <Text style={[styles.invoiceLblSm, { color: colors.textSecondary }]}>خصم الكوبون</Text>
                    <Text style={[styles.invoiceValSm, { color: colors.primary }]}>
                      −{formatPrice(promoState.discountAmount)}
                    </Text>
                  </View>
                </>
              ) : null}
              <View style={styles.invoiceRowCompact}>
                <Text style={[styles.invoiceTotalSm, { color: colors.text }]}>الإجمالي</Text>
                <Animated.Text
                  style={[
                    styles.invoiceTotalAmt,
                    { color: colors.primary, transform: [{ scale: priceScale }] },
                  ]}
                >
                  {formatPrice(amountToCharge)}
                </Animated.Text>
              </View>
            </View>

            {!isExp ? (
              <View style={[styles.promoBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.promoLbl, { color: colors.textSecondary }]}>Promo code</Text>
                <View style={styles.promoRow}>
                  <TextInput
                    style={[
                      styles.promoInput,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                    placeholder="Enter promo code"
                    placeholderTextColor={colors.textTertiary}
                    value={promoInput}
                    onChangeText={setPromoInput}
                    autoCapitalize="characters"
                    editable={!promoLoading && !promoLocked}
                  />
                  <Pressable
                    style={[
                      styles.promoApplyBtn,
                      { backgroundColor: colors.primary },
                      (promoLoading || promoLocked) && styles.promoApplyBtnDisabled,
                    ]}
                    onPress={handleApplyPromo}
                    disabled={promoLoading || promoLocked}
                  >
                    {promoLoading ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Text style={styles.promoApplyTxt}>Apply</Text>
                    )}
                  </Pressable>
                </View>
                {promoState ? (
                  <Text
                    style={[
                      styles.promoMsg,
                      { color: promoState.valid ? colors.primary : colors.destructive },
                    ]}
                  >
                    {promoState.message}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.paySectionLbl, { color: colors.textSecondary }]}>
              {fromRandomMatchFlow ? "Pay Now" : "Payment method"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payChipsScroll}
            >
              {!restrictToOnlinePayment && (
                <>
                  <Pressable
                    style={[
                      styles.payChip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      paymentMethod === "cash" && { borderColor: colors.primary, backgroundColor: colors.surface },
                    ]}
                    onPress={() => setPaymentMethod("cash")}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={17}
                      color={paymentMethod === "cash" ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.payChipTxt, { color: colors.text }]}>نقد</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.payChip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      paymentMethod === "card_venue" && { borderColor: colors.primary, backgroundColor: colors.surface },
                    ]}
                    onPress={() => setPaymentMethod("card_venue")}
                  >
                    <Ionicons
                      name="card-outline"
                      size={17}
                      color={paymentMethod === "card_venue" ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.payChipTxt, { color: colors.text }]}>POS</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.payChip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      paymentMethod === "transfer" && { borderColor: colors.primary, backgroundColor: colors.surface },
                    ]}
                    onPress={() => setPaymentMethod("transfer")}
                  >
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={17}
                      color={paymentMethod === "transfer" ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.payChipTxt, { color: colors.text }]}>Transfer</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                style={[styles.payChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => {
                  if (!selectedTime || !isRangeAvailable) return;
                  setShowPaymentModal(false);
                  router.push({
                    pathname: "/booking/pay-card",
                    params: {
                      amount: String(amountToCharge),
                      venueId: String(venue.id),
                      venueName: venue.name,
                      date: selectedDate,
                      time: selectedTime,
                      duration: String(selectedDuration),
                      fieldSize: selectedSize,
                      ...(fromRandomMatchFlow || restrictToOnlinePayment ? { fromRandomMatch: "1" } : {}),
                    },
                  });
                }}
              >
                <Ionicons name="card" size={17} color={colors.primary} />
                <Text style={[styles.payChipTxt, { color: colors.text }]}>
                  {fromRandomMatchFlow ? "Pay Now" : "Card"}
                </Text>
              </Pressable>
              {(fromRandomMatchFlow || !restrictToOnlinePayment) && (
                <Pressable
                  style={[styles.payChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => {
                    if (!selectedTime || !isRangeAvailable) return;
                    setShowPaymentModal(false);
                    router.push({
                      pathname: "/booking/pay-wallet",
                      params: {
                        amount: String(amountToCharge),
                        venueId: String(venue.id),
                        venueName: venue.name,
                        date: selectedDate,
                        time: selectedTime,
                        duration: String(selectedDuration),
                        fieldSize: selectedSize,
                        ...(fromRandomMatchFlow || restrictToOnlinePayment ? { fromRandomMatch: "1" } : {}),
                      },
                    });
                  }}
                >
                  <Ionicons name="wallet" size={17} color={colors.primary} />
                  <Text style={[styles.payChipTxt, { color: colors.text }]}>محفظة</Text>
                </Pressable>
              )}
            </ScrollView>

            {fromRandomMatchFlow ? null : (
              <Text style={[styles.payHintMini, { color: colors.textTertiary }]}>
                {restrictToOnlinePayment
                  ? "بطاقة أو محفظة من التطبيق"
                  : "Choose cash / POS / transfer, then confirm — or Pay Now with card/wallet"}
              </Text>
            )}

            <View style={styles.sheetActions}>
              <Pressable
                style={[styles.sheetBtnGhost, { borderColor: colors.border }]}
                onPress={() => !isBooking && setShowPaymentModal(false)}
              >
                <Text style={[styles.sheetBtnGhostTxt, { color: colors.textSecondary }]}>
                  {restrictToOnlinePayment ? "إغلاق" : "لاحقاً"}
                </Text>
              </Pressable>
              {!restrictToOnlinePayment && (
                <Pressable
                  style={[styles.sheetBtnPrimary, { backgroundColor: colors.primary }]}
                  onPress={handlePaymentConfirm}
                  disabled={isBooking}
                >
                  <Text style={styles.sheetBtnPrimaryTxt}>
                    {isBooking
                      ? "…"
                      : paymentMethod === "cash" || paymentMethod === "card_venue"
                        ? "تأكيد الحجز"
                        : "تأكيد"}
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSuccessShare} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>تم الحجز بنجاح!</Text>
            <Text style={[styles.successSub, { color: colors.textSecondary }]}>
              يمكنك مشاركة تفاصيل الحجز مع من تريد
            </Text>
            <Pressable style={[styles.shareMatchBtn, { backgroundColor: colors.primary }]} onPress={handleShareBooking}>
              <Ionicons name="share-social" size={22} color="#000" />
              <Text style={styles.shareMatchBtnText}>مشاركة تفاصيل الحجز</Text>
            </Pressable>
            <Pressable
              style={[styles.successDoneBtn, { borderColor: colors.border }]}
              onPress={() => {
                setShowSuccessShare(false);
                setShareBundle(null);
                router.back();
                router.push("/(tabs)/bookings");
              }}
            >
              <Text style={[styles.successDoneText, { color: colors.text }]}>عرض حجوزاتي</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  backBtnTop: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shareText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  greenCard: {
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  greenCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greenCardLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenCardLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  greenCardValue: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  venueHero: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  venueHeroImage: {
    width: "100%",
    height: 310,
  },
  venueHeroImageStyle: {
    borderRadius: 20,
  },
  pricingGridCard: {
    marginHorizontal: 0,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  pricingGridHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  pricingGridTitle: {
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
    letterSpacing: 0.2,
  },
  pricingGridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 2,
  },
  pricingCellGrid: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    maxWidth: "48%",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    justifyContent: "center",
  },
  discountBanner: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 0,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  discountBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    lineHeight: 20,
    textAlign: "right",
  },
  pricingCellLabel: {
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
    lineHeight: 15,
    opacity: 0.92,
  },
  pricingCellAmount: {
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
    lineHeight: 18,
  },
  sessionSummary: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  sessionSummaryTitle: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
    marginBottom: 4,
  },
  invoiceBox: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  invoiceBoxTitle: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
    marginBottom: 4,
  },
  invoiceDetailLine: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  invoiceLabel: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    flexShrink: 0,
  },
  invoiceValue: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    flex: 1,
    textAlign: "right",
  },
  invoiceDivider: {
    height: 1,
    marginVertical: 4,
  },
  invoiceTotalLabel: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  invoiceTotalValue: {
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  onlineOnlyBanner: {
    marginHorizontal: 0,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  onlineOnlyBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    lineHeight: 18,
    textAlign: "right",
  },
  detailSection: {
    marginBottom: 16,
    gap: 8,
  },
  detailVenueName: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  sizePillDetail: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sizePillText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  reviewCountText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sportText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  detailLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  detailLocationText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    flex: 1,
  },
  detailDistanceText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  descriptionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    lineHeight: 22,
  },
  servicesCard: {
    backgroundColor: "rgba(15,157,88,0.12)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15,157,88,0.2)",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  serviceChipText: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  paidHint: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginBottom: 4,
  },
  paidOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  paidOptionLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  paidOptionPrice: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
    paddingTop: 12,
  },
  section: {
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  datesRow: {
    gap: 8,
  },
  dateChip: {
    minWidth: 60,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  dateChipActive: {
    backgroundColor: "rgba(15,157,88,0.15)",
    borderColor: Colors.primary,
  },
  dateChipText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  dateChipTextActive: {
    color: Colors.primary,
    fontFamily: "Cairo_600SemiBold",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slot: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  slotSelected: {
    backgroundColor: "rgba(15,157,88,0.2)",
    borderColor: Colors.primary,
  },
  slotBooked: {
    backgroundColor: "rgba(255,59,48,0.06)",
    borderColor: "rgba(255,59,48,0.2)",
    opacity: 0.6,
  },
  slotText: {
    color: Colors.text,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
  },
  slotTextSelected: {
    color: Colors.primary,
  },
  slotTextBooked: {
    color: Colors.destructive,
  },
  bookedLabel: {
    color: Colors.destructive,
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
  },
  slotHint: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 10,
    lineHeight: 18,
  },
  scheduleClosedHint: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: 10,
    textAlign: "right",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  timeCell: {
    width: "23%",
    minWidth: 72,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  timeCellTime: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  timeCellStatus: {
    fontSize: 10,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 4,
  },
  invoiceValueCol: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  invoiceValueStruck: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textDecorationLine: "line-through",
  },
  invoiceValColSm: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  invoiceValStruckSm: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    textDecorationLine: "line-through",
  },
  fromToRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  fromToLabel: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  fromToValue: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  rangeConflict: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
    marginRight: "auto",
  },
  sizesRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  sizeChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sizeChipActive: {
    backgroundColor: "rgba(15,157,88,0.15)",
    borderColor: Colors.primary,
  },
  sizeText: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
  },
  sizeTextActive: {
    color: Colors.primary,
  },
  amenitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amenityText: {
    color: Colors.text,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
  },
  reviewsCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewLabel: {
    color: Colors.textSecondary,
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    width: 80,
    textAlign: "right",
  },
  reviewBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  reviewFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  reviewScore: {
    color: Colors.text,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    width: 28,
    textAlign: "center",
  },
  bookingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
  },
  priceBlock: {
    gap: 2,
  },
  priceLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  price: {
    color: Colors.primary,
    fontSize: 17,
    fontFamily: "Cairo_700Bold",
  },
  bookBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bookBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  bookBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  priceSub: {
    fontSize: 10,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  paymentSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  paymentSheet: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.45)",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  invoiceCompact: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 6,
  },
  invoiceMetaLine: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
  },
  invoiceMetaSub: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
    lineHeight: 16,
  },
  invoiceDividerThin: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  invoiceRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  invoiceLblSm: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
  },
  invoiceValSm: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  invoiceTotalSm: {
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
  },
  invoiceTotalAmt: {
    fontSize: 16,
    fontFamily: "Cairo_700Bold",
  },
  paySectionLbl: {
    fontSize: 11,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: 8,
    textAlign: "right",
    alignSelf: "stretch",
  },
  payChipsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingLeft: 4,
  },
  payChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  payChipTxt: {
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  promoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  promoLbl: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Cairo_400Regular",
    fontSize: 15,
  },
  promoApplyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  promoApplyBtnDisabled: {
    opacity: 0.55,
  },
  promoApplyTxt: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    color: "#000",
  },
  promoMsg: {
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    textAlign: "right",
  },
  payHintMini: {
    fontSize: 10,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 14,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  sheetBtnGhost: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  sheetBtnGhostTxt: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  sheetBtnPrimary: {
    flex: 1.2,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  sheetBtnPrimaryTxt: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  successModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
  },
  successIconWrap: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  shareMatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  shareMatchBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  successDoneBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  successDoneText: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
});
