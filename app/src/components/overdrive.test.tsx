// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../test/dom";
import { OverdriveBack, OverdriveFront, SolanaLogo, Ticker } from "./Overdrive";

describe("Ticker", () => {
  it("項目を 2 列並べる（半分ずらして継ぎ目なく流すため）", () => {
    const { container } = render(<Ticker items={["A", "B", "C"]} />);
    const rows = container.querySelectorAll(".od-ticker-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe("ABC");
    expect(rows[1].textContent).toBe("ABC");
  });
  it("reverse で逆向きのクラスを付ける", () => {
    const { container } = render(<Ticker items={["A"]} reverse />);
    expect(container.querySelector(".od-ticker.is-reverse")).not.toBeNull();
  });
  it("読み上げからは外す", () => {
    const { container } = render(<Ticker items={["A"]} />);
    expect(container.querySelector(".od-ticker")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("SolanaLogo", () => {
  it("配布元の SVG をそのまま、元の縦横比で読み込む", () => {
    const { getByRole } = render(<SolanaLogo label="Solana" />);
    const img = getByRole("img", { name: "Solana" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/brand/solana-logo.svg");
    expect(img.getAttribute("width")).toBe("646");
    expect(img.getAttribute("height")).toBe("96");
  });
});

describe("OverdriveBack", () => {
  it("奥の層を重ね、公式ロゴは使わない", () => {
    const { container } = render(<OverdriveBack slot={1} tone={["1, 2, 3", "4, 5, 6"]} hitKey={null} />);
    for (const cls of ["od-aurora", "od-hex", "od-marks", "od-bands", "od-rain"]) {
      expect(container.querySelector(`.${cls}`), cls).not.toBeNull();
    }
    expect(container.querySelectorAll(".od-mark")).toHaveLength(3);
    expect(container.querySelector('img[src*="solana"]')).toBeNull();
  });
  it("確定の瞬間（hitKey あり）だけ閃光を出す", () => {
    const { container, rerender } = render(<OverdriveBack slot={1} tone={["1, 2, 3", "4, 5, 6"]} hitKey={null} />);
    expect(container.querySelector(".od-flash")).toBeNull();
    rerender(<OverdriveBack slot={1} tone={["1, 2, 3", "4, 5, 6"]} hitKey={7} />);
    expect(container.querySelector(".od-flash")).not.toBeNull();
  });
  it("スクロールバーの幅を --od-sbw に渡す", () => {
    render(<OverdriveBack slot={null} tone={["1, 2, 3", "4, 5, 6"]} hitKey={null} />);
    expect(document.documentElement.style.getPropertyValue("--od-sbw")).toMatch(/^-?\d+px$/);
  });
});

describe("OverdriveFront", () => {
  it("段階・slot・強さを計器に出す", () => {
    const { container } = render(<OverdriveFront slot={509130078} energy={0.85} phase="judging" />);
    expect(container.textContent).toContain("PHASE JUDGING");
    expect(container.textContent).toContain("SLOT 509130078");
    expect(container.textContent).toContain("ENERGY 85%");
    const bar = container.querySelector(".od-meter i") as HTMLElement;
    expect(bar.style.getPropertyValue("--od-meter")).toBe("85%");
  });
  it("slot が無ければ空欄の印を出す", () => {
    const { container } = render(<OverdriveFront slot={null} energy={0.35} phase="idle" />);
    expect(container.textContent).toContain("SLOT ——");
  });
  it("四隅の枠を 4 つ置き、クリックを遮らない層にする", () => {
    const { container } = render(<OverdriveFront slot={null} energy={0.35} phase="idle" />);
    expect(container.querySelectorAll(".od-corner")).toHaveLength(4);
    expect(container.querySelector(".od-front")?.getAttribute("aria-hidden")).toBe("true");
  });
});
