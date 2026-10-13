import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@solana/web3.js";
import { fundAddress } from "./chain";
import { KeyedError } from "./i18n";

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("fundAddress の拒否", () => {
  const pubkey = Keypair.generate().publicKey;

  it("429 は、制限と残り時間を言うエラーにする（応答しなかった扱いにしない）", async () => {
    vi.stubGlobal("fetch", reply(429, { error: "too many requests", retryAfter: 500 }));
    const e = await fundAddress(pubkey).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(KeyedError);
    expect((e as KeyedError).msg).toEqual({ k: "err.fundRateLimited", p: { wait: "8:20" } });
  });

  it("429 の本文が JSON でなくても、制限であることは言う", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 429 })));
    expect(((await fundAddress(pubkey).catch((x: unknown) => x)) as KeyedError).msg.k).toBe("err.fundRateLimitedSoon");
  });

  it("429 以外の失敗は従来どおり HTTP の番号を言う", async () => {
    vi.stubGlobal("fetch", reply(502, { error: "faucet failed" }));
    expect(((await fundAddress(pubkey).catch((x: unknown) => x)) as KeyedError).msg).toEqual({
      k: "err.fundFailed",
      p: { status: 502 },
    });
  });
});
