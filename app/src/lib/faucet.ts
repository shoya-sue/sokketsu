import { KeyedError } from "../i18n";

/** 秒を「分:秒」にする。端数は切り上げる（早く案内しすぎない）。 */
export const formatWait = (seconds: number): string => {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * faucet の 429（連打の制限）を、制限であることと残り時間を言うエラーにする。
 * 「応答しなかった」と言うと、待てば受け取れることが伝わらないため。
 */
export function rateLimitedError(body: unknown): KeyedError {
  const retryAfter = (body as { retryAfter?: unknown } | null)?.retryAfter;
  if (Number.isFinite(retryAfter) && (retryAfter as number) > 0) {
    return new KeyedError("err.fundRateLimited", { wait: formatWait(retryAfter as number) });
  }
  return new KeyedError("err.fundRateLimitedSoon");
}
