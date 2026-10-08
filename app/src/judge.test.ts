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

describe("署名つき判断の検査（mutation テストで見つけた抜け）", () => {
  // /api/judge の応答が読めなければ、理由 badResponse を出して /api/decide の署名つきモックへ落ちる。
  const rejected = async (judgeBody: unknown) => {
    routeFetch({
      "/api/judge": async () => json(200, judgeBody),
      "/api/decide": async () => json(200, signedMock("ping")),
    });
    const { out, reasons } = await run("tok", "ping");
    expect(out).toEqual(signedMock("ping"));
    expect(reasons).toEqual([{ k: "fallback.badResponse" }]);
  };
  const p = proof(9300);

  it("本文が null", () => rejected(null));
  it("proof が無い", () => rejected({ ...signedJev, proof: undefined }));
  it("proof が null", () => rejected({ ...signedJev, proof: null }));
  it("本文が文字列・数値", async () => {
    await rejected("release");
    await rejected(1);
  });
  it("署名が 63 バイト", () => rejected({ ...signedJev, proof: { ...p, signature: "ab".repeat(63) } }));
  it("署名の先頭・末尾に 16 進以外の文字（長さは合っている）", async () => {
    await rejected({ ...signedJev, proof: { ...p, signature: "zz" + "ab".repeat(63) } });
    await rejected({ ...signedJev, proof: { ...p, signature: "ab".repeat(63) + "zz" } });
  });
  it("公開鍵の長さが違う", () => rejected({ ...signedJev, proof: { ...p, publicKey: "cd".repeat(31) } }));
  it("確率が数値でない（文字列の数字も）", () => rejected({ ...signedJev, probability: "0.93" }));
  it("確率が 0〜1 の外", async () => {
    await rejected({ ...signedJev, probability: -0.01, proof: proof(-100) });
    await rejected({ ...signedJev, probability: 1.01, proof: proof(10100) });
  });
  it("bps が確率と一致しない（文字列の bps も）", async () => {
    await rejected({ ...signedJev, proof: proof(9301) });
    await rejected({ ...signedJev, proof: { ...p, bps: "9300" } });
  });
  it("出所が呼んだ口と違う", () => rejected({ ...signedJev, source: "mock" }));

  it("確率はちょうど 0 と 1 も受け付け、refund も受け付ける", async () => {
    for (const body of [
      { decision: "hold", probability: 0, source: "jev", proof: proof(0) },
      { decision: "release", probability: 1, source: "jev", proof: proof(10000) },
      { decision: "refund", probability: 0.9, source: "jev", proof: proof(9000) },
    ]) {
      routeFetch({ "/api/judge": async () => json(200, body) });
      expect((await run("tok", "ping")).out).toEqual(body);
    }
  });

  it("/api/decide が失敗の状態コードなら、本文が正しい形でも使わず、署名なしのモックにする", async () => {
    routeFetch({ "/api/decide": async () => json(500, signedMock("hold: a")) });
    const { out } = await run("", "hold: a");
    expect(out).toEqual(mockDecision("hold: a"));
    expect(out.proof).toBeUndefined();
  });

  it("API へは POST・JSON で依頼を送る", async () => {
    const calls = routeFetch({ "/api/decide": async () => json(200, signedMock("x")) });
    await run("", "x");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(input("x"));
  });
});
