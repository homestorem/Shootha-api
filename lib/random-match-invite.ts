import type { RandomMatchItem } from "@/context/RandomMatchContext";

/** فك حمولة `p` من رابط المشاركة (قد تكون مُعرَّفة عبر expo-linking) */
export function decodeMatchFromInviteQuery(p: string): RandomMatchItem {
  let raw = p;
  try {
    raw = decodeURIComponent(p);
  } catch {
    /* قيمة جاهزة بدون ترميز إضافي */
  }
  const data = JSON.parse(raw) as RandomMatchItem;
  if (!data?.id || !data.venueName) {
    throw new Error("invalid_invite");
  }
  return data;
}
