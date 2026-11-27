const MIN = 60_000;
const HOUR = 60 * MIN;
const URGENT_MS = 48 * HOUR;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "Due in 3 days" etc. `urgent` = less than 48 hours left (and not passed). */
export function countdown(deadline: Date, now: Date): { label: string; urgent: boolean } {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return { label: "Deadline passed", urgent: false };
  if (ms < HOUR) return { label: `Due in ${plural(Math.max(1, Math.ceil(ms / MIN)), "minute")}`, urgent: true };
  if (ms < URGENT_MS) return { label: `Due in ${plural(Math.floor(ms / HOUR), "hour")}`, urgent: true };
  return { label: `Due in ${plural(Math.floor(ms / (24 * HOUR)), "day")}`, urgent: false };
}
