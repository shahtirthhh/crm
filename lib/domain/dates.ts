// All "day" values are UTC midnight Dates representing a calendar day in Europe/London.
// Keeping days as UTC-midnight avoids DST drift when adding days.

const LONDON = "Europe/London";

export function toDay(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

export function today(now: Date = new Date()): Date {
  return toDay(now);
}

export function parseDay(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatDayInput(day: Date | undefined | null): string {
  return day ? day.toISOString().slice(0, 10) : "";
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * 86_400_000);
}

export function addMonths(day: Date, months: number): Date {
  const d = new Date(day.getTime());
  const targetMonth = d.getUTCMonth() + months;
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day.getUTCDate(), lastDay));
  return d;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((toDayUtc(a).getTime() - toDayUtc(b).getTime()) / 86_400_000);
}

function toDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Adds working days (Mon–Fri). Bank holidays are not modelled. */
export function addWorkingDays(day: Date, days: number): Date {
  let d = day;
  let remaining = days;
  while (remaining > 0) {
    d = addDays(d, 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

export function startOfWeek(day: Date): Date {
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYearFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(day: Date | undefined | null, withYear = false): string {
  if (!day) return "—";
  return (withYear ? dayYearFormatter : dayFormatter).format(day);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: LONDON,
});

export function formatDateTime(date: Date | undefined | null): string {
  return date ? dateTimeFormatter.format(date) : "—";
}
