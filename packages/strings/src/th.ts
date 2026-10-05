// Thai copy (PRD §5 Tone Guide): casual, warm, a friend who's good with money, never a bank.
// Drafts until the bot's persona is decided (#5); the final pass is #32.
// Relative import (not the package name) so backend functions running on Deno resolve it too.
import type { ParseBahtError } from "../../core/src/index.ts";

export const th = {
  common: {
    unexpectedError: "อุ๊ย ขุนเงินงงไปแป๊บ 😵 ลองใหม่อีกทีนะ",
  },
  amount: {
    empty: "ลืมใส่ยอดเงินหรือเปล่าน้า 🤔",
    invalid: "ยอดเงินอ่านไม่ออกเลย ลองพิมพ์เป็นตัวเลข เช่น 250 หรือ 1,250.50 นะ",
    too_many_decimals: "สตางค์มีแค่ 2 หลักนะ เช่น 99.50 😉",
    not_positive: "ยอดต้องมากกว่า 0 บาทน้า",
    too_large: "ยอดเยอะเกินที่ขุนเงินนับไหวแล้ว 😅",
  } satisfies Record<ParseBahtError, string>,
} as const;
