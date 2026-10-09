// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "../test/dom";
import { Onboarding } from "./Onboarding";

describe("Onboarding", () => {
  it("閉じているときは何も出さない", () => {
    const { container } = render(<Onboarding open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("3 枚のカードを順にずらして出し、「はじめる」にフォーカスを置く", () => {
    const { container } = render(<Onboarding open onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "払いは、型付き判断で即決する" })).toBeTruthy();
    const steps = container.querySelectorAll<HTMLElement>(".onboard-step");
    expect([...steps].map((s) => s.querySelector("strong")?.textContent)).toEqual([
      "型付き判断で止める",
      "署名をオンチェーンで検証",
      "1 秒未満で確定",
    ]);
    expect([...steps].map((s) => s.style.animationDelay)).toEqual(["420ms", "600ms", "780ms"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "はじめる ▶" }));
  });

  it("「はじめる」で演出を呼び、弾ける動きの後に閉じる（二度押しは無視）", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onStart = vi.fn();
    const { container } = render(<Onboarding open onClose={onClose} onStart={onStart} />);
    const cta = screen.getByRole("button", { name: "はじめる ▶" });
    fireEvent.click(cta);
    fireEvent.click(cta);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".onboard")?.className).toContain("is-closing");
    act(() => vi.advanceTimersByTime(319));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc と背景のクリックで閉じる（演出は呼ばない）。カードのクリックでは閉じない", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onStart = vi.fn();
    const { container } = render(<Onboarding open onClose={onClose} onStart={onStart} />);
    fireEvent.click(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(400));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter" });
    act(() => vi.advanceTimersByTime(400));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => vi.advanceTimersByTime(400));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector(".onboard")!);
    act(() => vi.advanceTimersByTime(400));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("reduced-motion ではすぐ閉じる", () => {
    setReducedMotion(true);
    const onClose = vi.fn();
    render(<Onboarding open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "はじめる ▶" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じた後は Esc を聞かない", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Onboarding open onClose={onClose} />);
    rerender(<Onboarding open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
