import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "./decide";
import { decisionMessage, fromHex, type Proof } from "../../server/oracle";

type Env = { ORACLE_SECRET_KEY?: string };
const ENV: Env = { ORACLE_SECRET_KEY: "09".repeat(32) };

const ESCROW = "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp";
const input = (task: string) => ({
  task,
  escrow: ESCROW,
  amountLamports: 50_000_000,
  payer: "CcVMvJZRLRQ4EV91n2ggiQpsfReArB3gc6kdfvjQ3UPk",
  payee: "CgKtt9XQ9ydTtPXkm691r3aDVhiHD95juD5854x4FGkk",
  failCount: 0,
  alpenglow: true,
});

const call = (env: Env, body: unknown) => {
  const request = new Request("https://sokketsu.pages.dev/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return onRequestPost({ request, env } as unknown as Parameters<typeof onRequestPost>[0]);
};

const verify = async (proof: { publicKey: string; signature: string }, message: Uint8Array) => {
  const key = await crypto.subtle.importKey("raw", fromHex(proof.publicKey), { name: "Ed25519" }, false, [
    "verify",
  ]);
  return crypto.subtle.verify("Ed25519", key, fromHex(proof.signature), message);
};

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("/api/decide", () => {
  it("オラクル鍵が無ければ 503", async () => expect((await call({}, input("x"))).status).toBe(503));
  it("不正な入力は 400", async () => expect((await call(ENV, { task: "" })).status).toBe(400));
  it("大きすぎる本文は 400", async () =>
    expect((await call(ENV, { ...input("x"), pad: "x".repeat(5000) })).status).toBe(400));

  it.each([
    ["hold: wait #a", "hold", 0.91, 9100],
    ["refund: x #a", "refund", 0.88, 8800],
    ["devnet ping #a", "release", 0.86, 8600],
  ] as const)("%s はサーバ側のモック規則で %s、署名つき", async (task, decision, probability, bps) => {
    const res = await call(ENV, input(task));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proof: Proof };
    expect(body).toMatchObject({ decision, probability, source: "mock", proof: { bps } });
    expect(await verify(body.proof, await decisionMessage(ESCROW, task, decision, bps))).toBe(true);
  });

  it("署名に失敗したら 500（鍵の中身は出さない）", async () => {
    const res = await call({ ORACLE_SECRET_KEY: "abcd" }, input("x"));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("abcd");
  });
});
