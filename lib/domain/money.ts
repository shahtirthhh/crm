const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbpPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatMoney(pence: number | undefined | null, exact = false): string {
  if (pence == null) return "—";
  return (exact ? gbpPence : gbp).format(pence / 100);
}

export function formatMoneyShort(pence: number): string {
  const pounds = pence / 100;
  if (Math.abs(pounds) >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`;
  if (Math.abs(pounds) >= 1_000) return `£${(pounds / 1_000).toFixed(pounds >= 100_000 ? 0 : 1)}k`;
  return `£${pounds.toFixed(0)}`;
}

/** Parses "£35,000", "35000" or "35000.50" into pence. Returns undefined for blank input. */
export function parseMoney(input: string | null | undefined): number | undefined {
  if (input == null) return undefined;
  const cleaned = input.replace(/[£,\s]/g, "");
  if (cleaned === "") return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid amount: ${input}`);
  return Math.round(value * 100);
}

/** Splits a total into percentage parts, putting any rounding remainder on the last part. */
export function splitByPercent(totalPence: number, percents: number[]): number[] {
  const parts = percents.map((p) => Math.floor((totalPence * p) / 100));
  const remainder = totalPence - parts.reduce((a, b) => a + b, 0);
  parts[parts.length - 1] += remainder;
  return parts;
}
