import { describe, expect, it } from "vitest";
import { HISTORY_SIZE, allSubSecond, median, parseHistory, pushSample, type Sample } from "./stats";

const s = (ms: number, at = ms): Sample => ({ ms, at, label: "release" });

describe("median", () => {
  it("空なら null", () => expect(median([])).toBeNull());
  it("奇数個は真ん中", () => expect(median([900, 100, 500])).toBe(500));
  it("偶数個は真ん中 2 つの平均", () => expect(median([100, 400, 200, 300])).toBe(250));
  it("元の配列を並べ替えない", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("pushSample", () => {
  it("新しいものを先頭に足し、直近 5 件だけ残す", () => {
    const history = [1, 2, 3, 4, 5].map((n) => s(n));
    const next = pushSample(history, s(6));
    expect(next).toHaveLength(HISTORY_SIZE);
    expect(next.map((x) => x.ms)).toEqual([6, 1, 2, 3, 4]);
  });
  it("元の配列を変えない", () => {
    const history = [s(1)];
    pushSample(history, s(2));
    expect(history).toEqual([s(1)]);
  });
});

describe("allSubSecond", () => {
  it("空なら false", () => expect(allSubSecond([])).toBe(false));
  it("すべて 1000ms 未満なら true", () => expect(allSubSecond([s(999), s(400)])).toBe(true));
  it("1000ms 以上が混ざれば false", () => expect(allSubSecond([s(1000), s(400)])).toBe(false));
});

describe("parseHistory", () => {
  it("null や空文字は空", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("")).toEqual([]);
  });
  it("壊れた JSON は空", () => expect(parseHistory("{oops")).toEqual([]));
  it("配列でなければ空", () => expect(parseHistory('{"ms":1}')).toEqual([]));
  it("形の違う要素を捨て、正しいものだけ残す", () => {
    const raw = JSON.stringify([s(500), { ms: "x" }, null, { ms: Infinity, at: 1, label: "a" }, s(700)]);
    expect(parseHistory(raw)).toEqual([s(500), s(700)]);
  });
  it("6 件以上あっても 5 件に切る", () => {
    const raw = JSON.stringify([1, 2, 3, 4, 5, 6].map((n) => s(n)));
    expect(parseHistory(raw)).toHaveLength(HISTORY_SIZE);
  });
});
