/** The "current" academic year for a UK institution, which starts in September: e.g. "2025/26". */
export function currentAcademicYear(now = new Date()): string {
  const start = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
