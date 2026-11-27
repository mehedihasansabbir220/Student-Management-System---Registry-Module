/**
 * Display formatting. Pinned to Europe/London so server-rendered and
 * client-rendered output match (no hydration mismatches) and deadlines are
 * shown in the institution's timezone.
 */
const TZ = "Europe/London";

type DateLike = Date | string | null | undefined;
const toDate = (d: DateLike) => (d == null ? null : d instanceof Date ? d : new Date(d));

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
  timeZoneName: "short",
});

/** Date-only values (DOB, due date, payment date) are stored as UTC midnight → format in UTC. */
export function formatDate(d: DateLike): string {
  const date = toDate(d);
  return date ? dateFmt.format(date) : "—";
}

export function formatDateTime(d: DateLike): string {
  const date = toDate(d);
  if (!date) return "—";
  const parts = Object.fromEntries(dateTimeFmt.formatToParts(date).map((p) => [p.type, p.value]));
  // en-GB renders London summer time as "BST" and winter as "GMT"
  const zone = parts.timeZoneName === "GMT+1" ? "BST" : parts.timeZoneName;
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${zone}`;
}

const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "always" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function relativeToNow(d: DateLike, now = new Date()): string {
  const date = toDate(d);
  if (!date) return "—";
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 60_000) return diff >= 0 ? "in less than a minute" : "less than a minute ago";
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.trunc(diff / ms), unit);
  }
  return rtf.format(Math.trunc(diff / 60_000), "minute");
}

export function toDateInput(d: DateLike): string {
  const date = toDate(d);
  return date ? date.toISOString().slice(0, 10) : "";
}

export const STATUS_LABEL = {
  ENROLLED: "Enrolled",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
} as const;

export const METHOD_LABEL = {
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  SPONSOR: "Sponsor / SLC",
  OTHER: "Other",
} as const;
