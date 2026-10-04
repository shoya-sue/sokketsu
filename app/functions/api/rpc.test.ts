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
    expect(logged).toContain("api-key=***");
    expect(logged).not.toContain("secret");
  });

  it("上流が例外なら 502（URL は応答に出さない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await call(ENV, rpc("getBalance"));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });
});
