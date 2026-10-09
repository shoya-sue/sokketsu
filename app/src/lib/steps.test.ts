import { describe, expect, it } from "vitest";
import { statusOf, stepStates } from "./steps";

describe("stepStates（01 預け入れ → 02 判断 → 03 署名検証 → 04 確定）", () => {
  it("待機中はすべて todo", () => expect(stepStates("idle")).toEqual(["todo", "todo", "todo", "todo"]));
  it("預け入れ中は 01 が進行中", () => expect(stepStates("depositing")).toEqual(["active", "todo", "todo", "todo"]));
  it("判断中は 01 済み・02 進行中", () => expect(stepStates("judging")).toEqual(["done", "active", "todo", "todo"]));
  it("hold を記録中は 03 進行中", () => expect(stepStates("holding")).toEqual(["done", "done", "active", "todo"]));
  it("解放・返金の送信中は 04 進行中", () => {
    expect(stepStates("releasing")).toEqual(["done", "done", "done", "active"]);
    expect(stepStates("refunding")).toEqual(["done", "done", "done", "active"]);
  });
  it("確定したらすべて done", () => {
    expect(stepStates("released")).toEqual(["done", "done", "done", "done"]);
    expect(stepStates("refunded")).toEqual(["done", "done", "done", "done"]);
  });
  it("止めたら 04 が stopped", () => expect(stepStates("stopped")).toEqual(["done", "done", "done", "stopped"]));
  it("失敗は直前に進んでいた段を error にする", () => {
    expect(stepStates("error", "judging")).toEqual(["done", "error", "todo", "todo"]);
    expect(stepStates("error", "releasing")).toEqual(["done", "done", "done", "error"]);
  });
  it("直前が分からない失敗は 01 を error にする", () => expect(stepStates("error")).toEqual(["error", "todo", "todo", "todo"]));
  it("直前も失敗だったときも 01 を error にする（段の番号を引けない）", () =>
    expect(stepStates("error", "error")).toEqual(["error", "todo", "todo", "todo"]));
});

describe("statusOf（状態ピル）", () => {
  it.each([
    ["idle", "idle"],
    ["depositing", "depositing"],
    ["judging", "judging"],
    ["holding", "finalizing"],
    ["releasing", "finalizing"],
    ["refunding", "finalizing"],
    ["released", "finalized"],
    ["refunded", "finalized"],
    ["stopped", "stopped"],
    ["error", "error"],
  ] as const)("%s → %s", (phase, status) => expect(statusOf(phase)).toBe(status));
});
