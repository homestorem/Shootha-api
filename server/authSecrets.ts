/**
 * أسرار الجلسة والمشرف — في الإنتاج يجب ضبطها عبر البيئة (بدون قيم افتراضية ضعيفة).
 */
export function assertProductionSecurityConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const jwt = process.env.SESSION_SECRET?.trim() ?? "";
  if (jwt.length < 32) {
    throw new Error(
      "SESSION_SECRET is required in production (min 32 characters). Example: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  const sup = process.env.SUPERVISOR_MASTER_KEY?.trim() ?? "";
  if (sup.length < 16) {
    throw new Error(
      "SUPERVISOR_MASTER_KEY is required in production (min 16 random characters).",
    );
  }
}

export function getJwtSecret(): string {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET missing after production assert");
  }
  return "shootha_secret_2026_dev_only";
}

export function getSupervisorMasterKey(): string {
  const s = process.env.SUPERVISOR_MASTER_KEY?.trim() ?? "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPERVISOR_MASTER_KEY missing after production assert");
  }
  return "shootha_supervisor_2026_dev_only";
}
