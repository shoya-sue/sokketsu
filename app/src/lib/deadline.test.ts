import { describe, expect, it } from "vitest";
import { slotsUntil } from "./deadline";

describe("slotsUntil（hold の期限までの残り slot）", () => {
  it("期限 − いまの slot", () => expect(slotsUntil(1_000, 600)).toBe(400));
  it("いまの slot が進めば減る", () => expect(slotsUntil(1_000, 900)).toBeLessThan(slotsUntil(1_000, 600)!));
  it("期限ちょうど・過ぎたら 0", () => {
    expect(slotsUntil(1_000, 1_000)).toBe(0);
    expect(slotsUntil(1_000, 1_250)).toBe(0);
  });
  it("期限かいまの slot が分からなければ null（何も出さない）", () => {
    expect(slotsUntil(null, 600)).toBeNull();
    expect(slotsUntil(1_000, null)).toBeNull();
  });
});
