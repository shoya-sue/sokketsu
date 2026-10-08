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
  BURST_S,
  DRAG_PER_S,
  burstSparks,
  stepSparks,
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

describe("burstSparks", () => {
  it("中心から乱数の向き・速さで飛ばし、寿命は BURST_S の 60〜100%", () => {
    // angle=0、speed=260+0.5*460、r=1.6+1*2、life=BURST_S*(0.6+0.4*1)
    const [s] = burstSparks(1, 10, 20, seq(0, 0.5, 1, 1));
    expect(s.x).toBe(10);
    expect(s.y).toBe(20);
    expect(s.vx).toBeCloseTo(490);
    expect(s.vy).toBeCloseTo(0);
    expect(s.r).toBeCloseTo(3.6);
    expect(s.life).toBeCloseTo(BURST_S);
    const [slow] = burstSparks(1, 0, 0, seq(0.25, 0, 0, 0));
    expect(slow.vy).toBeCloseTo(260);
    expect(slow.r).toBeCloseTo(1.6);
    expect(slow.life).toBeCloseTo(BURST_S * 0.6);
  });

  it("n 個つくる", () => {
    expect(burstSparks(5, 0, 0, Math.random)).toHaveLength(5);
  });
});

describe("stepSparks", () => {
  it("進めて減速し、寿命を減らす（元の列は変えない）", () => {
    const sparks = [{ x: 0, y: 0, vx: 100, vy: -50, r: 2, life: 1.5 }];
    const [s] = stepSparks(sparks, 1);
    expect(s.x).toBe(100);
    expect(s.y).toBe(-50);
    expect(s.vx).toBeCloseTo(100 * DRAG_PER_S);
    expect(s.vy).toBeCloseTo(-50 * DRAG_PER_S);
    expect(s.life).toBeCloseTo(0.5);
    expect(sparks[0].x).toBe(0);
  });

  it("進む距離は速度 × 時間", () => {
    const [s] = stepSparks([{ x: 0, y: 0, vx: 100, vy: 40, r: 2, life: 2 }], 0.5);
    expect(s.x).toBe(50);
    expect(s.y).toBe(20);
    expect(s.vx).toBeCloseTo(100 * Math.sqrt(DRAG_PER_S));
  });

  it("寿命が尽きたら消える（ちょうど 0 で消える）", () => {
    const sparks = [
      { x: 0, y: 0, vx: 0, vy: 0, r: 1, life: 0.5 },
      { x: 0, y: 0, vx: 0, vy: 0, r: 1, life: 0.6 },
    ];
    expect(stepSparks(sparks, 0.5)).toHaveLength(1);
    expect(stepSparks(sparks, 0.5)[0].life).toBeCloseTo(0.1);
  });
});
