import { describe, expect, it } from "vitest";
import { TONE_RGB, toneOf } from "./tone";

describe("toneOf", () => {
  it("段階ごとの色調", () => {
    expect(toneOf("idle")).toBe("calm");
    expect(toneOf("depositing")).toBe("deposit");
    expect(toneOf("judging")).toBe("judge");
    expect(toneOf("holding")).toBe("stop");
    expect(toneOf("stopped")).toBe("stop");
    expect(toneOf("releasing")).toBe("release");
    expect(toneOf("released")).toBe("release");
    expect(toneOf("refunding")).toBe("refund");
    expect(toneOf("refunded")).toBe("refund");
    expect(toneOf("error")).toBe("error");
  });
});

describe("TONE_RGB", () => {
  it("判断中は紫、止めたは琥珀、解放は緑、失敗は赤が主", () => {
    expect(TONE_RGB.judge[0]).toBe("153, 69, 255");
    expect(TONE_RGB.stop[0]).toBe("255, 181, 71");
    expect(TONE_RGB.release[0]).toBe("20, 241, 149");
    expect(TONE_RGB.error[0]).toBe("255, 93, 108");
    expect(TONE_RGB.refund[0]).toBe("0, 209, 255");
    expect(TONE_RGB.deposit[0]).toBe("0, 209, 255");
    expect(TONE_RGB.calm).toEqual(["153, 69, 255", "20, 241, 149"]);
  });

  it("どの色調も 2 色を RGB の数字で持つ", () => {
    for (const pair of Object.values(TONE_RGB)) {
      expect(pair).toHaveLength(2);
      for (const c of pair) expect(c).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
    }
  });
});
