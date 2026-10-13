import { describe, expect, it, vi } from "vitest";

const confetti = vi.hoisted(() => vi.fn());
vi.mock("canvas-confetti", () => ({ default: confetti }));

import { sideCannons } from "./fx";

describe("紙吹雪の読み込み前", () => {
  it("まだ読み込んでいなければ、読み込んでから出す", async () => {
    sideCannons();
    expect(confetti).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(confetti).toHaveBeenCalledTimes(2));
  });
});
