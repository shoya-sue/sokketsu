import { describe, expect, it } from "vitest";
import { describeError } from "../i18n";
import { formatWait, rateLimitedError } from "./faucet";

describe("formatWait", () => {
  it("分:秒（秒は 2 桁）", () => expect(formatWait(500)).toBe("8:20"));
  it("1 分未満は 0:SS", () => expect(formatWait(7)).toBe("0:07"));
  it("端数の秒は切り上げる（早く案内しすぎない）", () => expect(formatWait(59.2)).toBe("1:00"));
});

describe("rateLimitedError", () => {
  it("待ち秒数があれば、制限であることと残り時間を言う", () => {
    const e = rateLimitedError({ error: "too many requests", retryAfter: 500 });
    expect(e.msg).toEqual({ k: "err.fundRateLimited", p: { wait: "8:20" } });
    expect(describeError("en", e)).toBe("The faucet sends once per 10 minutes. Try again in 8:20");
    expect(describeError("ja", e)).toBe("faucet は 10 分に 1 回まで。あと 8:20 で受け取れる");
  });

  it("待ち秒数が読めなければ、制限であることだけ言う", () => {
    for (const body of [null, {}, { retryAfter: "x" }, { retryAfter: 0 }, { retryAfter: -3 }, { retryAfter: Infinity }]) {
      expect(rateLimitedError(body).msg).toEqual({ k: "err.fundRateLimitedSoon", p: undefined });
    }
    expect(describeError("en", rateLimitedError({}))).toBe(
      "The faucet sends once per 10 minutes. Try again in a few minutes",
    );
  });

  it("「応答しなかった」とは言わない", () => {
    for (const lang of ["ja", "en"] as const) {
      expect(describeError(lang, rateLimitedError({ retryAfter: 30 }))).not.toMatch(/respond|応答/);
    }
  });
});
