import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { FUND_LAMPORTS, FUND_SKIP_LAMPORTS, onRequestPost } from "./fund";

type Env = { FAUCET_SECRET_KEY?: string; HELIUS_RPC_URL?: string };

const SEED_HEX = "07".repeat(32);
const FAUCET = Keypair.fromSeed(new Uint8Array(32).fill(7));
const TARGET = "CgKtt9XQ9ydTtPXkm691r3aDVhiHD95juD5854x4FGkk";
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
const ENV: Env = { FAUCET_SECRET_KEY: SEED_HEX };

const rpc = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });

const call = (env: Env, body: unknown = { address: TARGET }, ip = "203.0.113.1") =>
  onRequestPost({
    request: new Request("https://sokketsu.pages.dev/api/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify(body),
    }),
    env,
  } as unknown as Parameters<typeof onRequestPost>[0]);

// Workers の caches.default を、テストごとに空の Map で差し替える。
let store: Map<string, Response>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("caches", {
    default: {
      match: async (req: Request) => store.get(req.url),
      put: async (req: Request, res: Response) => void store.set(req.url, res),
    },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/fund", () => {
  it("faucet の鍵が無ければ 503", async () => expect((await call({})).status).toBe(503));

  it("アドレスが base58 の公開鍵でなければ 400", async () =>
    expect((await call(ENV, { address: "nope" })).status).toBe(400));

  it("残高が十分なアドレスには送らず 409", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(ENV)).status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("送金して 200 と取引 ID を返す。中身は faucet → 指定アドレスへ FUND_LAMPORTS の送金 1 件", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rpc({ value: 0 }))
      .mockResolvedValueOnce(rpc({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1 } }))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const { params } = JSON.parse(String(init.body)) as { params: [string, unknown] };
        return rpc(Transaction.from(Buffer.from(params[0], "base64")).signature ? "sig" : null);
      });
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { signature: string; lamports: number };
    expect(body.lamports).toBe(FUND_LAMPORTS);
    const sent = JSON.parse(String(fetchMock.mock.calls[2][1].body)) as { method: string; params: [string] };
    expect(sent.method).toBe("sendTransaction");
    const tx = Transaction.from(Buffer.from(sent.params[0], "base64"));
    expect(tx.verifySignatures()).toBe(true);
    expect(tx.instructions[0].data).toEqual(
      SystemProgram.transfer({ fromPubkey: FAUCET.publicKey, toPubkey: tx.instructions[0].keys[1].pubkey, lamports: FUND_LAMPORTS }).data,
    );
    expect(tx.instructions[0].keys[1].pubkey.toBase58()).toBe(TARGET);
  });

  it("同じ IP からの 2 回目は間隔を空けるまで 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(rpc({ value: 0 }))
        .mockResolvedValueOnce(rpc({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1 } }))
        .mockResolvedValueOnce(rpc("sig")),
    );
    expect((await call(ENV)).status).toBe(200);
    expect((await call(ENV)).status).toBe(429);
    // 別の IP・別のアドレスは通る（残高確認まで進む）
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS })));
    expect((await call(ENV, { address: FAUCET.publicKey.toBase58() }, "203.0.113.2")).status).toBe(409);
  });

  it("1 件目の送金が終わる前に届いた同じ IP の 2 件目も 429（送金の前に予約する）", async () => {
    let release!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (release = r));
    const fetchMock = vi.fn().mockReturnValueOnce(pending);
    vi.stubGlobal("fetch", fetchMock);
    const first = call(ENV);
    // 1 件目が RPC（残高確認）を待っている最中に、2 件目が届く
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((await call(ENV)).status).toBe(429);
    release(rpc({ value: FUND_SKIP_LAMPORTS }));
    await first;
  });

  it("別の IP からでも同じアドレスへの 2 回目は 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(rpc({ value: 0 }))
        .mockResolvedValueOnce(rpc({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1 } }))
        .mockResolvedValueOnce(rpc("sig")),
    );
    expect((await call(ENV, { address: TARGET }, "203.0.113.10")).status).toBe(200);
    expect((await call(ENV, { address: TARGET }, "203.0.113.11")).status).toBe(429);
  });

  it("RPC がエラーを返したら 502（鍵の中身は出さない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: -32000, message: "x" } }), { status: 200 })),
    );
    const res = await call(ENV);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(SEED_HEX);
  });

  it("予備 RPC が devnet 以外を指していたら使わず、公開 devnet RPC に送る", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS }));
    vi.stubGlobal("fetch", fetchMock);
    await call({ ...ENV, HELIUS_RPC_URL: "https://mainnet.helius-rpc.com/?api-key=x" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.devnet.solana.com");
  });

  const body = async (res: Response) => ({ status: res.status, body: await res.json() });

  it("拒否の理由を本文で返す（鍵なし・不正なアドレス・連打・残高あり・RPC 失敗）", async () => {
    expect(await body(await call({}))).toEqual({ status: 503, body: { error: "faucet unavailable" } });
    expect(await body(await call(ENV, { address: "nope" }))).toEqual({ status: 400, body: { error: "bad request" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS })));
    expect(await body(await call(ENV))).toEqual({ status: 409, body: { error: "already funded" } });
    expect(await body(await call(ENV))).toEqual({ status: 429, body: { error: "too many requests" } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await body(await call(ENV, { address: TARGET }, "203.0.113.9"))).toEqual({
      status: 429,
      body: { error: "too many requests" },
    });
  });

  it("RPC の失敗は理由つきで 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await body(await call(ENV))).toEqual({ status: 502, body: { error: "faucet failed" } });
  });

  it("RPC が result を返さなければ（エラーも無くても）502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1 }), { status: 200 })));
    expect((await call(ENV)).status).toBe(502);
  });

  it("RPC への要求は POST・JSON-RPC 2.0 で、残高・blockhash・送信の順にパラメータを渡す", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rpc({ value: 0 }))
      .mockResolvedValueOnce(rpc({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1 } }))
      .mockResolvedValueOnce(rpc("sig"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await call(ENV)).status).toBe(200);
    const sent = fetchMock.mock.calls.map(([, init]) => ({
      method: init.method,
      headers: init.headers,
      body: JSON.parse(String(init.body)),
    }));
    for (const r of sent) {
      expect(r.method).toBe("POST");
      expect(r.headers).toEqual({ "Content-Type": "application/json" });
      expect(r.body.jsonrpc).toBe("2.0");
    }
    expect(sent[0].body).toMatchObject({ method: "getBalance", params: [TARGET] });
    expect(sent[1].body).toMatchObject({ method: "getLatestBlockhash", params: [{ commitment: "confirmed" }] });
    expect(sent[2].body.method).toBe("sendTransaction");
    expect(sent[2].body.params[1]).toEqual({ encoding: "base64" });
  });

  it("予備 RPC が devnet なら、公開 RPC ではなくそちらを使う", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS }));
    vi.stubGlobal("fetch", fetchMock);
    await call({ ...ENV, HELIUS_RPC_URL: "https://devnet.helius-rpc.com/?api-key=x" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://devnet.helius-rpc.com/?api-key=x");
  });

  it("途中に devnet を含むだけの URL は予備 RPC として使わない", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS }));
    vi.stubGlobal("fetch", fetchMock);
    await call({ ...ENV, HELIUS_RPC_URL: "https://evil.example/?u=https://devnet.x" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.devnet.solana.com");
  });

  it("制限の記録は 10 分（max-age=600）で、IP とアドレスの両方に置く", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS })));
    await call(ENV, { address: TARGET }, "198.51.100.7");
    const keys = [...store.keys()];
    expect(keys).toEqual(
      expect.arrayContaining([
        "https://sokketsu-fund.internal/ip/198.51.100.7",
        `https://sokketsu-fund.internal/address/${TARGET}`,
      ]),
    );
    for (const res of store.values()) expect(res.headers.get("Cache-Control")).toBe("max-age=600");
  });

  it("CF-Connecting-IP が無いリクエストも 1 つの IP（unknown）として制限する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(rpc({ value: FUND_SKIP_LAMPORTS })));
    const noIp = new Request("https://sokketsu.pages.dev/api/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: TARGET }),
    });
    await onRequestPost({ request: noIp, env: ENV } as unknown as Parameters<typeof onRequestPost>[0]);
    expect([...store.keys()]).toContain("https://sokketsu-fund.internal/ip/unknown");
  });

  it.each([
    ["error を返す", { jsonrpc: "2.0", id: 1, error: { code: -32002, message: "blockhash not found" } }],
    ["result も error も無い", { jsonrpc: "2.0", id: 1 }],
  ])("送金（sendTransaction）が %s なら、送れていないので 502（取引 ID を返さない）", async (_, sendReply) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(rpc({ value: 0 }))
        .mockResolvedValueOnce(rpc({ value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1 } }))
        .mockResolvedValueOnce(new Response(JSON.stringify(sendReply), { status: 200 })),
    );
    expect(await (await call(ENV)).json()).toEqual({ error: "faucet failed" });
  });
});
