import { describe, expect, it } from "vitest";
import {
  MAX_R,
  MAX_SPEED,
  MIN_R,
  WAVE_MS,
  liveWaves,
  particleCount,
  seedParticles,
  stepParticles,
  waveAt,
  wrap,
} from "./ambient";

/** 決まった列を順に返す乱数。 */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("seedParticles", () => {
  it("乱数から位置・速度・大きさを決める", () => {
    // angle=0（右向き）、speed=(0.35+0.65*1)*MAX、x=0.5w、y=0.25h、r=MIN_R
    const [p] = seedParticles(1, 200, 100, seq(0, 1, 0.5, 0.25, 0));
    expect(p.x).toBe(100);
    expect(p.y).toBe(25);
    expect(p.vx).toBeCloseTo(MAX_SPEED);
    expect(p.vy).toBeCloseTo(0);
    expect(p.r).toBe(MIN_R);
  });

  it("速さは上限の 35% 以上、大きさは MAX_R まで", () => {
    // angle=0.25 周（下向き）、speed 最小、r 最大
    const [p] = seedParticles(1, 10, 10, seq(0.25, 0, 0, 0, 1));
    expect(p.vx).toBeCloseTo(0);
    expect(p.vy).toBeCloseTo(0.35 * MAX_SPEED);
    expect(p.r).toBe(MAX_R);
  });

  it("n 個つくる", () => {
    expect(seedParticles(7, 10, 10, Math.random)).toHaveLength(7);
    expect(seedParticles(0, 10, 10, Math.random)).toEqual([]);
  });
});

describe("wrap", () => {
  it("0 以上 size 未満に収める", () => {
    expect(wrap(5, 10)).toBe(5);
    expect(wrap(10, 10)).toBe(0);
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(23, 10)).toBe(3);
  });
});

describe("stepParticles", () => {
  it("速度 × 時間だけ進め、元の列は変えない", () => {
    const ps = [{ x: 1, y: 2, vx: 10, vy: -4, r: 2 }];
    const next = stepParticles(ps, 0.5, 100, 100);
    expect(next).toEqual([{ x: 6, y: 0, vx: 10, vy: -4, r: 2 }]);
    expect(ps[0].x).toBe(1);
  });

  it("端をまたいだら反対側から出る", () => {
    const [p] = stepParticles([{ x: 99, y: 1, vx: 4, vy: -4, r: 1 }], 1, 100, 50);
    expect(p.x).toBe(3);
    expect(p.y).toBe(47);
  });
});

describe("waveAt", () => {
  it("届いた瞬間は半径 0・濃さ 1", () => {
    expect(waveAt(0, 500)).toEqual({ radius: 0, alpha: 1 });
  });

  it("半分の時間で半径は 7/8（ease-out）、濃さは半分", () => {
    const w = waveAt(WAVE_MS / 2, 800);
    expect(w?.radius).toBeCloseTo(700);
    expect(w?.alpha).toBeCloseTo(0.5);
  });

  it("届く前と消えた後は null（ちょうど WAVE_MS で消える）", () => {
    expect(waveAt(-1, 500)).toBeNull();
    expect(waveAt(WAVE_MS, 500)).toBeNull();
    expect(waveAt(WAVE_MS - 1, 500)).not.toBeNull();
  });
});

describe("liveWaves", () => {
  it("見えている波紋だけを返す", () => {
    const now = 10_000;
    const waves = liveWaves([now - WAVE_MS - 5, now - WAVE_MS / 2, now, now + 10], now, 800);
    expect(waves).toHaveLength(2);
    expect(waves[0].alpha).toBeCloseTo(0.5);
    expect(waves[1]).toEqual({ radius: 0, alpha: 1 });
  });
});

describe("particleCount", () => {
  it("面積に比例し、40〜160 に収める", () => {
    expect(particleCount(1100, 1000)).toBe(100);
    expect(particleCount(100, 100)).toBe(40);
    expect(particleCount(4000, 3000)).toBe(160);
  });
});
