import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./judge";

type Env = { AI_GATEWAY_API_KEY?: string; DEMO_TOKEN?: string; ORACLE_SECRET_KEY?: string };

const VALID_INPUT = {
  task: "devnet ping for agent task #t1",
  escrow: "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp",
  amountLamports: 50_000_000,
  payer: "CcVMvJZRLRQ4EV91n2ggiQpsfReArB3gc6kdfvjQ3UPk",
  payee: "CgKtt9XQ9ydTtPXkm691r3aDVhiHD95juD5854x4FGkk",
  failCount: 0,
  alpenglow: true,
};

const call = (env: Env, opts: { token?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token !== undefined) headers.Authorization = `Bearer ${opts.token}`;
  const request = new Request("https://sokketsu.pages.dev/api/judge", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? VALID_INPUT),
  });
  // Pages Function の context のうち、使う request と env だけ渡す。
  return onRequestPost({ request, env } as unknown as Parameters<typeof onRequestPost>[0]);
};

const jevAnswer = (choice: string, p: number) =>
  new Response(
    JSON.stringify({ answers: { decision: { type: "choice", choice, probabilities: { [choice]: p } } } }),
    { status: 200 },
  );

const ENV: Env = { DEMO_TOKEN: "demo-token", AI_GATEWAY_API_KEY: "  key-123\n", ORACLE_SECRET_KEY: "09".repeat(32) };
const realSubtle = globalThis.crypto.subtle;

beforeEach(() => {
  // Workers の crypto.subtle.timingSafeEqual は Node に無いので、同じ意味の関数で差し替える。
  const timingSafeEqual = (a: ArrayBufferView, b: ArrayBufferView) => {
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    if (x.length !== y.length) throw new TypeError("length mismatch");
    return x.every((v, i) => v === y[i]);
  };
  // 署名には本物の WebCrypto を使い、timingSafeEqual だけ足す。
  vi.stubGlobal("crypto", {
    subtle: {
      timingSafeEqual,
      digest: realSubtle.digest.bind(realSubtle),
      importKey: realSubtle.importKey.bind(realSubtle),
      exportKey: realSubtle.exportKey.bind(realSubtle),
      sign: realSubtle.sign.bind(realSubtle),
    },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("認証", () => {
  it("トークン無しは 401", async () => expect((await call(ENV)).status).toBe(401));
  it("トークン不一致は 401（長さ違い）", async () =>
    expect((await call(ENV, { token: "x" })).status).toBe(401));
  it("トークン不一致は 401（同じ長さ）", async () =>
    expect((await call(ENV, { token: "demo-tokeX" })).status).toBe(401));
  it("サーバに DEMO_TOKEN が無ければ常に 401（閉じた側に倒す）", async () =>
    expect((await call({ AI_GATEWAY_API_KEY: "k" }, { token: "anything" })).status).toBe(401));
  it("トークン一致でもキーが無ければ 503", async () =>
    expect(
      (await call({ DEMO_TOKEN: "demo-token", ORACLE_SECRET_KEY: "09".repeat(32) }, { token: "demo-token" })).status,
    ).toBe(503));
  it("トークン一致でもオラクル鍵が無ければ 503", async () =>
    expect((await call({ DEMO_TOKEN: "demo-token", AI_GATEWAY_API_KEY: "k" }, { token: "demo-token" })).status).toBe(503));
});

describe("入力の検証", () => {
  it.each([
    [{ ...VALID_INPUT, task: "" }],
    [{ ...VALID_INPUT, task: "x".repeat(201) }],
    [{ ...VALID_INPUT, amountLamports: 1.5 }],
    [{ ...VALID_INPUT, alpenglow: "yes" }],
    [{ ...VALID_INPUT, payer: "p".repeat(65) }],
    [{ ...VALID_INPUT, payer: "not a key" }],
    [{ ...VALID_INPUT, escrow: "0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl" }],
    [{ ...VALID_INPUT, amountLamports: -1 }],
    [{ ...VALID_INPUT, amountLamports: 20_000_000_000 }],
    [{ ...VALID_INPUT, failCount: -1 }],
    [{ ...VALID_INPUT, pad: "x".repeat(5000) }],
    ["not an object"],
  ])("不正な入力 %j は 400", async (body) => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await call(ENV, { token: "demo-token", body })).status).toBe(400);
  });
});

describe("Jev の呼び出し", () => {
  it("Gateway が答えれば 200 / source: jev。キーは前後の空白を除いて送る", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jevAnswer("release", 0.93));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(ENV, { token: "demo-token" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ decision: "release", probability: 0.93, source: "jev", proof: { bps: 9300 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/evaluate");
    expect(init.headers.Authorization).toBe("Bearer key-123");
    expect(JSON.parse(init.body).model).toBe("typesafe-ai/jev");
  });

  it("Gateway が 401 なら同じキーで TypeSafe へ直接送り直す", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(jevAnswer("hold", 0.8));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(ENV, { token: "demo-token" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ decision: "hold", probability: 0.8, source: "jev", proof: { bps: 8000 } });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(init.body).model).toBe("jev-latest");
  });

  it("両方 401 なら 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    expect((await call(ENV, { token: "demo-token" })).status).toBe(502);
  });

  it("Gateway が 500 なら TypeSafe へは行かず 502", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(ENV, { token: "demo-token" })).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ answers: { decision: { choice: "maybe", probabilities: { maybe: 1 } } } }],
    [{ answers: { decision: { choice: "release", probabilities: {} } } }],
    [{ answers: { decision: { choice: "release", probabilities: { release: 1.2 } } } }],
    [{}],
  ])("想定外の答え %j は 502", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
    expect((await call(ENV, { token: "demo-token" })).status).toBe(502);
  });

  it("通信が例外になれば 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect((await call(ENV, { token: "demo-token" })).status).toBe(502);
  });
});
