// F1.3: split a bill total into per-person shares, in satang.
import type { Satang } from "./money.ts";

export interface Share {
  userId: string;
  amount: Satang;
}

export interface EvenSplitInput {
  total: Satang;
  ownerId: string;
  /** Members other than the Owner, in the order they were added to the bill. */
  memberIds: readonly string[];
  /** Whether the Owner also takes a share of the bill. */
  ownerShares: boolean;
}

/**
 * Splits `total` evenly. Every share gets floor(total / n); the leftover satang go to the
 * Owner when the Owner shares the bill, otherwise to the first Member.
 * The returned shares always sum to `total` exactly. Owner first when sharing, then members
 * in the given order.
 */
export function evenSplit({ total, ownerId, memberIds, ownerShares }: EvenSplitInput): Share[] {
  assertPositiveSatang(total);
  if (memberIds.length === 0) throw new RangeError("At least one member other than the Owner");
  if (memberIds.includes(ownerId)) throw new RangeError("Owner must not be listed as a member");
  if (new Set(memberIds).size !== memberIds.length) throw new RangeError("Duplicate member");

  const userIds = ownerShares ? [ownerId, ...memberIds] : [...memberIds];
  const base = Math.floor(total / userIds.length);
  const remainder = total - base * userIds.length;
  // Whoever is first gets the remainder: the Owner if sharing, else the first member.
  return userIds.map((userId, i) => ({ userId, amount: i === 0 ? base + remainder : base }));
}

export type CustomSplitResult =
  | { ok: true }
  | { ok: false; error: "invalid_amount"; userId: string }
  | { ok: false; error: "duplicate_user"; userId: string }
  | {
      ok: false;
      error: "sum_mismatch";
      /** total minus the sum of shares: positive means still missing, negative means too much. */
      difference: Satang;
    };

/** Checks a custom split: every amount is a positive satang integer and they sum to `total`. */
export function validateCustomSplit(total: Satang, shares: readonly Share[]): CustomSplitResult {
  assertPositiveSatang(total);
  const seen = new Set<string>();
  let sum = 0;
  for (const { userId, amount } of shares) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return { ok: false, error: "invalid_amount", userId };
    }
    if (seen.has(userId)) return { ok: false, error: "duplicate_user", userId };
    seen.add(userId);
    sum += amount;
  }
  if (sum !== total) return { ok: false, error: "sum_mismatch", difference: total - sum };
  return { ok: true };
}

function assertPositiveSatang(total: Satang): void {
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new RangeError(`Total must be a positive satang integer, got ${total}`);
  }
}
