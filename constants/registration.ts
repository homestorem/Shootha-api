/** بيانات التسجيل المؤقتة قبل OTP */
export const REGISTRATION_PENDING_KEY = "shootha_registration_pending_v1";

export const POSITIONS = ["حارس", "دفاع", "وسط", "هجوم"] as const;

export type RegistrationPending = {
  full_name: string;
  email?: string;
  phone: string;
  birth_date: string;
  gender: string;
  position: string;
  avatar_url: string | null;
  /** رمز مشاركة اختياري عند التسجيل */
  shareCode?: string | null;
};
