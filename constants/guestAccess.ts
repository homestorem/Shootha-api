/**
 * false: الضيف للمشاهدة فقط (لا حجز/محفظة كاملة) — أول فتح بدون جلسة → صفحة تسجيل الدخول.
 * على السيرفر عيّن `GUEST_FULL_ACCESS=0` لإيقاف محفظة الضيف بدون JWT.
 */
export const GUEST_FULL_ACCESS = false;
