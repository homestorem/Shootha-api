/**
 * خادم OTP:
 * - إن وُجد EXPO_PUBLIC_OTP_API_URL → خادم OTP IQ: /send-otp و /verify-otp
 * - وإلا EXPO_PUBLIC_API_URL → Express: /api/auth/send-otp و /api/otp/verify
 *
 * على الهاتف مع localhost في .env: يُستبدل تلقائياً بعنوان LAN من Expo، أو عيّن
 * EXPO_PUBLIC_DEV_LAN_HOST=192.168.x.x
 */
import { Platform } from "react-native";
import { getResolvedApiBaseUrl, getResolvedOtpDedicatedBaseUrl } from "@/lib/devServerHost";

function otpHttpTimeoutMs(): number {
  const raw = String(process.env.EXPO_PUBLIC_OTP_HTTP_TIMEOUT_MS ?? "").trim();
  const n = raw ? Number(raw) : NaN;
  const fallback = 22_000;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(90_000, Math.max(5_000, Math.round(n)));
}

/** مهلة طلبات إرسال/تحقق OTP — قابلة للزيادة عند استضافة باردة (مثل Render بعد السكون) */
const OTP_TIMEOUT_MS = otpHttpTimeoutMs();

export type OtpEndpoints = { sendUrl: string; verifyUrl: string };

/**
 * يعيد عناوين الإرسال والتحقق، أو null إن لم يُضبط أي مسار.
 */
export function getOtpEndpoints(): OtpEndpoints | null {
  const dedicated = getResolvedOtpDedicatedBaseUrl();
  if (dedicated) {
    return { sendUrl: `${dedicated}/send-otp`, verifyUrl: `${dedicated}/verify-otp` };
  }
  const api = getResolvedApiBaseUrl();
  if (api) {
    return { sendUrl: `${api}/api/auth/send-otp`, verifyUrl: `${api}/api/otp/verify` };
  }
  if (typeof __DEV__ !== "undefined" && __DEV__ && Platform.OS === "web") {
    const b = "http://localhost:5000";
    return { sendUrl: `${b}/api/auth/send-otp`, verifyUrl: `${b}/api/otp/verify` };
  }
  return null;
}

/** للتوافق مع كود قديم */
export function getOtpApiBase(): string {
  const d = getResolvedOtpDedicatedBaseUrl();
  if (d) return d;
  return getResolvedApiBaseUrl();
}

function otpNotConfiguredMessage(): string {
  return (
    "لم يُضبط عنوان خادم OTP. أضف في ملف .env:\n" +
    "• EXPO_PUBLIC_API_URL=http://عنوان-الحاسوب:5002\n" +
    "أو خادم OTP IQ:\n" +
    "• EXPO_PUBLIC_OTP_API_URL=http://عنوان-الخادم:4000\n" +
    "على الهاتف: إما استبدال localhost بـ IP الشبكة، أو EXPO_PUBLIC_DEV_LAN_HOST=IP\n" +
    "ثم أعد تشغيل npx expo start -c"
  );
}

async function readJson(res: Response): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function devOtpUrlHint(): string {
  if (typeof __DEV__ === "undefined" || !__DEV__) return "";
  const ep = getOtpEndpoints();
  if (!ep) return "";
  return `\n\n(التطوير) عنوان الطلب:\n${ep.sendUrl}`;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = OTP_TIMEOUT_MS,
): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: c.signal });
  } catch (e: unknown) {
    const hint = devOtpUrlHint();
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "انتهت مهلة الاتصال بالخادم. شغّل الخادم (npm run server:dev على منفذ 5000 أو القريب)، وتأكد أن الهاتف والحاسوب على نفس الـ Wi‑Fi، أو عيّن EXPO_PUBLIC_DEV_LAN_HOST=IP_الحاسوب في .env" +
          hint,
      );
    }
    throw new Error(
      "تعذر الاتصال بالخادم. إن كان العنوان في .env يحتوي localhost فعلى الهاتف لن يعمل — استبدله بـ IP الشبكة أو أضف EXPO_PUBLIC_DEV_LAN_HOST. تأكد أن خادم Express يعمل." +
        hint,
    );
  } finally {
    clearTimeout(t);
  }
}

function isRetryableNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (
    e.message.includes("مهلة الاتصال") ||
    e.message.includes("تعذر الاتصال") ||
    e.name === "AbortError"
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function sendOtpRequest(phone: string): Promise<void> {
  const ep = getOtpEndpoints();
  if (!ep) {
    throw new Error(otpNotConfiguredMessage());
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[otpApi] POST", ep.sendUrl);
  }
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(ep.sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        if (res.status === 404) {
          throw new Error(
            "404: المسار غير موجود. إن كان الخادم Express (npm run server:dev) أزل EXPO_PUBLIC_OTP_API_URL من .env. " +
              "EXPO_PUBLIC_OTP_API_URL مخصّص لخادم OTP المنفصل فقط (npm run server:otp — مسار /send-otp).",
          );
        }
        throw new Error(
          typeof data.error === "string" && data.error
            ? data.error
            : typeof data.message === "string" && data.message
              ? data.message
              : `تعذر إرسال الرمز (${res.status})`,
        );
      }
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === 0 && isRetryableNetworkError(lastErr)) {
        await sleep(1500);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("فشل إرسال الرمز");
}

export async function verifyOtpRequest(phone: string, code: string): Promise<void> {
  const ep = getOtpEndpoints();
  if (!ep) {
    throw new Error(otpNotConfiguredMessage());
  }
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(ep.verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await readJson(res);
      if (!res.ok || data.success === false) {
        if (res.status === 404) {
          throw new Error(
            "404: المسار غير موجود. أزل EXPO_PUBLIC_OTP_API_URL إن كنت تستخدم Express، أو شغّل خادم OTP المنفصل (npm run server:otp).",
          );
        }
        throw new Error(
          typeof data.error === "string" && data.error
            ? data.error
            : typeof data.message === "string" && data.message
              ? data.message
              : `فشل التحقق (${res.status})`,
        );
      }
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt === 0 && isRetryableNetworkError(lastErr)) {
        await sleep(1500);
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error("فشل التحقق");
}
