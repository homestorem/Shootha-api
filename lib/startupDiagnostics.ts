import { firebaseConfig } from "@/lib/firebaseConfig";

const REQUIRED_EXPO_PUBLIC_VARS = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
] as const;

const OPTIONAL_EXPO_PUBLIC_VARS = [
  "EXPO_PUBLIC_API_URL",
] as const;

function summarizeEnvValue(value: string | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return {
    present: normalized.length > 0,
    length: normalized.length,
  };
}

export function logStartupEnvironment(): void {
  const allVars = [...REQUIRED_EXPO_PUBLIC_VARS, ...OPTIONAL_EXPO_PUBLIC_VARS] as const;
  const summary = allVars.reduce<Record<string, ReturnType<typeof summarizeEnvValue>>>(
    (acc, key) => {
      acc[key] = summarizeEnvValue(process.env[key]);
      return acc;
    },
    {},
  );

  console.log("[startup] env summary", summary);
}

export function validateStartupConfig(): string[] {
  const missingEnv = REQUIRED_EXPO_PUBLIC_VARS.filter(
    (key) => !String(process.env[key] ?? "").trim(),
  );

  const missingFirebaseFields = ([
    ["apiKey", firebaseConfig.apiKey],
    ["authDomain", firebaseConfig.authDomain],
    ["projectId", firebaseConfig.projectId],
    ["storageBucket", firebaseConfig.storageBucket],
    ["messagingSenderId", firebaseConfig.messagingSenderId],
    ["appId", firebaseConfig.appId],
  ] as const)
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([key]) => key);

  const errors: string[] = [];
  if (missingEnv.length > 0) {
    errors.push(`Missing EXPO_PUBLIC variables: ${missingEnv.join(", ")}`);
  }
  if (missingFirebaseFields.length > 0) {
    errors.push(`Firebase config fields missing: ${missingFirebaseFields.join(", ")}`);
  }
  return errors;
}

export function installGlobalErrorHandlers(): void {
  const globalAny = globalThis as any;
  const errorUtils = globalAny.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    return;
  }

  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    console.error("[fatal-startup-error]", {
      isFatal: !!isFatal,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });
}
