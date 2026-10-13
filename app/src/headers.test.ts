import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Cloudflare Pages の _headers（パスの行のあとに、字下げした「名前: 値」が続く）を読む。
const lines = readFileSync(new URL("../public/_headers", import.meta.url), "utf8").split("\n");
const headersFor = (path: string): Record<string, string> => {
  const at = lines.findIndex((l) => l.trim() === path);
  expect(at, `${path} の節が無い`).toBeGreaterThanOrEqual(0);
  const out: Record<string, string> = {};
  for (const l of lines.slice(at + 1)) {
    if (!/^\s+\S/.test(l)) break;
    const i = l.indexOf(":");
    out[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  }
  return out;
};
const csp = (): Map<string, string[]> => {
  const policy = headersFor("/*")["content-security-policy"];
  return new Map(
    policy
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...values]) => [name, values]),
  );
};

describe("_headers（全ページ）", () => {
  it("他サイトの iframe に埋め込ませない", () => {
    expect(csp().get("frame-ancestors")).toEqual(["'none'"]);
    expect(headersFor("/*")["x-frame-options"]).toBe("DENY");
  });

  it("スクリプトは自サイトのものだけ（inline と eval を許さない）", () => {
    expect(csp().get("script-src")).toEqual(["'self'"]);
    expect(csp().get("object-src")).toEqual(["'none'"]);
    expect(csp().get("base-uri")).toEqual(["'none'"]);
  });

  it("接続先は自サイトの API と devnet の RPC（HTTP と WebSocket）だけ。mainnet には繋がない", () => {
    const connect = csp().get("connect-src");
    expect(connect).toEqual(["'self'", "https://api.devnet.solana.com", "wss://api.devnet.solana.com"]);
    expect(connect?.join(" ")).not.toMatch(/mainnet/);
  });

  it("書体の配信元と、紙吹雪の Worker（blob）だけを足す", () => {
    expect(csp().get("style-src")).toEqual(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
    expect(csp().get("font-src")).toEqual(["'self'", "https://fonts.gstatic.com"]);
    expect(csp().get("worker-src")).toEqual(["blob:"]);
  });

  it("カメラ・マイク・位置情報・決済の API を使わせない", () => {
    const pp = headersFor("/*")["permissions-policy"];
    for (const f of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) expect(pp).toContain(f);
  });
});
