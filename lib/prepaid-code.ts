export function normalizePrepaidCardCode(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toUpperCase();
}

