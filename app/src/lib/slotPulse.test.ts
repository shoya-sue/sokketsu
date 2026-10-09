import { describe, expect, it } from "vitest";
import { pulsePath, pushSlotTime } from "./slotPulse";

describe("pushSlotTime", () => {
  it("新しい時刻を末尾に足した新しい配列を返す（元は変えない）", () => {
    const before = [1, 2];
    const after = pushSlotTime(before, 3);
    expect(after).toEqual([1, 2, 3]);
    expect(before).toEqual([1, 2]);
  });
  it("上限を超えたら古いものから捨てる", () => expect(pushSlotTime([1, 2, 3], 4, 3)).toEqual([2, 3, 4]));
});

describe("pulsePath（slot ごとに脈打つ波形）", () => {
  it("slot が無ければ平らな線", () => expect(pulsePath([], 1000, 100, 20, 1000)).toBe("M0,10 L100,10"));
  it("窓の中の slot ごとに 1 つ山を立てる（右端が現在）", () => {
    const d = pulsePath([500], 1000, 100, 20, 1000);
    // 現在 1000・窓 1000ms → slot 500 は x=50 に山
    expect(d).toBe("M0,10 L47,10 L50,2 L53,18 L56,10 L100,10");
  });
  it("窓より古い slot は描かない", () => expect(pulsePath([-500], 1000, 100, 20, 1000)).toBe("M0,10 L100,10"));
  it("未来の slot（時計のずれ）は描かない", () => expect(pulsePath([1500], 1000, 100, 20, 1000)).toBe("M0,10 L100,10"));
  it("ちょうど窓の端と現在の slot は描く", () =>
    expect(pulsePath([0, 1000], 1000, 100, 20, 1000)).toBe(
      "M0,10 L-3,10 L0,2 L3,18 L6,10 L97,10 L100,2 L103,18 L106,10 L100,10",
    ));
  it("順序が乱れて届いても、時刻の順に描く（桁数の違う時刻を含む）", () =>
    expect(pulsePath([950, 100], 1000, 100, 20, 1000)).toBe(
      "M0,10 L7,10 L10,2 L13,18 L16,10 L92,10 L95,2 L98,18 L101,10 L100,10",
    ));
});
