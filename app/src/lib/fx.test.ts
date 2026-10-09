import { beforeEach, describe, expect, it, vi } from "vitest";

const confetti = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confetti }));

import { burstAt, sideCannons, starShower } from "./fx";

beforeEach(() => {
  confetti.mockClear();
  vi.unstubAllGlobals();
});

const base = { colors: ["#9945ff", "#14f195", "#00d1ff", "#ffd166", "#ff5ea8"], disableForReducedMotion: true, zIndex: 60 };

describe("burstAt", () => {
  it("要素の中心から、ランクに応じた数の紙吹雪を出す", () => {
    vi.stubGlobal("window", { innerWidth: 1000, innerHeight: 500 });
    vi.stubGlobal("document", {
      querySelector: () => ({ getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100 }) }),
    });
    burstAt(".node-payee", "A");
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(confetti).toHaveBeenCalledWith({ ...base, origin: { x: 0.2, y: 0.3 }, particleCount: 140, spread: 80, startVelocity: 42 });
  });

  it("S ランクは星も全方向に出す", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    burstAt(".x", "S");
    expect(confetti).toHaveBeenCalledTimes(2);
    expect(confetti.mock.calls[0][0]).toMatchObject({ origin: { x: 0.5, y: 0.5 }, particleCount: 220 });
    expect(confetti.mock.calls[1][0]).toEqual({ ...base, origin: { x: 0.5, y: 0.5 }, particleCount: 60, spread: 360, startVelocity: 26, shapes: ["star"], scalar: 1.3 });
  });

  it("ランクごとの粒の数（B・C）と、document が無い環境では画面中央", () => {
    vi.stubGlobal("document", undefined);
    burstAt(".x", "B");
    burstAt(".x", "C");
    expect(confetti.mock.calls.map((c) => [c[0].particleCount, c[0].origin])).toEqual([
      [90, { x: 0.5, y: 0.5 }],
      [60, { x: 0.5, y: 0.5 }],
    ]);
  });
});

describe("sideCannons / starShower", () => {
  it("左右から打ち上げる", () => {
    sideCannons();
    expect(confetti.mock.calls).toEqual([
      [{ ...base, particleCount: 70, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } }],
      [{ ...base, particleCount: 70, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } }],
    ]);
  });

  it("星を降らせる", () => {
    starShower();
    expect(confetti).toHaveBeenCalledWith({
      ...base,
      particleCount: 120,
      spread: 160,
      startVelocity: 30,
      gravity: 0.6,
      shapes: ["star"],
      colors: ["#ffd166", "#fff3c4", "#14f195"],
      origin: { x: 0.5, y: 0.25 },
    });
  });
});
