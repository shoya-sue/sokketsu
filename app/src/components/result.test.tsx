// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../test/dom";
import type { Measurement } from "../chain";
import { INITIAL_GAME } from "../lib/game";
import { BadgeOverlay } from "./BadgeOverlay";
import { FinalityHit, type Hit } from "./FinalityHit";
import { Hud } from "./Hud";
import { MeasureViz } from "./MeasureViz";
import { ResultPanel } from "./ResultPanel";

const sent = (m: Partial<Measurement>) =>
  ({
    kind: "sent",
    labelKey: "label.release",
    measurement: { signature: "SIG", processedMs: 400, finalizedMs: 800, error: null, rateLimited: false, ...m },
  }) as const;

describe("ResultPanel", () => {
  it("まだ何も無いときは空の数字", () => {
    const { container } = render(<ResultPanel outcome={null} measuringSince={null} slotsLeft={null} grade={null} />);
    expect(container.querySelector(".result-idle .result-number")?.textContent).toBe("----");
  });

  it("計測中は経過ミリ秒を数える", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const since = performance.now();
    const { container } = render(<ResultPanel outcome={null} measuringSince={since} slotsLeft={null} grade={null} />);
    act(() => vi.advanceTimersByTime(250));
    const n = Number(container.querySelector(".result-live .result-number")?.textContent);
    expect(n).toBeGreaterThanOrEqual(200);
    expect(n).toBeLessThanOrEqual(300);
  });

  it("止めたときは 0 lamport と、判断と残り slot を出す", () => {
    const { container } = render(
      <ResultPanel outcome={{ kind: "stopped", judge: { decision: "hold", probability: 0.991, source: "jev" } }} measuringSince={null} slotsLeft={1234} grade={null} />,
    );
    expect(container.querySelector(".result-stopped .result-number")?.textContent).toBe("0");
    expect(container.querySelector(".stopped-text")?.textContent).toContain("99.1");
    expect(container.querySelector(".result-stopped .hint")?.textContent).toContain("1,234");
  });

  it("送金の失敗と、確定を観測できなかった送金", () => {
    const failed = render(<ResultPanel outcome={sent({ error: "boom" })} measuringSince={null} slotsLeft={null} grade={null} />);
    expect(failed.container.querySelector(".result-error code")?.textContent).toBe("boom");
    failed.unmount();
    const unconfirmed = render(<ResultPanel outcome={sent({ finalizedMs: null })} measuringSince={null} slotsLeft={null} grade={null} />);
    expect(unconfirmed.container.querySelector(".result-error code")?.textContent).toBe("SIG");
  });

  it("確定したら数え上げ、ランク・Tower BFT との比較・内訳を出す（reduced-motion は最終値）", () => {
    setReducedMotion(true);
    const { container } = render(<ResultPanel outcome={sent({ finalizedMs: 800, rateLimited: true })} measuringSince={null} slotsLeft={null} grade="A" />);
    expect(container.querySelector(".result-win .result-number")?.textContent).toBe("800");
    expect(container.querySelector(".grade-stamp")?.textContent).toBe("RANKA");
    expect(container.querySelector(".speedup strong")?.textContent).toBe("16");
    expect(container.querySelector<HTMLElement>(".race-ours")?.style.getPropertyValue("--w")).toBe("6.25%");
    expect(container.querySelector(".measure")).not.toBeNull();
    expect(container.querySelector(".warn-note")).not.toBeNull();
  });

  it("10 倍未満の速さは小数 1 桁、数え上げは時間とともに最終値へ", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const { container } = render(<ResultPanel outcome={sent({ finalizedMs: 2000 })} measuringSince={null} slotsLeft={null} grade={null} />);
    expect(container.querySelector(".speedup strong")?.textContent).toBe("6.4");
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector(".result-win .result-number")?.textContent).toBe("2000");
    expect(container.querySelector(".grade-stamp")).toBeNull();
  });
});

describe("MeasureViz", () => {
  it("送信 → processed → finalized の時刻と窓を出す", () => {
    const { container } = render(<MeasureViz processedMs={409} finalizedMs={797} />);
    const log = [...container.querySelectorAll(".measure-log li")].map((li) => li.textContent);
    expect(log).toEqual(["   0 ms送信", " 409 msprocessed", " 797 msfinalized"]);
    expect(container.querySelector(".measure-head small")?.textContent).toBe("1 秒の窓");
    expect(container.querySelectorAll(".tick")).toHaveLength(11);
    expect(container.querySelectorAll(".tick.major")).toHaveLength(2);
    expect(container.querySelector(".stair")?.getAttribute("points")).not.toBe("");
  });
});

describe("Hud", () => {
  it("レベル・スコア・コンボ・ベストを出し、2 連続から炎を灯す", () => {
    const { container, rerender } = render(<Hud game={{ ...INITIAL_GAME, xp: 450, combo: 1, bestMs: 812.4 }} gain={{ amount: 120, key: 1 }} />);
    expect(container.querySelector(".hud-level-num")?.textContent).toBe("3");
    expect(container.querySelector(".hud-gain")?.textContent).toBe("+120");
    expect(container.querySelector(".hud-best-num")?.textContent).toBe("812ms");
    expect(container.querySelector(".hud-fire")).toBeNull();
    expect(container.querySelector(".hud-bar")?.getAttribute("aria-valuenow")).toBe("10");
    rerender(<Hud game={{ ...INITIAL_GAME, combo: 3 }} gain={null} />);
    expect(container.querySelector(".hud-combo")?.className).toContain("hot");
    expect(container.querySelector(".hud-combo")?.className).toContain("fire-2");
    expect(container.querySelector(".hud-fire")?.textContent).toBe("🔥🔥");
    expect(container.querySelector(".hud-fire")?.getAttribute("aria-label")).toBe("3 連続");
    expect(container.querySelector(".hud-best-num")?.textContent).toBe("—");
    expect(container.querySelector(".hud-gain")).toBeNull();
  });

  it("スコアは目標値まで数え上げる", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const { container, rerender } = render(<Hud game={INITIAL_GAME} gain={null} />);
    rerender(<Hud game={{ ...INITIAL_GAME, xp: 1000 }} gain={null} />);
    act(() => vi.advanceTimersByTime(800));
    expect(container.querySelector(".hud-score")?.textContent).toBe("1,000");
  });
});

const hit = (over: Partial<Hit> = {}): Hit => ({
  id: 1,
  kind: "release",
  ms: 739,
  grade: "A",
  near: { next: "S", shortMs: 140, close: false },
  tier: "epic",
  jackpot: "best",
  ...over,
});

describe("FinalityHit", () => {
  it("無いときは何も出さない", () => {
    const { container } = render(<FinalityHit hit={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("数字を回してから止め、ランク・惜しさ・大当たりを出す", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const { container } = render(<FinalityHit hit={hit()} />);
    const root = container.querySelector(".finality-hit");
    expect(root?.className).toContain("tier-epic");
    expect(root?.className).toContain("is-jackpot");
    expect(root?.getAttribute("aria-label")).toBe("解放を確定 739 ms");
    expect(container.querySelector(".hit-ms")?.className).toContain("rolling");
    expect(container.querySelector(".hit-near")).toBeNull();
    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelector(".hit-ms")?.textContent).toBe("739ms");
    expect(container.querySelector(".hit-ms")?.className).toContain("locked");
    expect(container.querySelector(".hit-grade")?.textContent).toBe("A");
    expect(container.querySelector(".hit-near")?.textContent).toBe("あと 140 ms で S ランク");
    expect(container.querySelector(".hit-near")?.className).not.toContain("close");
    expect(container.querySelector(".hit-jackpot")?.textContent).toBe("自己ベスト更新");
    expect(container.querySelector(".hit-rays")).not.toBeNull();
    expect(container.querySelectorAll(".hit-rings i")).toHaveLength(5);
  });

  it("回っている桁が偶然 target と同じ数字になっても、止まった扱いにしない", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    const { container } = render(<FinalityHit hit={hit({ ms: 797 })} />);
    // 797 は t = 520〜559 ms で表示が "797" になるが、まだ回っている
    act(() => vi.advanceTimersByTime(540));
    expect(container.querySelector(".hit-ms")?.textContent).toBe("797ms");
    expect(container.querySelector(".hit-ms")?.className).toContain("rolling");
    expect(container.querySelector(".hit-near")).toBeNull();
    expect(container.querySelector(".hit-grade")).toBeNull();
  });

  it("reduced-motion では回さずに最終値。返金・S ランクの大当たり・惜しい表示", () => {
    setReducedMotion(true);
    const { container } = render(
      <FinalityHit hit={hit({ kind: "refund", jackpot: "s-rank", near: { next: "A", shortMs: 20, close: true }, tier: null, grade: null })} />,
    );
    expect(container.querySelector(".hit-ms")?.textContent).toBe("739ms");
    expect(container.querySelector(".hit-kicker")?.textContent).toBe("返金を確定");
    expect(container.querySelector(".hit-jackpot")?.textContent).toBe("大当たり");
    expect(container.querySelector(".hit-near")?.className).toContain("close");
    expect(container.querySelector(".hit-grade")).toBeNull();
    expect(container.querySelector(".finality-hit")?.className).not.toContain("tier-");
  });

  it("大当たりでなければ帯は出さない（光の筋は毎回回す）", () => {
    setReducedMotion(true);
    const { container } = render(<FinalityHit hit={hit({ jackpot: null, near: null })} />);
    expect(container.querySelector(".hit-rays")).not.toBeNull();
    expect(container.querySelector(".finality-hit")?.className).not.toContain("is-jackpot");
    expect(container.querySelector(".hit-jackpot")).toBeNull();
    expect(container.querySelector(".hit-near")).toBeNull();
  });
});

describe("BadgeOverlay", () => {
  const badge = { id: 1, icon: "⚡", kicker: "実績解除", title: "初めての即決", body: "本文" };

  it("無いときは何も出さない", () => {
    const { container } = render(<BadgeOverlay badge={null} onDone={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("中身と金の粒子を出し、2.8 秒で閉じる", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(<BadgeOverlay badge={badge} onDone={onDone} />);
    expect(container.querySelector(".badge-title")?.textContent).toBe("初めての即決");
    expect(container.querySelectorAll(".gold-particle")).toHaveLength(18);
    act(() => vi.advanceTimersByTime(2799));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("カーソルの向きに傾く（reduced-motion では傾かず、粒子も出さない）", () => {
    const { container, unmount } = render(<BadgeOverlay badge={badge} onDone={() => {}} />);
    const overlay = container.querySelector<HTMLElement>(".badge-overlay")!;
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(overlay, { clientX: 200, clientY: 0 });
    expect(container.querySelector<HTMLElement>(".badge")?.style.transform).toBe("perspective(700px) rotateX(14deg) rotateY(14deg)");
    unmount();

    setReducedMotion(true);
    const reduced = render(<BadgeOverlay badge={badge} onDone={() => {}} />);
    const o2 = reduced.container.querySelector<HTMLElement>(".badge-overlay")!;
    fireEvent.pointerMove(o2, { clientX: 200, clientY: 0 });
    expect(reduced.container.querySelector<HTMLElement>(".badge")?.style.transform).toBe("perspective(700px) rotateX(0deg) rotateY(0deg)");
    expect(reduced.container.querySelectorAll(".gold-particle")).toHaveLength(0);
  });
});
