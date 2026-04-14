import { getResolvedApiBaseUrl } from "@/lib/devServerHost";

function apiBase(): string {
  return getResolvedApiBaseUrl();
}

export type ValidatePromoParams = {
  code: string;
  userId: string;
  fieldId: string;
  region: string;
  bookingAmount: number;
};

export type ValidatePromoResult = {
  valid: boolean;
  discountAmount: number;
  finalPrice: number;
  message: string;
  validationToken?: string;
};

export async function validatePromoOnServer(
  params: ValidatePromoParams,
): Promise<ValidatePromoResult> {
  const base = apiBase();
  if (!base) {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: params.bookingAmount,
      message: "عنوان الخادم غير مُضبط (EXPO_PUBLIC_API_URL)",
    };
  }
  const res = await fetch(`${base}/api/promo/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code: params.code,
      userId: params.userId,
      fieldId: params.fieldId,
      region: params.region,
      bookingAmount: params.bookingAmount,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as ValidatePromoResult;
  if (!res.ok && typeof data.message !== "string") {
    return {
      valid: false,
      discountAmount: 0,
      finalPrice: params.bookingAmount,
      message: "تعذر التحقق من الكوبون",
    };
  }
  return {
    valid: Boolean(data.valid),
    discountAmount: Number(data.discountAmount) || 0,
    finalPrice: Number(data.finalPrice) || params.bookingAmount,
    message: String(data.message ?? ""),
    validationToken: data.validationToken,
  };
}

export async function redeemPromoOnServer(
  validationToken: string,
  bookingId: string,
): Promise<{ success: boolean; message: string }> {
  const base = apiBase();
  if (!base) {
    return { success: false, message: "عنوان الخادم غير مُضبط" };
  }
  const res = await fetch(`${base}/api/promo/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ validationToken, bookingId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  return {
    success: Boolean(data.success) && res.ok,
    message: String(data.message ?? (res.ok ? "تم" : "فشل تسجيل الكوبون")),
  };
}
