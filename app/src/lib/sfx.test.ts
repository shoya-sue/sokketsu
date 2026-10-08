import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sfx はモジュールの読み込み時に localStorage からミュートを読むので、テストごとに読み直す。
const load = async () => {
  vi.resetModules();
  return import("./sfx");
};

class FakeParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = "sine";
  connect = vi.fn((next: unknown) => next);
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static created = 0;
  state = "running";
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudioContext.created += 1;
  }
  createOscillator = () => new FakeNode();
  createGain = () => new FakeNode();
  resume = vi.fn();
}

beforeEach(() => {
  FakeAudioContext.created = 0;
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  vi.stubGlobal("navigator", { vibrate: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ミュートと BGM・振動（#35）", () => {
  it("ミュート中は音を鳴らさない（AudioContext を作らない）", async () => {
    const sfx = await load();
    sfx.setMuted(true);
    sfx.playNotes([[440, 0, 0.1, "sine"]], 0.03);
    sfx.play("finalize");
    expect(FakeAudioContext.created).toBe(0);
  });

  it("ミュートを解くと鳴る", async () => {
    const sfx = await load();
    sfx.setMuted(false);
    sfx.playNotes([[440, 0, 0.1, "sine"]], 0.03);
    expect(FakeAudioContext.created).toBe(1);
  });

  it("ミュート中は振動させない", async () => {
    const sfx = await load();
    sfx.setMuted(true);
    sfx.vibrate([40, 30, 80]);
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("ミュートでなければ振動のパターンをそのまま渡す（元の配列とは別の配列で）", async () => {
    const sfx = await load();
    sfx.setMuted(false);
    const pattern = [40, 30, 80] as const;
    sfx.vibrate(pattern);
    expect(navigator.vibrate).toHaveBeenCalledWith([40, 30, 80]);
  });

  it("動きを減らす設定のときは振動させない", async () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("reduce") }) });
    const sfx = await load();
    sfx.setMuted(false);
    sfx.vibrate([40]);
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("振動に対応していない端末では何もしない", async () => {
    vi.stubGlobal("navigator", {});
    const sfx = await load();
    sfx.setMuted(false);
    expect(() => sfx.vibrate([30])).not.toThrow();
  });

  it("保存されたミュートを読み込む", async () => {
    localStorage.setItem("sokketsu.muted", "1");
    const sfx = await load();
    expect(sfx.isMuted()).toBe(true);
  });
});
