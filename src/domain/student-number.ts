/** SMS-{intake year}-{sequence, zero-padded to at least 4 digits}. */
export function formatStudentNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new RangeError(`Invalid sequence: ${sequence}`);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new RangeError(`Invalid year: ${year}`);
  return `SMS-${year}-${String(sequence).padStart(4, "0")}`;
}

const ACADEMIC_YEAR = /^(\d{4})\/(\d{2})$/;

/** "2025/26" — second part must be the following year (2099/00 wraps correctly). */
export function isValidAcademicYear(value: string): boolean {
  const m = ACADEMIC_YEAR.exec(value);
  if (!m) return false;
  const start = Number(m[1]);
  return (start + 1) % 100 === Number(m[2]);
}

export function intakeYear(academicYear: string): number {
  if (!isValidAcademicYear(academicYear)) throw new RangeError(`Invalid academic year: ${academicYear}`);
  return Number(academicYear.slice(0, 4));
}
