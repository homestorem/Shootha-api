import type { Venue } from "@/context/BookingsContext";

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

/** سعر تقريبي للساعة من البيانات أو من الباقات */
export function getHourlyRate(venue: Venue): number {
  if (venue.pricePerHour > 0) return venue.pricePerHour;
  const t2 = venue.priceTier2Hours ?? 0;
  if (t2 > 0) return Math.round(t2 / 2);
  const t15 = venue.priceTier1_5Hours ?? 0;
  if (t15 > 0) return Math.round(t15 / 1.5);
  const t3 = venue.priceTier3Hours ?? 0;
  if (t3 > 0) return Math.round(t3 / 3);
  return 0;
}

/**
 * سعر إيجار الملعب للمدة المختارة.
 * مدد 1.5 / 2 / 3 ساعات: القيمة من حقول القاعدة `priceTier1_5Hours` | `priceTier2Hours` | `priceTier3Hours`
 * (المُعبأة من Firestore: `price_1_5_hours`, `price_2_hours`, `price_3_hours`) وليس من ضرب الساعة.
 */
export function getFieldPriceForDuration(venue: Venue, durationHours: number): number {
  const h = getHourlyRate(venue);
  const d = durationHours;
  if (near(d, 1.5) && (venue.priceTier1_5Hours ?? 0) > 0) {
    return Math.round(venue.priceTier1_5Hours as number);
  }
  if (near(d, 2) && (venue.priceTier2Hours ?? 0) > 0) {
    return Math.round(venue.priceTier2Hours as number);
  }
  if (near(d, 3) && (venue.priceTier3Hours ?? 0) > 0) {
    return Math.round(venue.priceTier3Hours as number);
  }
  return Math.round(h * d);
}

export type PricingRow = {
  key: string;
  label: string;
  duration: number;
  amount: number;
};

/** صفوف عرض: ساعة / ساعة ونص / ساعتان / 3 ساعات */
function timeToMinutes(t: string): number {
  const [h, mm] = t.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (mm || 0);
}

/** هل وقت بداية الحجز داخل نافذة الخصم (نفس اليوم) */
export function isStartTimeInDiscountWindow(
  discount: { timeFrom: string; timeTo: string; percent: number } | undefined,
  startTime: string,
): boolean {
  if (!discount || discount.percent <= 0) return false;
  const a = timeToMinutes(discount.timeFrom);
  const b = timeToMinutes(discount.timeTo);
  const t = timeToMinutes(startTime);
  if (a < b) return t >= a && t < b;
  if (a > b) return t >= a || t < b;
  return false;
}

/** يطبّق خصم نافذة الوقت على إيجار الملعب فقط */
export function applyVenueDiscountToFieldPrice(
  venue: Venue,
  startTime: string | null,
  fieldPrice: number,
): { final: number; percentApplied: number } {
  const d = venue.discountWindow;
  if (!d || !startTime || fieldPrice <= 0) return { final: fieldPrice, percentApplied: 0 };
  if (!isStartTimeInDiscountWindow(d, startTime)) return { final: fieldPrice, percentApplied: 0 };
  const p = Math.min(100, Math.max(0, d.percent));
  return { final: Math.round(fieldPrice * (1 - p / 100)), percentApplied: p };
}

export function getPricingTableRows(venue: Venue): PricingRow[] {
  const h = getHourlyRate(venue);
  const t15 = venue.priceTier1_5Hours ?? 0;
  const t2 = venue.priceTier2Hours ?? 0;
  const t3 = venue.priceTier3Hours ?? 0;

  const hour1 =
    h > 0
      ? h
      : t2 > 0
        ? Math.round(t2 / 2)
        : t15 > 0
          ? Math.round(t15 / 1.5)
          : t3 > 0
            ? Math.round(t3 / 3)
            : 0;

  return [
    {
      key: "1",
      label: "ساعة واحدة",
      duration: 1,
      amount: hour1,
    },
    {
      key: "1.5",
      label: "ساعة ونص",
      duration: 1.5,
      amount: t15 > 0 ? Math.round(t15) : Math.round(hour1 * 1.5),
    },
    {
      key: "2",
      label: "ساعتان",
      duration: 2,
      amount: t2 > 0 ? Math.round(t2) : Math.round(hour1 * 2),
    },
    {
      key: "3",
      label: "3 ساعات",
      duration: 3,
      amount: t3 > 0 ? Math.round(t3) : Math.round(hour1 * 3),
    },
  ];
}
