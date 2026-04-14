/**
 * في التطوير على جهاز حقيقي، localhost في .env يشير إلى الهاتف وليس الحاسوب.
 * نستبدله بـ: EXPO_PUBLIC_DEV_LAN_HOST، أو Expo debuggerHost، أو hostUri، أو
 * اسم المضيف من حزمة Metro (SourceCode.scriptURL) — غالباً نفس IP الحاسوب.
 */
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

function hostFromString(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const host = raw.includes(":") ? raw.split(":")[0] : raw;
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function expoDebuggerHost(): string | null {
  const raw = Constants.expoGoConfig?.debuggerHost;
  return hostFromString(raw);
}

/** Expo يضع أحياناً hostUri بدل expoGoConfig في إصدارات حديثة */
function hostFromExpoConfig(): string | null {
  try {
    const uri = Constants.expoConfig?.hostUri;
    if (!uri || typeof uri !== "string") return null;
    const withProto = uri.includes("://") ? uri : `http://${uri}`;
    const { hostname } = new URL(withProto);
    return hostFromString(hostname);
  } catch {
    return null;
  }
}

/** عنوان حاسوب التطوير كما يظهر في رابط الحزمة (نفس شبكة Metro) */
function metroBundlerHostname(): string | null {
  try {
    const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL;
    if (!scriptURL || typeof scriptURL !== "string") return null;
    const { hostname } = new URL(scriptURL);
    return hostFromString(hostname);
  } catch {
    return null;
  }
}

function resolveDevLanHostname(): string | null {
  const manual = process.env.EXPO_PUBLIC_DEV_LAN_HOST?.trim();
  if (manual && manual.length > 2) return manual;
  return (
    expoDebuggerHost() ??
    hostFromExpoConfig() ??
    metroBundlerHostname()
  );
}

/**
 * يعيد عنوان http(s) بعد استبدال localhost بعنوان يصل إليه الجهاز في التطوير.
 */
export function resolveDevBackendUrl(url: string): string {
  const s = url.trim();
  if (!s) return s;
  if (Platform.OS === "web") return s;
  if (typeof __DEV__ === "undefined" || !__DEV__) return s;
  if (!/localhost|127\.0\.0\.1/i.test(s)) return s;

  const lan = resolveDevLanHostname();
  if (!lan) return s;

  try {
    const u = new URL(s);
    u.hostname = lan;
    return u.toString().replace(/\/$/, "");
  } catch {
    return s.replace(/localhost|127\.0\.0\.1/gi, lan);
  }
}

/** عنوان Express بعد استبدال localhost (للمكالمات من التطبيق على الجهاز). */
export function getResolvedApiBaseUrl(): string {
  const env = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
  if (env) return resolveDevBackendUrl(env).replace(/\/$/, "");
  if (typeof __DEV__ !== "undefined" && __DEV__ && Platform.OS === "web") {
    return "http://localhost:4001";
  }
  return "";
}

/** عنوان خادم OTP IQ المنفصل (إن وُجد في .env). */
export function getResolvedOtpDedicatedBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_OTP_API_URL ?? "").trim();
  if (!raw) return "";
  return resolveDevBackendUrl(raw).replace(/\/$/, "");
}
