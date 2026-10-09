// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import "../test/dom";
import type { JudgeOutput } from "../judge";
import { FlowStage } from "./FlowStage";
import { JudgePanel } from "./JudgePanel";

const payer = Keypair.generate().publicKey;
const release: JudgeOutput = { decision: "release", probability: 0.86, source: "mock", proof: { bps: 8600, signature: "s", publicKey: "p" } };
const hold: JudgeOutput = { decision: "hold", probability: 0.99, source: "jev" };

const stage = (over: Partial<Parameters<typeof FlowStage>[0]> = {}) => (
  <FlowStage
    phase="idle"
    payer={{ address: payer, balance: 1_500_000_000 }}
    payee={{ address: null, balance: null }}
    vaultLamports={null}
    judgement={null}
    fallbackReason={null}
    thresholdBps={7000}
    runKey={1}
    {...over}
  />
);

describe("FlowStage", () => {
  it("待機中は残高と短いアドレス、閾値を出す", () => {
    const { container } = render(stage());
    expect(container.querySelector(".stage")?.className).toContain("phase-idle");
    expect(container.querySelector(".node-payer .node-balance")?.textContent).toBe("1.5000SOL");
    const link = container.querySelector<HTMLAnchorElement>(".node-payer a");
    expect(link?.textContent).toBe(`${payer.toBase58().slice(0, 4)}…${payer.toBase58().slice(-4)}`);
    expect(link?.href).toContain(`/address/${payer.toBase58()}?cluster=devnet`);
    expect(container.querySelector(".node-payee .node-balance")?.textContent).toBe("—SOL");
    expect(container.querySelector(".vault-judge")?.textContent).toBe("閾値 70%");
    expect(container.querySelector(".coin")).toBeNull();
    expect(container.querySelectorAll(".shard")).toHaveLength(12);
  });

  it("預け入れ中はコインが発注者から金庫へ動き、左のレールが光る", () => {
    const { container } = render(stage({ phase: "depositing", vaultLamports: 50_000_000 }));
    const coin = container.querySelector<HTMLElement>(".coin");
    expect(coin?.style.getPropertyValue("--from")).toBe("16.67%");
    expect(coin?.style.getPropertyValue("--to")).toBe("50%");
    expect(container.querySelector(".rail-left")?.className).toContain("active");
    expect(container.querySelector(".vault-amount")?.textContent).toBe("0.0500");
  });

  it("判断のリール：待機中は出さず、判断中は回り、判断が出たらその選択肢で止まる", () => {
    expect(render(stage()).container.querySelector(".vault-reel")).toBeNull();
    const judging = render(stage({ phase: "judging" })).container.querySelector(".vault-reel");
    expect(judging?.className).toContain("is-spinning");
    expect(judging?.getAttribute("aria-hidden")).toBe("true");
    const landed = render(stage({ phase: "releasing", judgement: release })).container.querySelector(".vault-reel");
    expect(landed?.className).toContain("is-landed");
    expect(landed?.getAttribute("data-decision")).toBe("release");
    const stopped = render(stage({ phase: "stopped", judgement: hold })).container.querySelector(".vault-reel");
    expect(stopped?.getAttribute("data-decision")).toBe("hold");
  });

  it("判断中はスキャンと案内を出す", () => {
    const { container } = render(stage({ phase: "judging" }));
    expect(container.querySelector(".gate-scan")).not.toBeNull();
    expect(container.querySelector(".vault-judge")?.textContent).toBe("Jev 判断中…");
  });

  it("解放の判断は確率の分だけ欠片が外れ、署名と出所を出す", () => {
    const { container } = render(stage({ phase: "releasing", judgement: release, fallbackReason: "トークンが違う" }));
    expect(container.querySelector(".vault")?.className).toContain("pass");
    expect(container.querySelectorAll(".shard.broken")).toHaveLength(10);
    expect(container.querySelector(".shard.threshold")).not.toBeNull();
    expect(container.querySelector(".vault-judge")?.textContent).toBe("release 86%");
    expect(container.querySelector(".source")?.textContent).toBe("source: mock · ✓ 署名済み · トークンが違う");
    expect(container.querySelector(".rail-right")?.className).toContain("active");
  });

  it("hold は確率が高くても欠片を外さず、止めた印と鍵を出す", () => {
    const { container } = render(stage({ phase: "stopped", judgement: hold }));
    expect(container.querySelector(".vault")?.className).toContain("stop");
    expect(container.querySelectorAll(".shard.broken")).toHaveLength(0);
    expect(container.querySelector(".stage-stamp")?.textContent).toBe("STOPPED");
    expect(container.querySelector(".vault-lock")).not.toBeNull();
    expect(container.querySelector(".source")?.textContent).toBe("source: jev");
  });

  it("確定したら金庫の中央に確定ミリ秒を出す（返金は発注者のノードが光る）", () => {
    const { container } = render(stage({ phase: "refunded", judgement: release, finalizedMs: 812.6 }));
    expect(container.querySelector(".vault-label")?.textContent).toBe("確定");
    expect(container.querySelector(".vault-ms")?.textContent).toBe("813ms");
    expect(container.querySelector(".node-payer")?.className).toContain("glow");
    expect(container.querySelector(".vault-amount")).toBeNull();
  });

  it("送金しない再生は REPLAY の札を出し、出所を隠し、再生の確定ミリ秒を使う", () => {
    const { container } = render(stage({ phase: "released", judgement: release, replayMs: 797, finalizedMs: 500 }));
    expect(container.querySelector(".stage")?.className).toContain("is-replay");
    expect(container.querySelector(".replay-tag")?.textContent).toBe("REPLAY");
    expect(container.querySelector(".source")).toBeNull();
    expect(container.querySelector(".vault-ms")?.textContent).toBe("797ms");
    expect(container.querySelector(".node-payee")?.className).toContain("glow");
  });

  it("返金中はコインが金庫から発注者へ戻り、レールが逆向きに流れる", () => {
    const { container } = render(stage({ phase: "refunding", judgement: release }));
    const coin = container.querySelector<HTMLElement>(".coin");
    expect(coin?.className).toContain("coin-cyan");
    expect(coin?.style.getPropertyValue("--to")).toBe("16.67%");
    expect(container.querySelector(".rail-left")?.className).toContain("reverse");
  });
});

describe("JudgePanel", () => {
  it("依頼文が無ければ何も出さない", () => {
    const { container } = render(<JudgePanel task={null} judging={false} judgement={null} thresholdBps={7000} runKey={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("判断中は Jev を待っている", () => {
    const { container } = render(<JudgePanel task="release: ok" judging judgement={null} thresholdBps={7000} runKey={1} />);
    expect(container.querySelector(".judge-panel")?.className).toContain("judge-judging");
    expect(container.querySelector(".flow-request span")?.textContent).toBe("release: ok");
    expect(container.querySelector(".flow-judge span")?.textContent).toBe("Jev");
    expect(container.querySelector(".flow-result span")?.textContent).toBe("…");
    expect(container.querySelector(".typed-waiting")).not.toBeNull();
  });

  it("判断が出たら型付きの答えと確率の温度計を出す（比較は折りたたみの中）", () => {
    const { container } = render(<JudgePanel task="t" judging={false} judgement={release} thresholdBps={7000} runKey={1} />);
    expect(container.querySelector(".judge-panel")?.className).toContain("judge-done");
    expect(container.querySelector(".flow-judge span")?.textContent).toBe("Mock");
    expect(container.querySelector(".flow-result")?.className).toContain("pass");
    expect(container.querySelector(".typed-answer")?.textContent).toBe('decision: "release"\nprobability: 0.86');
    expect(container.querySelector<HTMLElement>(".meter-fill")?.style.getPropertyValue("--p")).toBe("86%");
    expect(container.querySelector(".meter-value")?.textContent).toBe("86%");
    const details = container.querySelector("details.judge-more");
    expect(details?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByText("なぜ文章ではなく型付きなのか"));
    expect(details?.querySelector(".judge-compare")).not.toBeNull();
  });

  it("hold は止める判断として出す", () => {
    const { container } = render(<JudgePanel task="t" judging={false} judgement={hold} thresholdBps={7000} runKey={1} />);
    expect(container.querySelector(".flow-result")?.className).toContain("stop");
    expect(container.querySelector(".flow-judge span")?.textContent).toBe("Jev");
  });
});
