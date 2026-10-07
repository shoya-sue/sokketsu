import { describe, expect, it } from "vitest";
import { OPERATOR_MIN_LAMPORTS, OPERATOR_TARGET_LAMPORTS, operatorTopUp } from "./session";

describe("operatorTopUp（操作鍵へ足す手数料）", () => {
  it("下限以上なら足さない", () => expect(operatorTopUp(OPERATOR_MIN_LAMPORTS)).toBe(0));
  it("下限未満なら目標額まで足す", () => expect(operatorTopUp(0)).toBe(OPERATOR_TARGET_LAMPORTS));
  it("一部残っていれば差額だけ", () =>
    expect(operatorTopUp(OPERATOR_MIN_LAMPORTS - 1)).toBe(OPERATOR_TARGET_LAMPORTS - OPERATOR_MIN_LAMPORTS + 1));
  it("目標額はレント免除の下限（0 バイト口座 890,880 lamports）を上回る", () =>
    expect(OPERATOR_MIN_LAMPORTS).toBeGreaterThan(890_880));
});
