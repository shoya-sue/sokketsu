import { afterEach, describe, expect, it, vi } from "vitest";
import { createJudge, mockDecision, mockJudge, toBps, type JudgeInput } from "./judge";
import type { Msg } from "./i18n";

const input = (task: string): JudgeInput => ({
  task,
  escrow: "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp",
  amountLamports: 50_000_000,
  payer: "payer",
  payee: "payee",
  failCount: 0,
  alpenglow: true,
});

const proof = (bps: number) => ({ bps, signature: "ab".repeat(64), publicKey: "cd".repeat(32) });
const signedJev = { decision: "release", probability: 0.93, source: "jev", proof: proof(9300) };
const signedMock = (task: string) => {
  const m = mockDecision(task);
  return { ...m, proof: proof(toBps(m.probability)) };
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** URL ごとに応答を決める fetch。呼ばれた URL を記録する。 */
function routeFetch(routes: Record<string, () => Promise<Response>>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const handler = routes[url];
    if (!handler) throw new Error(`unexpected ${url}`);
    return handler();
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

const run = async (token: string, task: string) => {
  const reasons: Msg[] = [];
  const out = await createJudge(() => token, (r) => reasons.push(r)).evaluate(input(task));
  return { out, reasons };
};

afterEach(() => vi.unstubAllGlobals());

describe("mockDecision（企画書第7節の規則）", () => {
  it("hold: で始まれば hold 0.91", () =>
    expect(mockDecision("hold: wait")).toEqual({ decision: "hold", probability: 0.91, source: "mock" }));
  it("refund: で始まれば refund 0.88", () =>
    expect(mockDecision("refund: x")).toEqual({ decision: "refund", probability: 0.88, source: "mock" }));
  it("それ以外は release 0.86", () =>
    expect(mockDecision("devnet ping")).toEqual({ decision: "release", probability: 0.86, source: "mock" }));
  it("release: の接頭辞は特別扱いせず release 0.86（release プリセットの依頼文）", () =>
    expect(mockDecision("release: delivered the devnet ping report; payer verified and approved #ab12")).toEqual({
      decision: "release",
      probability: 0.86,
      source: "mock",
    }));
  it("接頭辞は先頭だけを見る", () => expect(mockDecision("x hold: y").decision).toBe("release"));
  it("mockJudge も同じ規則", async () =>
    expect(await mockJudge.evaluate(input("hold: a"))).toEqual(mockDecision("hold: a")));
});

describe("toBps", () => {
  it("0.7 は 7000（閾値ちょうど）", () => expect(toBps(0.7)).toBe(7000));
  it("四捨五入する", () => expect(toBps(0.69995)).toBe(7000));
});

describe("createJudge", () => {
  it("トークンが空なら /api/judge は呼ばず、/api/decide の署名つきモックを返す", async () => {
    const calls = routeFetch({ "/api/decide": async () => json(200, signedMock("hold: a")) });
    const { out, reasons } = await run("  ", "hold: a");
    expect(out).toEqual(signedMock("hold: a"));
    expect(calls.map((c) => c.url)).toEqual(["/api/decide"]);
    expect(reasons).toEqual([{ k: "fallback.noToken" }]);
  });

  it("トークンがあれば Bearer で /api/judge を呼び、署名つきの Jev 判断を返す", async () => {
    const calls = routeFetch({ "/api/judge": async () => json(200, signedJev) });
    const { out, reasons } = await run("tok", "ping");
    expect(out).toEqual(signedJev);
    expect(calls).toHaveLength(1);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(reasons).toEqual([]);
  });

  it.each([
    [401, { k: "fallback.http401" }],
    [503, { k: "fallback.http503" }],
    [502, { k: "fallback.http502" }],
    [400, { k: "fallback.http400" }],
    [418, { k: "fallback.http", p: { status: 418 } }],
  ])("/api/judge が %i なら理由 %j を知らせ、署名つきモックへ", async (status, reason) => {
    routeFetch({
      "/api/judge": async () => json(status, { error: "x" }),
      "/api/decide": async () => json(200, signedMock("hold: a")),
    });
    const { out, reasons } = await run("tok", "hold: a");
    expect(out).toEqual(signedMock("hold: a"));
    expect(reasons).toEqual([reason]);
  });

  it.each([
    [{ ...signedJev, proof: undefined }],
    [{ ...signedJev, proof: { ...proof(9300), signature: "xy" } }],
    [{ ...signedJev, proof: proof(1234) }],
    [{ ...signedJev, source: "mock" }],
    [{ ...signedJev, decision: "maybe" }],
    [{ ...signedJev, probability: 1.5 }],
    [null],
  ])("署名つきとして読めない Jev 応答 %j はモックへ", async (body) => {
    routeFetch({
      "/api/judge": async () => json(200, body),
      "/api/decide": async () => json(200, signedMock("ping")),
    });
    const { out, reasons } = await run("tok", "ping");
    expect(out.source).toBe("mock");
    expect(reasons).toEqual([{ k: "fallback.badResponse" }]);
  });

  it("/api/judge が通信失敗でも署名つきモックへ", async () => {
    routeFetch({
      "/api/judge": async () => {
        throw new Error("offline");
      },
      "/api/decide": async () => json(200, signedMock("ping")),
    });
    const { out, reasons } = await run("tok", "ping");
    expect(out).toEqual(signedMock("ping"));
    expect(reasons).toEqual([{ k: "fallback.network", p: { error: "offline" } }]);
  });

  it.each([
    ["500", async () => json(500, {})],
    ["署名なし", async () => json(200, mockDecision("ping"))],
    ["例外", async () => Promise.reject(new Error("down"))],
  ])("/api/decide も %s なら、署名なしのモック（オンチェーンでは拒否される）", async (_label, decide) => {
    routeFetch({ "/api/decide": decide });
    const { out } = await run("", "ping");
    expect(out).toEqual(mockDecision("ping"));
    expect(out.proof).toBeUndefined();
  });
});
