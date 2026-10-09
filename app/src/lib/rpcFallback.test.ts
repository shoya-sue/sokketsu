import { describe, expect, it, vi } from "vitest";
import { createFallbackFetch, type RpcRoute } from "./rpcFallback";

const ok = (body = "{}") => new Response(body, { status: 200 });
const status = (code: number) => new Response("{}", { status: code });

function setup(responses: Array<Response | Error>, token = "tok") {
  const routes: RpcRoute[] = [];
  const baseFetch = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) baseFetch.mockRejectedValueOnce(r);
    else baseFetch.mockResolvedValueOnce(r);
  }
  const f = createFallbackFetch({
    fallbackUrl: "/api/rpc",
    getToken: () => token,
    onRoute: (r) => routes.push(r),
    baseFetch: baseFetch as unknown as typeof fetch,
  });
  return { f, baseFetch, routes };
}

const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };

describe("createFallbackFetch", () => {
  it("公開 RPC が答えればそのまま返し、予備は呼ばない", async () => {
    const { f, baseFetch, routes } = setup([ok("primary")]);
    expect(await (await f("https://rpc", init)).text()).toBe("primary");
    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(routes).toEqual(["public"]);
  });

  it("4xx（429 以外）は予備に回さない", async () => {
    const { f, baseFetch } = setup([status(400)]);
    expect((await f("https://rpc", init)).status).toBe(400);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, 503])("%i なら予備へ送り直し、Bearer を付ける", async (code) => {
    const { f, baseFetch, routes } = setup([status(code), ok("fallback")]);
    expect(await (await f("https://rpc", init)).text()).toBe("fallback");
    const [url, fallbackInit] = baseFetch.mock.calls[1];
    expect(url).toBe("/api/rpc");
    const headers = new Headers(fallbackInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(routes).toEqual(["fallback"]);
  });

  it("通信失敗でも予備へ送り直す", async () => {
    const { f, routes } = setup([new Error("offline"), ok("fallback")]);
    expect(await (await f("https://rpc", init)).text()).toBe("fallback");
    expect(routes).toEqual(["fallback"]);
  });

  it("トークンが空なら予備は使わず、公開 RPC の結果を返す", async () => {
    const { f, baseFetch } = setup([status(429)], "  ");
    expect((await f("https://rpc", init)).status).toBe(429);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("トークンが空で通信失敗なら、その例外を投げる", async () => {
    const { f } = setup([new Error("offline")], "");
    await expect(f("https://rpc", init)).rejects.toThrow("offline");
  });

  it("予備も失敗（401 など）なら、公開 RPC の結果を返す", async () => {
    const { f, routes } = setup([status(429), status(401)]);
    expect((await f("https://rpc", init)).status).toBe(429);
    expect(routes).toEqual([]);
  });

  it("公開 RPC が通信失敗で予備も失敗なら、予備の応答を返す", async () => {
    const { f } = setup([new Error("offline"), status(503)]);
    expect((await f("https://rpc", init)).status).toBe(503);
  });

  it("予備が例外なら、公開 RPC の結果を返す", async () => {
    const { f } = setup([status(500), new Error("fallback down")]);
    expect((await f("https://rpc", init)).status).toBe(500);
  });

  it("両方とも例外なら、予備の例外を投げる", async () => {
    const { f } = setup([new Error("offline"), new Error("fallback down")]);
    await expect(f("https://rpc", init)).rejects.toThrow("fallback down");
  });
});

describe("createFallbackFetch の例外の扱い", () => {
  it("トークンが空で公開 RPC が失敗したら、その例外オブジェクトをそのまま投げる", async () => {
    const err = new Error("offline");
    const { f } = setup([err], "");
    await expect(f("https://rpc", init)).rejects.toBe(err);
  });
  it("init 無しで呼ばれても予備へ送り直せる（Authorization を付ける）", async () => {
    const { f, baseFetch } = setup([status(503), ok('{"result":1}')]);
    const res = await f("https://rpc");
    expect(await res.text()).toBe('{"result":1}');
    const [, sent] = baseFetch.mock.calls[1];
    expect(new Headers(sent.headers).get("Authorization")).toBe("Bearer tok");
  });
});
