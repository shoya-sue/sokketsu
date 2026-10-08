import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthorized, json } from "./auth";

beforeEach(() => {
  const timingSafeEqual = (a: ArrayBufferView, b: ArrayBufferView) => {
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  };
  vi.stubGlobal("crypto", { subtle: { timingSafeEqual } });
});
afterEach(() => vi.unstubAllGlobals());

const req = (authorization?: string) =>
  new Request("https://x/api", { headers: authorization === undefined ? {} : { Authorization: authorization } });

describe("isAuthorized", () => {
  it("Bearer <一致するトークン> だけ通す", () => expect(isAuthorized(req("Bearer demo"), "demo")).toBe(true));
  it("トークンが違えば拒否（同じ長さ・違う長さ）", () => {
    expect(isAuthorized(req("Bearer deme"), "demo")).toBe(false);
    expect(isAuthorized(req("Bearer demo2"), "demo")).toBe(false);
  });
  it("Bearer の付かないヘッダは拒否（値がトークンと同じでも）", () => {
    expect(isAuthorized(req("demo"), "demo")).toBe(false);
    expect(isAuthorized(req("Token demo"), "demo")).toBe(false);
    expect(isAuthorized(req("bearer demo"), "demo")).toBe(false);
  });
  it("ヘッダが無ければ拒否", () => expect(isAuthorized(req(), "demo")).toBe(false));
  it("サーバの DEMO_TOKEN が未設定なら、どんなトークンでも拒否（文字列 undefined でも）", () => {
    expect(isAuthorized(req("Bearer undefined"), undefined)).toBe(false);
    expect(isAuthorized(req("Bearer "), "")).toBe(false);
  });
  it("Bearer の後が空なら拒否", () => expect(isAuthorized(req("Bearer "), "demo")).toBe(false));
});

describe("json", () => {
  it("JSON 本文・状態コード・キャッシュ禁止を付ける", async () => {
    const res = json({ ok: 1 }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: 1 });
  });
});
