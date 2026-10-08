import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, parseJudgeInput, readJsonLimited } from "./judgeInput";

const KEY = "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp";
const valid = {
  task: "hold: wait",
  escrow: KEY,
  amountLamports: 50_000_000,
  payer: KEY,
  payee: KEY,
  failCount: 0,
  alpenglow: true,
};

describe("parseJudgeInput", () => {
  it("正しい入力はそのまま返す（余計な項目は落とす）", () =>
    expect(parseJudgeInput({ ...valid, extra: 1 })).toEqual(valid));
  it.each([null, undefined, "x", 1, []])("オブジェクトでなければ null（%j）", (v) => expect(parseJudgeInput(v)).toBe(null));
  it("依頼文はちょうど 200 字まで通り、201 字は拒否", () => {
    expect(parseJudgeInput({ ...valid, task: "a".repeat(200) })).not.toBe(null);
    expect(parseJudgeInput({ ...valid, task: "a".repeat(201) })).toBe(null);
  });
  it("依頼文が空・文字列以外（配列も）は拒否", () => {
    expect(parseJudgeInput({ ...valid, task: "" })).toBe(null);
    expect(parseJudgeInput({ ...valid, task: ["hold: wait"] })).toBe(null);
  });
  it("公開鍵が文字列でなければ拒否（文字列化すると形式に合う配列でも）", () => {
    expect(parseJudgeInput({ ...valid, escrow: [KEY] })).toBe(null);
    expect(parseJudgeInput({ ...valid, payer: "0OIl" })).toBe(null);
  });
  it("金額は 1 lamport〜10 SOL（両端を含む）", () => {
    expect(parseJudgeInput({ ...valid, amountLamports: 1 })).not.toBe(null);
    expect(parseJudgeInput({ ...valid, amountLamports: 10_000_000_000 })).not.toBe(null);
    expect(parseJudgeInput({ ...valid, amountLamports: 0 })).toBe(null);
    expect(parseJudgeInput({ ...valid, amountLamports: 10_000_000_001 })).toBe(null);
    expect(parseJudgeInput({ ...valid, amountLamports: 1.5 })).toBe(null);
  });
  it("失敗回数は 0〜10000（両端を含む）", () => {
    expect(parseJudgeInput({ ...valid, failCount: 10_000 })).not.toBe(null);
    expect(parseJudgeInput({ ...valid, failCount: 10_001 })).toBe(null);
    expect(parseJudgeInput({ ...valid, failCount: -1 })).toBe(null);
  });
  it("alpenglow は真偽値だけ", () => expect(parseJudgeInput({ ...valid, alpenglow: "true" })).toBe(null));
});

const req = (body: string, length?: number) =>
  new Request("https://x/api", {
    method: "POST",
    headers: length === undefined ? {} : { "Content-Length": String(length) },
    body,
  });

describe("readJsonLimited", () => {
  it("上限ちょうどの本文は読む", async () => {
    const body = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES - 10) });
    expect(new TextEncoder().encode(body).length).toBe(MAX_BODY_BYTES);
    expect(await readJsonLimited(req(body, MAX_BODY_BYTES))).toEqual(JSON.parse(body));
  });
  it("申告サイズが上限を 1 バイト超えたら読まずに null", async () =>
    expect(await readJsonLimited(req("{}", MAX_BODY_BYTES + 1))).toBe(null));
  it("申告が無くても、実際の本文が上限を超えたら null", async () =>
    expect(await readJsonLimited(req(JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES) })))).toBe(null));
  it("壊れた JSON は null（undefined ではない）", async () => expect(await readJsonLimited(req("{oops"))).toBe(null));
});
