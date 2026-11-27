/**
 * Money is handled as integer pence inside the domain layer so arithmetic is
 * exact. The DB stores Decimal(10,2); these helpers convert at the boundary.
 */

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

export function toPence(value: string | number | { toString(): string }): number {
  const str = typeof value === "number" ? value.toFixed(2) : value.toString().trim();
  if (!DECIMAL.test(str)) throw new RangeError(`Not a valid money amount: ${str}`);
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -pence : pence;
}

export function fromPence(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatGBP(pence: number): string {
  return gbp.format(pence / 100);
}
