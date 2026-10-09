// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../test/dom";
import { msg } from "../i18n";
import { CountdownHit } from "./CountdownHit";
import { History } from "./History";
import { Logo } from "./Logo";
import { ProgressTrack } from "./ProgressTrack";
import { Timeline } from "./Timeline";
import { Toasts } from "./Toasts";

describe("Toasts", () => {
  it("トーストを色つきで積む", () => {
    const { container } = render(
      <Toasts
        toasts={[
          { id: 1, icon: "🏅", title: "実績", body: "本文", tone: "gold" },
          { id: 2, icon: "⬆", title: "レベル", body: "上がった", tone: "purple" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".toast")).toHaveLength(2);
    expect(container.querySelector(".toast-gold")?.textContent).toContain("実績本文");
    expect(container.querySelector(".toast-purple")).not.toBeNull();
  });
});

describe("Timeline", () => {
  it("空のときは案内を出す", () => {
    render(<Timeline entries={[]} />);
    expect(screen.getByText(/預け入れ → 判断 → 確定/)).toBeTruthy();
  });

  it("出来事・詳細・実測の時間・tx のリンクを出す", () => {
    const { container } = render(
      <Timeline
        entries={[
          { id: 1, label: msg("tl.deposit"), ms: 812.4, signature: "SIG", tone: "ok" },
          { id: 2, label: msg("tl.failed"), detail: "生のエラー", tone: "error" },
          { id: 3, label: msg("tl.stopped"), detail: msg("tl.stoppedDetail", { decision: "hold" }), ms: null, tone: "warn" },
        ]}
      />,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].className).toContain("tl-ok");
    expect(items[0].querySelector(".tl-ms")?.textContent).toBe("812 ms");
    expect(items[0].querySelector("a")?.getAttribute("href")).toBe("https://explorer.solana.com/tx/SIG?cluster=devnet");
    expect(items[1].querySelector(".tl-detail")?.textContent).toBe("生のエラー");
    expect(items[1].querySelector(".tl-ms")).toBeNull();
    expect(items[2].querySelector(".tl-detail")?.textContent).toContain("hold");
    expect(items[2].querySelector(".tl-ms")?.textContent).not.toBe("");
  });
});

describe("History", () => {
  it("空のときは見出しと案内だけ", () => {
    const { container } = render(<History history={[]} />);
    expect(container.querySelector(".history-chart")).toBeNull();
    expect(container.querySelector(".hint")).not.toBeNull();
  });

  it("新しい順の履歴を古い順の棒にし、中央値と 1 秒未満のバッジを出す", () => {
    const { container } = render(
      <History
        history={[
          { ms: 400, at: 3, label: "release" },
          { ms: 900, at: 2, label: "refund" },
          { ms: 600, at: 1, label: "release" },
        ]}
      />,
    );
    const ms = [...container.querySelectorAll(".history-ms")].map((e) => e.textContent);
    expect(ms).toEqual(["600", "900", "400"]);
    expect(container.querySelector(".history-median strong")?.textContent).toBe("600 ms");
    expect(container.querySelector(".history-badge")).not.toBeNull();
    expect(container.querySelectorAll(".history-slot")).toHaveLength(5);
    expect(container.querySelector(".history-bar.latest")?.getAttribute("title")).toBe("release");
  });

  it("1 秒以上を含むと遅い棒になり、バッジは出ない", () => {
    const { container } = render(<History history={[{ ms: 2000, at: 1, label: "release" }]} />);
    expect(container.querySelector(".history-bar")?.className).toContain("slow");
    expect(container.querySelector(".history-badge")).toBeNull();
    expect(container.querySelector<HTMLElement>(".history-bar")?.style.height).toBe("100%");
  });
});

describe("ProgressTrack", () => {
  it("4 段と状態のピルを出し、いまの段に aria-current を付ける", () => {
    const { container } = render(<ProgressTrack phase="judging" />);
    const steps = container.querySelectorAll(".step");
    expect(steps).toHaveLength(4);
    expect(steps[0].className).toContain("step-done");
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    expect(steps[0].getAttribute("aria-current")).toBeNull();
    expect(steps[0].querySelector(".step-no")?.textContent).toBe("01");
    expect(container.querySelector(".status-pill")?.className).toContain("status-judging");
  });

  it("失敗は直前の段で止まった表示にする", () => {
    const { container } = render(<ProgressTrack phase="error" beforeError="judging" />);
    expect(container.querySelectorAll(".step-error")).toHaveLength(1);
    expect(container.querySelector(".status-pill")?.className).toContain("status-error");
  });
});

describe("CountdownHit", () => {
  it("無いときは何も出さない", () => {
    const { container } = render(<CountdownHit countdown={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("残り秒と次の依頼を出す", () => {
    const { container } = render(<CountdownHit countdown={{ next: "release", seconds: 3 }} />);
    expect(container.querySelector(".cd-num")?.textContent).toBe("3");
    expect(container.querySelector(".cd-next")?.textContent).toBe("次は release");
  });
});

describe("Logo", () => {
  it("マーク（回るリング・稲妻）とワードマーク（グリッチ用の写しの文字）を出す", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector(".logo-ring")).not.toBeNull();
    expect(container.querySelector(".logo-spark")).not.toBeNull();
    expect(container.querySelector(".logo-bolt")).not.toBeNull();
    expect(container.querySelector(".logo-word")?.getAttribute("data-text")).toBe("Sokketsu");
    expect(screen.getByRole("heading", { name: "Sokketsu" })).toBeTruthy();
    expect(container.querySelector(".logo")?.className).not.toContain("is-hit");
  });

  it("確定の瞬間（hitKey あり）は叩かれた演出のクラスが付く", () => {
    const { container } = render(<Logo hitKey={123} />);
    expect(container.querySelector(".logo")?.className).toContain("is-hit");
  });
});
