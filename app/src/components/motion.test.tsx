// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../test/dom";
import { useAttract } from "../hooks/useAttract";
import { useBgm } from "../hooks/useBgm";
import { ATTRACT_CYCLE_MS } from "../lib/attract";
import { BGM_BEAT_MS } from "../lib/thrill";
import { Ambient } from "./Ambient";
import { SlotPulse } from "./SlotPulse";

const playNotes = vi.hoisted(() => vi.fn());
vi.mock("../lib/sfx", () => ({ playNotes }));

/** canvas の 2D context の代わり。呼ばれた描画を数える。 */
function fakeContext() {
  const calls: Record<string, number> = {};
  const count = (name: string) => () => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const ctx = {
    calls,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    setTransform: count("setTransform"),
    clearRect: count("clearRect"),
    drawImage: count("drawImage"),
    beginPath: count("beginPath"),
    arc: count("arc"),
    clip: count("clip"),
    save: count("save"),
    restore: count("restore"),
    stroke: count("stroke"),
    fill: count("fill"),
    scale: count("scale"),
    moveTo: count("moveTo"),
    lineTo: count("lineTo"),
  };
  return ctx;
}

let ctx: ReturnType<typeof fakeContext>;
beforeEach(() => {
  ctx = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
  playNotes.mockClear();
});

describe("SlotPulse", () => {
  it("slot を受け取ると山が立つ波形を描き、時間とともに流れる", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "performance"] });
    const now = performance.now();
    const { container } = render(<SlotPulse slotTimes={[now]} />);
    const first = container.querySelector("path")?.getAttribute("d");
    expect(first).toContain("L120,");
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector("path")?.getAttribute("d")).not.toBe(first);
  });

  it("reduced-motion では平らな線のまま", () => {
    setReducedMotion(true);
    const { container } = render(<SlotPulse slotTimes={[performance.now()]} />);
    expect(container.querySelector("path")?.getAttribute("d")).toBe("M0,11 L120,11");
  });
});

describe("Ambient", () => {
  it("粒子とグリッドを描き続け、slot の波紋と確定の火花を重ねる", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const vault = document.createElement("div");
    vault.className = "vault";
    document.body.append(vault);
    const { rerender, unmount } = render(<Ambient slotTimes={[]} />);
    act(() => vi.advanceTimersByTime(100));
    const framesBefore = ctx.calls.clearRect ?? 0;
    expect(framesBefore).toBeGreaterThan(1);
    expect(ctx.calls.clip ?? 0).toBe(0);

    rerender(<Ambient slotTimes={[performance.now()]} burstId={1} tone={["255, 181, 71", "255, 93, 108"]} />);
    act(() => vi.advanceTimersByTime(100));
    expect(ctx.calls.clip).toBeGreaterThan(0); // 波紋の帯
    expect(ctx.fillStyle).not.toBe("");
    window.dispatchEvent(new Event("resize"));
    act(() => vi.advanceTimersByTime(3000)); // 火花と波紋が消えるまで
    unmount();
    vault.remove();
  });

  it("reduced-motion では 1 回だけ描き、描き続けない（大きさが変われば描き直す）", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    setReducedMotion(true);
    const { rerender, unmount } = render(<Ambient slotTimes={[performance.now()]} />);
    const once = ctx.calls.clearRect;
    expect(once).toBe(1);
    rerender(<Ambient slotTimes={[performance.now()]} burstId={2} />);
    act(() => vi.advanceTimersByTime(500));
    expect(ctx.calls.clearRect).toBe(1);
    expect(ctx.calls.clip ?? 0).toBe(0);
    window.dispatchEvent(new Event("resize"));
    expect(ctx.calls.clearRect).toBe(2);
    unmount();
  });

  it("2D context が取れない環境では何もしない", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { container } = render(<Ambient slotTimes={[]} />);
    expect(container.querySelector("canvas.ambient")).not.toBeNull();
  });
});

describe("useAttract", () => {
  it("active のあいだ台本を進め、止めたら null", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] });
    const { result, rerender } = renderHook(({ on }) => useAttract(on), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current?.phase).toBe("idle");
    act(() => vi.advanceTimersByTime(1300));
    expect(result.current?.phase).toBe("depositing");
    act(() => vi.advanceTimersByTime(ATTRACT_CYCLE_MS));
    expect(result.current?.cycle).toBe(1);
    rerender({ on: false });
    expect(result.current).toBeNull();
  });

  it("もう一度 active になったら最初の場面から", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] });
    const { result, rerender } = renderHook(({ on }) => useAttract(on), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(3000));
    rerender({ on: false });
    rerender({ on: true });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toEqual({ phase: "idle", cycle: 0, judged: false });
  });

  it("状態は場面が変わったときだけ更新する（100 ms ごとに描き直さない）", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useAttract(true);
    });
    const start = renders;
    // act ごとに描き直しがまとまるので、100 ms ずつ別々に進める
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(100));
    };
    // React は同じ値への更新でも 1 回だけ描き直してから打ち切ることがあるので、その分を見込む
    tick(11); // 0〜1.1 秒は idle のまま（以前の実装は 11 回描き直していた）
    expect(renders - start).toBeLessThanOrEqual(2);
    tick(2); // 1.2 秒で depositing に変わる（場面が変わるたびに最大 2 回。以前の実装は 13 回）
    expect(renders - start).toBeLessThanOrEqual(4);
  });

  it("reduced-motion では再生しない", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useAttract(true));
    expect(result.current).toBeNull();
  });
});

describe("useBgm", () => {
  it("active のあいだ拍ごとに小さな音で鳴らし、止めたら鳴らさない", () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ on, combo }) => useBgm(on, combo), { initialProps: { on: true, combo: 0 } });
    act(() => vi.advanceTimersByTime(BGM_BEAT_MS * 2));
    expect(playNotes).toHaveBeenCalledTimes(2);
    expect(playNotes.mock.calls[0]).toEqual([[[220, 0, 0.2, "sine"]], 0.035]);
    expect(playNotes.mock.calls[1][0][0][0]).toBe(277);
    rerender({ on: true, combo: 3 });
    act(() => vi.advanceTimersByTime(BGM_BEAT_MS));
    expect(playNotes.mock.calls[2][0]).toHaveLength(2); // コンボ中は重ねる
    rerender({ on: false, combo: 3 });
    act(() => vi.advanceTimersByTime(BGM_BEAT_MS * 4));
    expect(playNotes).toHaveBeenCalledTimes(3);
  });
});
