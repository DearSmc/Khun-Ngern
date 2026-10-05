// F1.3: money is always an integer number of satang (1 THB = 100 satang).
// Never use floating point arithmetic on money.

export type Satang = number;

export type ParseBahtError =
  "empty" | "invalid" | "too_many_decimals" | "not_positive" | "too_large";

export type ParseBahtResult = { ok: true; satang: Satang } | { ok: false; error: ParseBahtError };

// Digits with optional thousands separators in groups of three, optional decimals.
const AMOUNT_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d*))?$/;

/**
 * Parses a positive THB amount typed by a user, such as "100", "100.5" or "1,234.50",
 * into satang. Works on the string itself, so no floating point rounding is involved.
 */
export function parseBaht(input: string): ParseBahtResult {
  const text = input.trim();
  if (text === "") return { ok: false, error: "empty" };
  if (text.startsWith("-")) return { ok: false, error: "not_positive" };

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) return { ok: false, error: "invalid" };

  const whole = (match[1] ?? "").replaceAll(",", "");
  const fraction = match[2] ?? "";
  if (fraction.length > 2) return { ok: false, error: "too_many_decimals" };

  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang)) return { ok: false, error: "too_large" };
  if (satang <= 0) return { ok: false, error: "not_positive" };
  return { ok: true, satang };
}

/** Formats satang as a THB amount with thousands separators, e.g. 123450 -> "1,234.50". */
export function formatBaht(satang: Satang): string {
  if (!Number.isSafeInteger(satang)) throw new RangeError(`Not a satang amount: ${satang}`);
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}
