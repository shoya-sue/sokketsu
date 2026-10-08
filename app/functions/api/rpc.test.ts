import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./rpc";

type Env = { DEMO_TOKEN?: string; HELIUS_RPC_URL?: string };
const ENV: Env = { DEMO_TOKEN: "demo-token", HELIUS_RPC_URL: "https://devnet.example/?api-key=secret" };
const MAINNET_ENV: Env = { DEMO_TOKEN: "demo-token", HELIUS_RPC_URL: "https://mainnet.example/?api-key=secret" };

// token に null を渡すと Authorization を付けない（undefined だと既定値が使われるため）。
const call = (env: Env, body: string, token: string | null = "demo-token") => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const request = new Request("https://sokketsu.pages.dev/api/rpc", { method: "POST", headers, body });
  return onRequestPost({ request, env } as unknown as Parameters<typeof onRequestPost>[0]);
};

const rpc = (method: string) => JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] });

beforeEach(() => {
  const timingSafeEqual = (a: ArrayBufferView, b: ArrayBufferView) => {
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  };
  vi.stubGlobal("crypto", { subtle: { timingSafeEqual } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/rpc", () => {
  it("トークン無しは 401", async () => expect((await call(ENV, rpc("getSlot"), null)).status).toBe(401));
  it("トークン不一致は 401", async () => expect((await call(ENV, rpc("getSlot"), "nope")).status).toBe(401));
  it("予備 RPC の URL が無ければ 503", async () =>
    expect((await call({ DEMO_TOKEN: "demo-token" }, rpc("getSlot"))).status).toBe(503));
  it("予備 RPC が devnet 以外を指していたら 503（中継しない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(MAINNET_ENV, rpc("getSlot"))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("大きすぎる本文は 413", async () =>
    expect((await call(ENV, "x".repeat(17 * 1024))).status).toBe(413));
  it("壊れた JSON は 400", async () => expect((await call(ENV, "{oops")).status).toBe(400));
  it("許可していないメソッドは 400（上流へ送らない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(ENV, rpc("requestAirdrop"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("許可したメソッドは予備 RPC へそのまま中継し、状態と本文を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"result":42}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(ENV, rpc("getSlot"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"result":42}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENV.HELIUS_RPC_URL);
    expect(init.body).toBe(rpc("getSlot"));
  });

  it("getProgramAccounts はこのプログラムの ID だけ通す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const gpa = (programId: string) =>
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getProgramAccounts", params: [programId] });
    expect((await call(ENV, gpa("11111111111111111111111111111111"))).status).toBe(400);
    expect((await call(ENV, gpa("Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp"))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("上流の例外をログに出すとき API キーを伏せる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch https://devnet.example/?api-key=secret failed")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await call(ENV, rpc("getSlot"));
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("api-key=*** failed");
    expect(logged).not.toContain("ecret");
  });

  it("上流が例外なら 502（URL は応答に出さない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await call(ENV, rpc("getBalance"));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });

  const body = async (res: Response) => ({ status: res.status, body: await res.json() });

  it.each([
    ["トークン無し", () => call(ENV, rpc("getSlot"), null), 401, "unauthorized"],
    ["予備 RPC 無し", () => call({ DEMO_TOKEN: "demo-token" }, rpc("getSlot")), 503, "fallback rpc unavailable"],
    ["壊れた JSON", () => call(ENV, "{oops"), 400, "bad request"],
    ["許可外のメソッド", () => call(ENV, rpc("requestAirdrop")), 400, "method not allowed"],
    ["method が文字列でない", () => call(ENV, JSON.stringify({ method: 1 })), 400, "method not allowed"],
  ] as const)("%s は %i と理由 %s を返す", async (_, run, status, error) =>
    expect(await body(await run())).toEqual({ status, body: { error } }));

  it("このプログラム以外の getProgramAccounts は理由つきで 400", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const gpa = JSON.stringify({ method: "getProgramAccounts", params: ["11111111111111111111111111111111"] });
    expect(await body(await call(ENV, gpa))).toEqual({ status: 400, body: { error: "program not allowed" } });
  });

  it("上流の例外は理由つきで 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await body(await call(ENV, rpc("getSlot")))).toEqual({ status: 502, body: { error: "upstream failed" } });
  });

  it.each([
    "getAccountInfo",
    "getAgGenesisCert",
    "getBalance",
    "getLatestBlockhash",
    "getMinimumBalanceForRentExemption",
    "getMultipleAccounts",
    "getSignatureStatuses",
    "getSlot",
    "sendTransaction",
  ])("許可した %s は中継する", async (method) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(ENV, rpc(method))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("上流へは POST・JSON で送り、応答は JSON・キャッシュ禁止で返す（上流の状態コードもそのまま）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":1}', { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(ENV, rpc("getSlot"));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("予備 RPC の URL は devnet で始まるものだけ（途中に devnet を含むだけの URL は拒否）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const tricky = { DEMO_TOKEN: "demo-token", HELIUS_RPC_URL: "https://evil.example/?u=https://devnet.x" };
    expect((await call(tricky, rpc("getSlot"))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("本文はちょうど 16 KiB まで通し、1 バイト超えたら 413（申告サイズでも実サイズでも）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const base = rpc("getSlot");
    const exact = base.slice(0, -1) + ', "pad": "' + "x".repeat(16 * 1024 - base.length - 11) + '"}';
    expect(exact.length).toBe(16 * 1024);
    expect((await call(ENV, exact)).status).toBe(200);
    expect(await body(await call(ENV, exact + " "))).toEqual({ status: 413, body: { error: "too large" } });
    const declared = new Request("https://sokketsu.pages.dev/api/rpc", {
      method: "POST",
      headers: { Authorization: "Bearer demo-token", "Content-Length": String(16 * 1024 + 1) },
      body: rpc("getSlot"),
    });
    const res = await onRequestPost({ request: declared, env: ENV } as unknown as Parameters<typeof onRequestPost>[0]);
    expect(await body(res)).toEqual({ status: 413, body: { error: "too large" } });
  });

  it("申告サイズがちょうど 16 KiB なら通す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const request = new Request("https://sokketsu.pages.dev/api/rpc", {
      method: "POST",
      headers: { Authorization: "Bearer demo-token", "Content-Length": String(16 * 1024) },
      body: rpc("getSlot"),
    });
    const res = await onRequestPost({ request, env: ENV } as unknown as Parameters<typeof onRequestPost>[0]);
    expect(res.status).toBe(200);
  });
});
