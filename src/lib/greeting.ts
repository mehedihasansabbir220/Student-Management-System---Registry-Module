/** Time-of-day greeting for an hour 0–23 in the *viewer's* timezone. */
export function greeting(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
