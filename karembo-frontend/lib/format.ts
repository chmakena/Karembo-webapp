/**
 * Formatting helpers.
 *
 * Every appointment time is rendered in the *salon's* timezone, never the
 * browser's. A customer booking from London must see the Mombasa time they are
 * expected to turn up at; showing 07:30 because their laptop is on BST would be
 * actively wrong. `SALON_TIME_ZONE` is the single place that decision lives.
 */

export const SALON_TIME_ZONE = "Africa/Nairobi";

/** Matches the backend's `SALON_UTC_OFFSET_HOURS`. EAT has no daylight saving. */
export const SALON_UTC_OFFSET_HOURS = 3;

/** Prices are stored as minor units of KES; en-KE renders the symbol as "Ksh". */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** 90 -> "1h 30m", 45 -> "45m". How a human reads a duration. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SALON_TIME_ZONE,
    ...options,
  });
}

/** "14:30" in salon time. */
export function formatTime(iso: string): string {
  return formatter({ hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

/** "Wed 9 Sep 2026" in salon time. */
export function formatDate(iso: string): string {
  return formatter({
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Wednesday 9 September" — for a day heading. */
export function formatDateLong(iso: string): string {
  return formatter({ weekday: "long", day: "numeric", month: "long" }).format(
    new Date(iso),
  );
}

/** "Wed 9 Sep 2026, 14:30" in salon time. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "14:30 – 15:30" for an appointment window. */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/**
 * A `YYYY-MM-DD` key for a Date, in salon time.
 *
 * Using `toISOString().slice(0, 10)` here would be a bug: it converts to UTC
 * first, so late-evening salon times land on the previous calendar day.
 */
export function salonDateKey(date: Date): string {
  const parts = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date key in salon time. */
export function salonToday(): string {
  return salonDateKey(new Date());
}

/** Build a `YYYY-MM-DD` key from calendar numbers without timezone drift. */
export function dateKey(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Add days to a `YYYY-MM-DD` key, staying in plain calendar arithmetic. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  // Noon UTC keeps the arithmetic clear of any offset edge cases.
  const base = new Date(Date.UTC(year, month - 1, day, 12));
  base.setUTCDate(base.getUTCDate() + days);
  return dateKey(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
  );
}

/** "in 3 days", "tomorrow", "2 weeks ago" — relative to today, in salon time. */
export function formatRelativeDay(iso: string): string {
  const target = salonDateKey(new Date(iso));
  const today = salonToday();
  if (target === today) return "today";
  if (target === addDays(today, 1)) return "tomorrow";
  if (target === addDays(today, -1)) return "yesterday";

  const days = Math.round(
    (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );

  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  return Math.abs(days) >= 14
    ? rtf.format(Math.round(days / 7), "week")
    : rtf.format(days, "day");
}

/** Initials for an avatar. "Amina Karisa" -> "AK". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** ISO weekday (1 = Monday) to its name, matching the backend's convention. */
export function weekdayName(isoWeekday: number): string {
  return WEEKDAY_NAMES[isoWeekday - 1] ?? "";
}

/** "09:00:00" -> "09:00". */
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}
