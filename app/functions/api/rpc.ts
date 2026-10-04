/// <reference types="@cloudflare/workers-types" />
import { isAuthorized, json } from "../../server/auth";
import idl from "../../src/idl/sokketsu.json";

interface Env {
  DEMO_TOKEN?: string;
  HELIUS_RPC_URL?: string; // キー付きの devnet RPC URL。ブラウザには出さない
}

// 公開 devnet RPC が使えないときの予備。このアプリが使うメソッドだけ通す。
export const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getAgGenesisCert",
  "getBalance",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getSignatureStatuses",
  "getSlot",
  "sendTransaction",
]);
const MAX_BODY_BYTES = 16 * 1024;
// getProgramAccounts はこのプログラムの口座だけに限る（予備 RPC を汎用の検索口にしない）。
const PROGRAM_ID = idl.address;

/** ログに出す前に、URL に含まれる API キーを伏せる。 */
const redact = (e: unknown) => String(e instanceof Error ? e.message : e).replace(/api-key=[^&\s"']+/gi, "api-key=***");
const UPSTREAM_TIMEOUT_MS = 8000;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAuthorized(request, env.DEMO_TOKEN)) return json({ error: "unauthorized" }, 401);
  // devnet 以外を指していたら中継しない（公開 RPC の障害時に mainnet へ流れるのを防ぐ）。
  if (!env.HELIUS_RPC_URL || !/^https:\/\/devnet\./.test(env.HELIUS_RPC_URL)) {
    return json({ error: "fallback rpc unavailable" }, 503);
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ error: "too large" }, 413);

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json({ error: "too large" }, 413);
  let method: unknown;
  let params: unknown;
  try {
    ({ method, params } = JSON.parse(body) as { method?: unknown; params?: unknown });
  } catch {
    return json({ error: "bad request" }, 400);
  }
  if (typeof method !== "string" || !ALLOWED_METHODS.has(method)) {
    return json({ error: "method not allowed" }, 400);
  }
  if (method === "getProgramAccounts" && !(Array.isArray(params) && params[0] === PROGRAM_ID)) {
    return json({ error: "program not allowed" }, 400);
  }

  try {
    const upstream = await fetch(env.HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("fallback rpc failed", method, redact(e));
    return json({ error: "upstream failed" }, 502);
  }
};
