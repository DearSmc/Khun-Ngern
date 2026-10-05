import { describe, expect, it } from "vitest";
import { evenSplit, validateCustomSplit, type Share } from "./split.ts";

const sum = (shares: Share[]) => shares.reduce((acc, s) => acc + s.amount, 0);

describe("evenSplit", () => {
  it("gives the remainder to the Owner when the Owner shares (PRD example)", () => {
    // 100.00 THB / 3 with Owner included -> Owner 33.34, others 33.33 each.
    expect(
      evenSplit({ total: 10000, ownerId: "o", memberIds: ["a", "b"], ownerShares: true }),
    ).toEqual([
      { userId: "o", amount: 3334 },
      { userId: "a", amount: 3333 },
      { userId: "b", amount: 3333 },
    ]);
  });

  it("gives the remainder to the first member when the Owner does not share", () => {
    expect(
      evenSplit({ total: 10000, ownerId: "o", memberIds: ["a", "b", "c"], ownerShares: false }),
    ).toEqual([
      { userId: "a", amount: 3334 },
      { userId: "b", amount: 3333 },
      { userId: "c", amount: 3333 },
    ]);
  });

  it("splits exactly when there is no remainder", () => {
    expect(
      evenSplit({ total: 900, ownerId: "o", memberIds: ["a", "b"], ownerShares: true }),
    ).toEqual([
      { userId: "o", amount: 300 },
      { userId: "a", amount: 300 },
      { userId: "b", amount: 300 },
    ]);
  });

  it("puts the whole bill on one member when the Owner does not share", () => {
    expect(evenSplit({ total: 12345, ownerId: "o", memberIds: ["a"], ownerShares: false })).toEqual(
      [{ userId: "a", amount: 12345 }],
    );
  });

  it.each([
    [{ total: 0, ownerId: "o", memberIds: ["a"], ownerShares: true }],
    [{ total: -1, ownerId: "o", memberIds: ["a"], ownerShares: true }],
    [{ total: 1.5, ownerId: "o", memberIds: ["a"], ownerShares: true }],
    [{ total: 100, ownerId: "o", memberIds: [], ownerShares: true }],
    [{ total: 100, ownerId: "o", memberIds: ["o", "a"], ownerShares: true }],
    [{ total: 100, ownerId: "o", memberIds: ["a", "a"], ownerShares: true }],
  ])("rejects invalid input %j", (input) => {
    expect(() => evenSplit(input)).toThrow(RangeError);
  });

  it("always sums to the total (1,000 random cases)", () => {
    let seed = 42;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % max;
    };
    for (let i = 0; i < 1000; i++) {
      const total = 1 + random(10_000_000);
      const memberIds = Array.from({ length: 1 + random(49) }, (_, j) => `m${j}`);
      const ownerShares = random(2) === 1;
      const shares = evenSplit({ total, ownerId: "o", memberIds, ownerShares });

      expect(sum(shares)).toBe(total);
      expect(shares).toHaveLength(memberIds.length + (ownerShares ? 1 : 0));
      const [first = 0, ...rest] = shares.map((s) => s.amount);
      // All shares but the first are equal; the first carries the remainder (< number of shares).
      for (const amount of rest) {
        expect(amount).toBe(rest[0]);
        expect(first - amount).toBeGreaterThanOrEqual(0);
        expect(first - amount).toBeLessThan(shares.length);
      }
    }
  });
});

describe("validateCustomSplit", () => {
  it("accepts amounts that sum to the total", () => {
    expect(
      validateCustomSplit(10000, [
        { userId: "a", amount: 5000 },
        { userId: "b", amount: 3000 },
        { userId: "c", amount: 2000 },
      ]),
    ).toEqual({ ok: true });
  });

  it("reports how much is still missing", () => {
    expect(
      validateCustomSplit(10000, [
        { userId: "a", amount: 5000 },
        { userId: "b", amount: 3000 },
      ]),
    ).toEqual({ ok: false, error: "sum_mismatch", difference: 2000 });
  });

  it("reports how much is too much", () => {
    expect(
      validateCustomSplit(10000, [
        { userId: "a", amount: 6000 },
        { userId: "b", amount: 4001 },
      ]),
    ).toEqual({ ok: false, error: "sum_mismatch", difference: -1 });
  });

  it.each([0, -100, 10.5])("rejects a share of %d", (amount) => {
    expect(
      validateCustomSplit(10000, [
        { userId: "a", amount: 10000 },
        { userId: "b", amount },
      ]),
    ).toEqual({ ok: false, error: "invalid_amount", userId: "b" });
  });

  it("rejects the same person twice", () => {
    expect(
      validateCustomSplit(200, [
        { userId: "a", amount: 100 },
        { userId: "a", amount: 100 },
      ]),
    ).toEqual({ ok: false, error: "duplicate_user", userId: "a" });
  });
});
