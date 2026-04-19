import { getResolvedApiBaseUrl } from "@/lib/devServerHost";
import { getFirebaseAuth } from "@/lib/firebase";

export type PostMatchPlayerRatingInput = {
  name: string;
  stars: number;
  goals: number;
};

export type SubmitPostMatchRatingPayload = {
  bookingId: string;
  raterUserId: string;
  venueId: string;
  venueName: string;
  venueStars: number;
  venueFeedback: string;
  players: PostMatchPlayerRatingInput[];
};

export async function submitPostMatchRating(payload: SubmitPostMatchRatingPayload): Promise<void> {
  const base = getResolvedApiBaseUrl();
  if (!base) {
    throw new Error("عنوان الخادم غير مُضبط (EXPO_PUBLIC_API_URL)");
  }
  const auth = getFirebaseAuth();
  const u = auth.currentUser;
  if (!u) {
    throw new Error("يجب تسجيل الدخول لإرسال التقييم");
  }
  const idToken = await u.getIdToken();
  const res = await fetch(`${base}/api/pitch-ratings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let msg = "";
  try {
    const j = JSON.parse(text) as { message?: string };
    msg = String(j.message ?? "");
  } catch {
    msg = text.slice(0, 200);
  }
  if (!res.ok) {
    throw new Error(msg || `تعذر إرسال التقييم (${res.status})`);
  }
}
