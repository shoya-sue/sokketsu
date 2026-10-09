import { describe, expect, it } from "vitest";
import { STEP_KEYS, haloReadouts, stepLights, tickLines } from "./halo";

describe("tickLines", () => {
  it("n 本の目盛りを円周に等間隔で置き、every 本ごとに長くする", () => {
    const lines = tickLines(4, 100, 10, 20, 2);
    expect(lines).toHaveLength(4);
    // 0 本目は真上（長い）、1 本目は右（短い）
    expect(lines[0].long).toBe(true);
    expect(lines[0].x1).toBeCloseTo(0);
    expect(lines[0].y1).toBeCloseTo(-100);
    expect(lines[0].x2).toBeCloseTo(0);
    expect(lines[0].y2).toBeCloseTo(-80);
    expect(lines[1].long).toBe(false);
    expect(lines[1].x1).toBeCloseTo(100);
    expect(lines[1].y1).toBeCloseTo(0);
    expect(lines[1].x2).toBeCloseTo(90);
    expect(lines[2].y1).toBeCloseTo(100);
    expect(lines[2].long).toBe(true);
    expect(lines[3].long).toBe(false);
  });
});

describe("haloReadouts", () => {
  it("確率が出ていれば P と閾値との差を出す", () => {
    const r = haloReadouts({ phase: "judging", probability: 0.95, thresholdPct: 70 });
    expect(r).toEqual(["P 95%", "THR 70%", "Δ +25", "JUDGING"]);
  });
  it("閾値に届かなければ差は負", () => {
    expect(haloReadouts({ phase: "holding", probability: 0.6, thresholdPct: 70 })[2]).toBe("Δ -10");
  });
  it("ちょうど閾値なら ±0", () => {
    expect(haloReadouts({ phase: "holding", probability: 0.7, thresholdPct: 70 })[2]).toBe("Δ ±0");
  });
  it("確率が無ければ空欄の印", () => {
    expect(haloReadouts({ phase: "idle", probability: null, thresholdPct: 70 })).toEqual([
      "P ——",
      "THR 70%",
      "Δ ——",
      "IDLE",
    ]);
  });
});

describe("stepLights", () => {
  it("段階の 4 工程（預け入れ・判断・検証・確定）", () => {
    expect(STEP_KEYS).toEqual(["DEPOSIT", "JUDGE", "VERIFY", "FINALIZE"]);
  });
  it("待機中はすべて消灯", () => {
    expect(stepLights("idle")).toEqual(["off", "off", "off", "off"]);
  });
  it("預け入れ中は 1 工程目が点滅", () => {
    expect(stepLights("depositing")).toEqual(["live", "off", "off", "off"]);
  });
  it("判断中は預け入れ済み・判断が点滅", () => {
    expect(stepLights("judging")).toEqual(["done", "live", "off", "off"]);
  });
  it("執行中は検証まで済み、確定が点滅", () => {
    expect(stepLights("releasing")).toEqual(["done", "done", "done", "live"]);
    expect(stepLights("refunding")).toEqual(["done", "done", "done", "live"]);
  });
  it("確定したらすべて点灯", () => {
    expect(stepLights("released")).toEqual(["done", "done", "done", "done"]);
    expect(stepLights("refunded")).toEqual(["done", "done", "done", "done"]);
  });
  it("止めた（hold）は判断まで済み、検証は止まった印", () => {
    expect(stepLights("holding")).toEqual(["done", "done", "stop", "off"]);
    expect(stepLights("stopped")).toEqual(["done", "done", "stop", "off"]);
  });
  it("失敗は判断の位置に失敗の印", () => {
    expect(stepLights("error")).toEqual(["done", "stop", "off", "off"]);
  });
});
