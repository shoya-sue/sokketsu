// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../test/dom";
import { StageDeck } from "./StageDeck";
import { VaultHalo } from "./VaultHalo";

const halo = (over: Partial<Parameters<typeof VaultHalo>[0]> = {}) => (
  <VaultHalo phase="judging" probability={0.95} thresholdPct={70} unfoldKey="judging-1" {...over} />
);

describe("VaultHalo", () => {
  it("段階のクラスを付け、読み上げからは外す", () => {
    const el = render(halo()).container.querySelector(".halo");
    expect(el?.className).toContain("halo-judging");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
  });
  it("層を内から外へ順に展開する（--i が 0 から 1 ずつ増える）", () => {
    const layers = [...render(halo()).container.querySelectorAll<HTMLElement>(".halo-l")];
    expect(layers.length).toBeGreaterThanOrEqual(9);
    expect(layers[0].style.getPropertyValue("--i")).toBe("0");
    expect(layers[1].style.getPropertyValue("--i")).toBe("1");
  });
  it("四方に確率・閾値・差・段階を出す", () => {
    const reads = [...render(halo()).container.querySelectorAll(".halo-read")].map((e) => e.textContent);
    expect(reads).toEqual(["P 95%", "THR 70%", "Δ +25", "JUDGING"]);
  });
  it("出た判断だけを光らせる", () => {
    const { container } = render(halo({ decision: "hold" }));
    expect(container.querySelector(".halo-choice.is-on")?.textContent).toBe("HOLD");
    expect(container.querySelectorAll(".halo-choice")).toHaveLength(3);
  });
  it("判断が無ければどれも光らせない", () => {
    expect(render(halo()).container.querySelector(".halo-choice.is-on")).toBeNull();
  });
  it("確定・返金したときだけ衝撃波と光の柱を出す", () => {
    expect(render(halo()).container.querySelector(".halo-shock")).toBeNull();
    expect(render(halo()).container.querySelector(".halo-pillar")).toBeNull();
    for (const phase of ["released", "refunded"] as const) {
      const { container } = render(halo({ phase }));
      expect(container.querySelector(".halo-shock"), phase).not.toBeNull();
      expect(container.querySelector(".halo-pillar"), phase).not.toBeNull();
    }
  });
  it("unfoldKey が変わると作り直して展開をやり直す", () => {
    const { container, rerender } = render(halo());
    const before = container.querySelector(".halo");
    rerender(halo({ unfoldKey: "releasing-1" }));
    expect(container.querySelector(".halo")).not.toBe(before);
  });
  it("目盛りは外 120 本・内 60 本で、長い目盛りを含む", () => {
    const { container } = render(halo());
    expect(container.querySelectorAll(".halo-ticks line")).toHaveLength(120);
    expect(container.querySelectorAll(".halo-inner line")).toHaveLength(60);
    expect(container.querySelectorAll(".halo-ticks line.long")).toHaveLength(12);
  });
});

describe("StageDeck", () => {
  it("床と巨大な「即決」を、読み上げから外して出す", () => {
    const { container } = render(<StageDeck />);
    expect(container.querySelector(".deck")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".deck-floor-grid")).not.toBeNull();
    expect(container.querySelector(".deck-kanji")?.textContent).toBe("即決");
  });
});
