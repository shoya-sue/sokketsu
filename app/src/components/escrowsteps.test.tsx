// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../test/dom";
import { EscrowSteps } from "./EscrowSteps";

describe("EscrowSteps", () => {
  it("4 つの工程を並べる", () => {
    const { container } = render(<EscrowSteps phase="idle" />);
    expect(container.querySelectorAll(".flow-step")).toHaveLength(4);
  });
  it("待機中はどれも開かず、案内を出す", () => {
    const { container } = render(<EscrowSteps phase="idle" />);
    expect(container.querySelector(".flow-step.is-live")).toBeNull();
    expect(container.querySelector(".flow-caption")?.textContent).toBe("依頼を流すと、ここに 4 つの工程が順に開く");
  });
  it("判断中は 2 つ目が開き、その説明を出す。1 つ目は済み", () => {
    const { container } = render(<EscrowSteps phase="judging" />);
    const steps = container.querySelectorAll(".flow-step");
    expect(steps[0].className).toContain("is-done");
    expect(steps[1].className).toContain("is-live");
    expect(container.querySelector(".flow-caption")?.textContent).toBe("Jev が型付きの判断（選択肢と確率）を返す");
  });
  it("確定したらすべて済みで、確定の説明を出す", () => {
    const { container } = render(<EscrowSteps phase="released" />);
    expect(container.querySelectorAll(".flow-step.is-done")).toHaveLength(4);
    expect(container.querySelector(".flow-caption")?.textContent).toBe("受注者へ送金し、1 秒未満で finalized");
  });
  it("止めた（hold）は 3 つ目が止まった印で、送金しない理由を出す", () => {
    const { container } = render(<EscrowSteps phase="stopped" />);
    expect(container.querySelectorAll(".flow-step")[2].className).toContain("is-stop");
    expect(container.querySelector(".flow-caption")?.textContent).toBe("閾値に届かない・hold の判断なので送金しない");
  });
  it("段階が変わるたびに説明を出し直す（展開の演出をやり直すため key が変わる）", () => {
    const { container, rerender } = render(<EscrowSteps phase="depositing" />);
    const before = container.querySelector(".flow-caption");
    rerender(<EscrowSteps phase="judging" />);
    expect(container.querySelector(".flow-caption")).not.toBe(before);
  });
});
