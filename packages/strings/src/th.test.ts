import { describe, expect, it } from "vitest";
import { th } from "./th.ts";

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Object.values(value as Record<string, unknown>).flatMap(allStrings);
}

describe("th", () => {
  it("has no empty strings", () => {
    for (const text of allStrings(th)) expect(text.trim()).not.toBe("");
  });

  it("is written in Thai", () => {
    for (const text of allStrings(th)) expect(text).toMatch(/[฀-๿]/);
  });
});
