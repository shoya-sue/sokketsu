// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../test/dom";
import { setWalletSlot, useWalletState, walletStore } from "./walletStore";

// App と同じ形：ストアを購読しながら、差し込み口を ref で渡す。
function Probe() {
  const { slot } = useWalletState();
  return (
    <p>
      <span className="wallet-slot" ref={setWalletSlot} />
      <output>{slot ? "slot" : "none"}</output>
    </p>
  );
}

describe("ウォレットの差し込み口", () => {
  it("ストアを購読する部品が差し込み口を渡しても、描画が回り続けない", () => {
    const { container, unmount } = render(<Probe />);
    expect(container.querySelector("output")?.textContent).toBe("slot");
    expect(walletStore.get().slot).toBe(container.querySelector(".wallet-slot"));
    unmount();
    expect(walletStore.get().slot).toBeNull();
  });
});
