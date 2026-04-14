const iqdf = new Intl.NumberFormat("en-US");

/** Whole IQD amounts for UI (no fils scaling). */
export function formatIqd(amount: number): string {
  return `${iqdf.format(Math.round(amount))} IQD`;
}
