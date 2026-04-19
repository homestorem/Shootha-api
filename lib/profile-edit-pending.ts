/** حفظ مسودة تعديل الملف قبل التحقق بالهاتف في شاشة `verify-otp` */
export const PROFILE_EDIT_PENDING_KEY = "profile_edit_pending_v1";

export function profileEditUsedStorageKey(uid: string): string {
  return `profile_core_edit_used_v1:${uid}`;
}

export type ProfileEditPendingPayload = {
  name: string;
  dateOfBirth: string;
  position: string;
  profileImage?: string | null;
};
