// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../test/dom";
import { RAIN_COL_PX } from "../lib/overdrive";
import { DataRain } from "./DataRain";

type Call = { text: string; x: number; y: number };

/** jsdom にはキャンバスの描画が無いので、呼ばれた fillText を記録するだけの偽物を差し込む。 */
function fakeContext() {
  const calls: Call[] = [];
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(() => calls.splice(0)),
    fillText: vi.fn((text: string, x: number, y: number) => calls.push({ text, x, y })),
    font: "",
    textAlign: "",
    fillStyle: "",
  };
  return { ctx, calls };
}

let frames: FrameRequestCallback[] = [];
const runFrame = (t: number) => {
  const pending = frames;
  frames = [];
  for (const f of pending) f(t);
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mount = (width: number) => {
  const { ctx, calls } = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
  const view = render(<DataRain slot={509130078} tone={["153, 69, 255", "20, 241, 149"]} />);
  return { ...view, ctx, calls };
};

describe("DataRain", () => {
  it("読み上げから外したキャンバスを置く", () => {
    const { container } = mount(1280);
    expect(container.querySelector("canvas.od-rain")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reduced-motion では 1 コマだけ描いて、フレームを予約しない", () => {
    setReducedMotion(true);
    const { ctx } = mount(1280);
    expect(ctx.fillText).toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it("普段はフレームごとに描き、外すと止める", () => {
    setReducedMotion(false);
    const { ctx, unmount } = mount(1280);
    expect(frames).toHaveLength(1);
    act(() => runFrame(performance.now() + 100));
    expect(ctx.fillText).toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("20 コマ/秒より速くは描かない（50 ms 経たないと描き直さない）", () => {
    setReducedMotion(false);
    const { ctx } = mount(1280);
    const t0 = performance.now();
    act(() => runFrame(t0 + 100));
    const after = ctx.fillText.mock.calls.length;
    act(() => runFrame(t0 + 110));
    expect(ctx.fillText.mock.calls.length).toBe(after);
  });

  it("広い画面では中央（カードの裏）を描かず、左右の余白の列だけ", () => {
    setReducedMotion(true);
    const { calls } = mount(1280);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.x < 1280 * 0.22 || c.x > 1280 * 0.78, String(c.x)).toBe(true);
  });

  it("狭い画面では全部の列を描く", () => {
    setReducedMotion(true);
    const { calls } = mount(390);
    const cols = new Set(calls.map((c) => c.x));
    expect(cols.size).toBe(Math.floor(390 / RAIN_COL_PX));
  });
});
