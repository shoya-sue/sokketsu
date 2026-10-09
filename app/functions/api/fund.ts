/// <reference types="@cloudflare/workers-types" />
import { json } from "../../server/auth";
import { pubkeyBytes } from "../../server/oracle";
import { signedTransfer } from "../../server/transfer";

interface Env {
  FAUCET_SECRET_KEY?: string; // faucet 鍵の 32 バイト seed（hex）。devnet SOL だけを入れておく
  HELIUS_RPC_URL?: string;
}

/**
 * お試し用の小さな faucet。公開 devnet faucet はほぼ 429 で使えないため、自前の鍵から送る。
 * 1 回で hold → release の 2 件分（預かり金 0.05 SOL × 2 + レント・手数料）だけ送る。
 * 残高が十分なアドレスには送らず、同じ IP からの連打は間隔を空けさせる（devnet なので軽い制限に留める）。
 */
export const FUND_LAMPORTS = 120_000_000;
export const FUND_SKIP_LAMPORTS = 100_000_000;
const RATE_LIMIT_SECONDS = 600;
const PUBLIC_DEVNET_RPC = "https://api.devnet.solana.com";
const RPC_TIMEOUT_MS = 8000;

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (body.error || body.result === undefined) {
    // Stryker disable next-line all: 例外の文言はログにしか出ない
    throw new Error(`${method} failed: ${body.error?.code ?? res.status}`);
  }
  return body.result;
}

const rateKey = (kind: "ip" | "address", value: string) =>
  new Request(`https://sokketsu-fund.internal/${kind}/${encodeURIComponent(value)}`);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.FAUCET_SECRET_KEY) return json({ error: "faucet unavailable" }, 503);

  let address: unknown;
  try {
    ({ address } = (await request.json()) as { address?: unknown });
    pubkeyBytes(String(address));
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const keys = [rateKey("ip", ip), rateKey("address", String(address))];
  const hits = await Promise.all(keys.map((k) => caches.default.match(k)));
  if (hits.some(Boolean)) return json({ error: "too many requests" }, 429);
  // RPC を待つ前に予約する。並列に届いたリクエストが残高の反映前にすり抜けないように。
  // （Cache API は原子的ではないので窓はゼロにならない。devnet SOL なのでここまでに留める）
  await Promise.all(
    keys.map((k) =>
      caches.default.put(k, new Response(null, { headers: { "Cache-Control": `max-age=${RATE_LIMIT_SECONDS}` } })),
    ),
  );

  // 予備 RPC は devnet を指しているときだけ使う（mainnet へ送らない）。
  const rpcUrl =
    env.HELIUS_RPC_URL && /^https:\/\/devnet\./.test(env.HELIUS_RPC_URL) ? env.HELIUS_RPC_URL : PUBLIC_DEVNET_RPC;
  try {
    const { value: balance } = await rpcCall<{ value: number }>(rpcUrl, "getBalance", [address]);
    if (balance >= FUND_SKIP_LAMPORTS) return json({ error: "already funded" }, 409);

    const { value } = await rpcCall<{ value: { blockhash: string } }>(rpcUrl, "getLatestBlockhash", [
      { commitment: "confirmed" },
    ]);
    const tx = await signedTransfer(env.FAUCET_SECRET_KEY, String(address), FUND_LAMPORTS, value.blockhash);
    await rpcCall<string>(rpcUrl, "sendTransaction", [tx.base64, { encoding: "base64" }]);
    return json({ signature: tx.signature, lamports: FUND_LAMPORTS }, 200);
  } catch (e) {
    // Stryker disable next-line StringLiteral,CallExpression: ログの出力は応答と振る舞いに影響しない
    console.error("faucet failed", e instanceof Error ? e.message : String(e));
    return json({ error: "faucet failed" }, 502);
  }
};
