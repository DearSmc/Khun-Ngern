import { describe, expect, it } from "vitest";
import { formatBaht, parseBaht } from "./money.ts";

describe("parseBaht", () => {
  it.each([
    ["100", 10000],
    ["100.5", 10050],
    ["100.50", 10050],
    ["0.01", 1],
    ["100.", 10000],
    ["1,234.50", 123450],
    ["1,234,567", 123456700],
    ["  42.10  ", 4210],
    ["0019.99", 1999],
  ])("parses %j to %i satang", (input, satang) => {
    expect(parseBaht(input)).toEqual({ ok: true, satang });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "invalid"],
    ["12a", "invalid"],
    ["1.2.3", "invalid"],
    [".50", "invalid"],
    ["1,23.00", "invalid"],
    ["1 000", "invalid"],
    ["+100", "invalid"],
    ["1e3", "invalid"],
    ["100.555", "too_many_decimals"],
    ["-5", "not_positive"],
    ["0", "not_positive"],
    ["0.00", "not_positive"],
    ["999999999999999999", "too_large"],
  ])("rejects %j as %s", (input, error) => {
    expect(parseBaht(input)).toEqual({ ok: false, error });
  });

  it("does not suffer from floating point rounding", () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(parseBaht("0.29")).toEqual({ ok: true, satang: 29 });
    expect(parseBaht("1.13")).toEqual({ ok: true, satang: 113 });
  });
});

describe("formatBaht", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [10050, "100.50"],
    [3334, "33.34"],
    [123450, "1,234.50"],
    [123456700, "1,234,567.00"],
    [-3333, "-33.33"],
  ])("formats %i as %j", (satang, text) => {
    expect(formatBaht(satang)).toBe(text);
  });

  it("rejects non-integer input", () => {
    expect(() => formatBaht(1.5)).toThrow(RangeError);
  });

  it("round-trips with parseBaht", () => {
    for (const satang of [1, 99, 100, 101, 999999, 123456789]) {
      expect(parseBaht(formatBaht(satang))).toEqual({ ok: true, satang });
    }
  });
});
