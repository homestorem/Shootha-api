import { signInWithCustomToken } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getResolvedApiBaseUrl } from "@/lib/devServerHost";
import {
  clearPendingFirebaseBridgeTicket,
  peekFirebaseBridgeTicket,
} from "@/lib/firebaseBridgeTicket";

/**
 * يربط عميل Firebase Auth بجلسة الدعم في Firestore (قواعد chats تتطلب request.auth).
 * الخادم يصدر Custom Token يحمل claim `e164` مطابقاً لمستند users وحقل userId في chats.
 */
export async function ensureFirebaseAuthForSupportChat(phoneE164: string): Promise<boolean> {
  const phone = phoneE164.trim();
  if (!phone) return false;

  const auth = getFirebaseAuth();
  try {
    const cu = auth.currentUser;
    if (cu) {
      const r = await cu.getIdTokenResult(true);
      if (r.claims?.e164 === phone) return true;
    }
  } catch {
    /* ignore */
  }

  const base = getResolvedApiBaseUrl();
  if (!base) {
    if (__DEV__) {
      console.warn("[support-auth] EXPO_PUBLIC_API_URL غير مضبوط — لن يُحمّل توكن الدعم");
    }
    return false;
  }

  try {
    const bridgeTicket = peekFirebaseBridgeTicket(phone) ?? undefined;
    const res = await fetch(`${base}/api/auth/custom-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, bridgeTicket }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
    if (!res.ok || !data.token) {
      if (__DEV__) {
        console.warn("[support-auth] custom-token:", res.status, data.message ?? "");
      }
      return false;
    }
    await signInWithCustomToken(auth, data.token);
    clearPendingFirebaseBridgeTicket();
    return true;
  } catch (e) {
    if (__DEV__) console.warn("[support-auth]", e);
    return false;
  }
}
