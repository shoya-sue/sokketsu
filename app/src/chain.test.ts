import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BorshAccountsCoder, BN } from "@coral-xyz/anchor";
import {
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import idl from "./idl/sokketsu.json";
import type { JudgeOutput } from "./judge";
import {
  DEADLINE_SLOTS,
  DECISION_CODE,
  DEPOSIT_LAMPORTS,
  PROGRAM_ID,
  airdropTo,
  closeIx,
  connection,
  decisionMessage,
  depositIx,
  escrowAddress,
  fetchAlpenglowStatus,
  fetchEscrow,
  fundAddress,
  getBalance,
  getSlot,
  keypairSigner,
  onRpcRoute,
  parseSecretKey,
  refundIx,
  sendAndMeasure,
  sendSetup,
  setRpcFallbackToken,
  settleIxs,
  stateHashOf,
  subscribeSlots,
  sweepEscrows,
  topUpIx,
} from "./chain";

// ネットワークに出るのは Connection だけ。実物を継承して、RPC を呼ぶメソッドだけを差し替える。
// 命令の組み立て（Anchor の IDL エンコード）は実物のまま動かす。
const rpc = vi.hoisted(() => ({
  getLatestBlockhash: vi.fn(),
  sendRawTransaction: vi.fn(),
  getSignatureStatuses: vi.fn(),
  onSignature: vi.fn(),
  removeSignatureListener: vi.fn(),
  onSlotChange: vi.fn(),
  removeSlotChangeListener: vi.fn(),
  getProgramAccounts: vi.fn(),
  getAccountInfoAndContext: vi.fn(),
  getSlot: vi.fn(),
  getBalance: vi.fn(),
  requestAirdrop: vi.fn(),
  instances: [] as { self: unknown; isMeasure: boolean }[],
}));

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  class FakeConnection extends actual.Connection {
    constructor(url: string, opts?: unknown) {
      super(url, opts as never);
      rpc.instances.push({ self: this, isMeasure: Boolean((opts as { disableRetryOnRateLimit?: boolean }).disableRetryOnRateLimit) });
    }
    getLatestBlockhash = rpc.getLatestBlockhash;
    sendRawTransaction = rpc.sendRawTransaction;
    getSignatureStatuses = rpc.getSignatureStatuses;
    onSignature = rpc.onSignature;
    removeSignatureListener = rpc.removeSignatureListener;
    onSlotChange = rpc.onSlotChange;
    removeSlotChangeListener = rpc.removeSlotChangeListener;
    getProgramAccounts = rpc.getProgramAccounts;
    getAccountInfoAndContext = rpc.getAccountInfoAndContext;
    getSlot = rpc.getSlot;
    getBalance = rpc.getBalance;
    requestAirdrop = rpc.requestAirdrop;
  }
  return { ...actual, Connection: FakeConnection };
});

const coder = new BorshAccountsCoder(idl as never);
const encodeEscrow = (o: { payer: PublicKey; status: number; deadlineSlot: number; payee?: PublicKey }) =>
  coder.encode("Escrow", {
    payer: o.payer,
    payee: o.payee ?? Keypair.generate().publicKey,
    operator: Keypair.generate().publicKey,
    amount: new BN(DEPOSIT_LAMPORTS),
    deadline_slot: new BN(o.deadlineSlot),
    state_hash: Array(32).fill(7),
    decision: 2,
    probability_bps: 6000,
    bumped: 1,
    status: o.status,
    source: 2,
  });
const accountInfo = (data: Buffer) => ({
  data,
  executable: false,
  lamports: 1_000_000,
  owner: PROGRAM_ID,
  rentEpoch: 0,
});
const keys = (ix: TransactionInstruction) =>
  ix.keys.map((k) => ({ key: k.pubkey.toBase58(), signer: k.isSigner, writable: k.isWritable }));
const BLOCKHASH = PublicKey.default.toBase58();

beforeEach(() => {
  for (const [, fn] of Object.entries(rpc)) if (typeof fn === "function") fn.mockReset();
  rpc.getLatestBlockhash.mockResolvedValue({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 });
  rpc.sendRawTransaction.mockResolvedValue("sig");
  rpc.getSignatureStatuses.mockResolvedValue({ value: [null] });
  rpc.onSignature.mockReturnValue(1);
  rpc.removeSignatureListener.mockResolvedValue(undefined);
  rpc.removeSlotChangeListener.mockResolvedValue(undefined);
});

describe("parseSecretKey", () => {
  const kp = Keypair.generate();

  it("solana-keygen の JSON 配列を読む", () =>
    expect(parseSecretKey(JSON.stringify([...kp.secretKey])).publicKey.equals(kp.publicKey)).toBe(true));
  it("base58 を読む（前後の空白は無視）", () =>
    expect(parseSecretKey(`  ${bs58.encode(kp.secretKey)}\n`).publicKey.equals(kp.publicKey)).toBe(true));
  it("64 バイトでなければ例外", () =>
    expect(() => parseSecretKey(JSON.stringify([1, 2, 3]))).toThrow("err.keyLength"));
  it("壊れた JSON は例外", () => expect(() => parseSecretKey("[1, 2,")).toThrow("err.keyFormat"));
});

describe("stateHashOf", () => {
  it("依頼文の sha256（32 バイト）", async () => {
    const hash = await stateHashOf("abc");
    expect(hash).toHaveLength(32);
    // sha256("abc") の既知値
    expect(Buffer.from(hash).toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("escrowAddress", () => {
  it("seeds = [escrow, payer, state_hash] の PDA と一致する", async () => {
    const payer = Keypair.generate().publicKey;
    const hash = await stateHashOf("hold: wait #ab12");
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), payer.toBuffer(), Buffer.from(hash)],
      PROGRAM_ID,
    );
    expect(escrowAddress(payer, hash).equals(expected)).toBe(true);
  });
  it("依頼文が違えば別の escrow", async () => {
    const payer = Keypair.generate().publicKey;
    const a = escrowAddress(payer, await stateHashOf("a"));
    const b = escrowAddress(payer, await stateHashOf("b"));
    expect(a.equals(b)).toBe(false);
  });
});

const payer = Keypair.generate();
const payee = Keypair.generate().publicKey;
const operator = Keypair.generate().publicKey;

describe("depositIx", () => {
  it("口座の並びと署名者が deposit の定義どおり", async () => {
    const hash = await stateHashOf("task");
    const escrow = escrowAddress(payer.publicKey, hash);
    const ix = await depositIx(payer.publicKey, payee, hash, operator);
    expect(ix.programId.equals(PROGRAM_ID)).toBe(true);
    expect(keys(ix)).toEqual([
      { key: payer.publicKey.toBase58(), signer: true, writable: true },
      { key: payee.toBase58(), signer: false, writable: false },
      { key: escrow.toBase58(), signer: false, writable: true },
      { key: SystemProgram.programId.toBase58(), signer: false, writable: false },
    ]);
  });
  it("引数（金額・状態ハッシュ・期限・操作鍵）を命令データに載せる", async () => {
    const hash = await stateHashOf("task");
    const ix = await depositIx(payer.publicKey, payee, hash, operator);
    const data = ix.data;
    const discriminator = idl.instructions.find((i) => i.name === "deposit")!.discriminator;
    expect([...data.subarray(0, 8)]).toEqual(discriminator);
    expect(data.readBigUInt64LE(8)).toBe(BigInt(DEPOSIT_LAMPORTS));
    expect([...data.subarray(16, 48)]).toEqual(hash);
    expect(data.readBigUInt64LE(48)).toBe(BigInt(DEADLINE_SLOTS));
    expect(new PublicKey(data.subarray(56, 88)).equals(operator)).toBe(true);
  });
});

describe("decisionMessage", () => {
  it("prefix / escrow / state_hash / decision / bps(LE) / source の並び", () => {
    const escrow = Keypair.generate().publicKey;
    const hash = Array.from({ length: 32 }, (_, i) => i);
    const m = decisionMessage(escrow, hash, "refund", 0x1234, "jev");
    const prefix = new TextEncoder().encode("sokketsu-decision-v3");
    const n = prefix.length;
    expect(m).toHaveLength(n + 68);
    expect([...m.subarray(0, n)]).toEqual([...prefix]);
    expect([...m.subarray(n, n + 32)]).toEqual([...escrow.toBytes()]);
    expect([...m.subarray(n + 32, n + 64)]).toEqual(hash);
    expect(m[n + 64]).toBe(DECISION_CODE.refund);
    expect([m[n + 65], m[n + 66]]).toEqual([0x34, 0x12]);
    expect(m[n + 67]).toBe(1);
  });
});

describe("settleIxs", () => {
  const oracle = Keypair.generate();
  const hash = Array(32).fill(3);
  const escrow = Keypair.generate().publicKey;
  const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
  const judgement = (over: Partial<JudgeOutput> = {}): JudgeOutput => ({
    decision: "release",
    probability: 0.9,
    source: "jev",
    proof: { publicKey: hex(oracle.publicKey.toBytes()), signature: hex(new Uint8Array(64).fill(9)), bps: 9000 },
    ...over,
  });

  it("[Ed25519 検証命令, settle] の順に返す", async () => {
    const ixs = await settleIxs(payer.publicKey, payer.publicKey, payee, escrow, hash, judgement());
    expect(ixs).toHaveLength(2);
    expect(ixs[0].programId.equals(Ed25519Program.programId)).toBe(true);
    expect(ixs[1].programId.equals(PROGRAM_ID)).toBe(true);
  });
  it("Ed25519 命令にオラクルの公開鍵・署名・判断メッセージを入れる", async () => {
    const [verify] = await settleIxs(payer.publicKey, payer.publicKey, payee, escrow, hash, judgement());
    const expected = Ed25519Program.createInstructionWithPublicKey({
      publicKey: oracle.publicKey.toBytes(),
      message: decisionMessage(escrow, hash, "release", 9000, "jev"),
      signature: new Uint8Array(64).fill(9),
    });
    expect(verify.data.equals(expected.data)).toBe(true);
  });
  it("settle の口座は submitter / payer / escrow / payee / instructions sysvar の順", async () => {
    const submitter = Keypair.generate().publicKey;
    const [, settle] = await settleIxs(submitter, payer.publicKey, payee, escrow, hash, judgement());
    expect(keys(settle).map((k) => k.key)).toEqual([
      submitter.toBase58(),
      payer.publicKey.toBase58(),
      escrow.toBase58(),
      payee.toBase58(),
      SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
    ]);
    expect(keys(settle)[0].signer).toBe(true);
    expect(keys(settle)[1].signer).toBe(false);
  });
  it("判断・bps・出所を settle の引数に載せる", async () => {
    const j = judgement({ decision: "hold", source: "mock" });
    j.proof = { ...j.proof!, bps: 0x0102 };
    const [, settle] = await settleIxs(payer.publicKey, payer.publicKey, payee, escrow, hash, j);
    expect([...settle.data.subarray(8)]).toEqual([DECISION_CODE.hold, 0x02, 0x01, 2]);
  });
  it("署名が無ければ err.decisionUnsigned", async () => {
    await expect(
      settleIxs(payer.publicKey, payer.publicKey, payee, escrow, hash, judgement({ proof: undefined })),
    ).rejects.toThrow("err.decisionUnsigned");
  });
  it.each([
    ["公開鍵の長さが違う", { publicKey: "ab" }],
    ["署名が hex でない", { signature: "zz".repeat(64) }],
  ])("%s と err.decisionUnsigned", async (_name, patch) => {
    const j = judgement();
    j.proof = { ...j.proof!, ...patch };
    await expect(settleIxs(payer.publicKey, payer.publicKey, payee, escrow, hash, j)).rejects.toThrow(
      "err.decisionUnsigned",
    );
  });
});

describe("refundIx / closeIx / topUpIx", () => {
  const escrow = Keypair.generate().publicKey;
  it("refund は payer（署名不要）と escrow（書き込み）", async () => {
    const ix = await refundIx(payer.publicKey, escrow);
    expect(keys(ix)).toEqual([
      { key: payer.publicKey.toBase58(), signer: false, writable: true },
      { key: escrow.toBase58(), signer: false, writable: true },
    ]);
  });
  it("close も payer（署名不要）と escrow で、refund とは別の命令", async () => {
    const ix = await closeIx(payer.publicKey, escrow);
    const refund = await refundIx(payer.publicKey, escrow);
    expect(keys(ix).map((k) => k.signer)).toEqual([false, false]);
    expect(ix.data.equals(refund.data)).toBe(false);
  });
  it("topUp は from から to への SystemProgram.transfer", () => {
    const to = Keypair.generate().publicKey;
    const ix = topUpIx(payer.publicKey, to, 1234);
    expect(ix.programId.equals(SystemProgram.programId)).toBe(true);
    expect(ix.keys[0].pubkey.equals(payer.publicKey)).toBe(true);
    expect(ix.keys[1].pubkey.equals(to)).toBe(true);
    expect(ix.data.readBigUInt64LE(4)).toBe(1234n);
  });
});

describe("fetchEscrow", () => {
  it("口座が無ければ null", async () => {
    rpc.getAccountInfoAndContext.mockResolvedValue({ context: { slot: 1 }, value: null });
    expect(await fetchEscrow(Keypair.generate().publicKey)).toBeNull();
  });
  it("口座を表示用の形に直す", async () => {
    rpc.getAccountInfoAndContext.mockResolvedValue({
      context: { slot: 1 },
      value: accountInfo(await encodeEscrow({ payer: payer.publicKey, payee, status: 1, deadlineSlot: 555 })),
    });
    expect(await fetchEscrow(Keypair.generate().publicKey)).toEqual({
      payee: payee.toBase58(),
      amount: DEPOSIT_LAMPORTS,
      decision: 2,
      probabilityBps: 6000,
      status: 1,
      deadlineSlot: 555,
    });
  });
});

describe("getBalance / getSlot", () => {
  it("接続の結果をそのまま返す", async () => {
    rpc.getBalance.mockResolvedValue(42);
    rpc.getSlot.mockResolvedValue(7);
    expect(await getBalance(payer.publicKey)).toBe(42);
    expect(await getSlot()).toBe(7);
    expect(rpc.getBalance).toHaveBeenCalledWith(payer.publicKey);
  });
});

describe("keypairSigner", () => {
  it("Keypair で部分署名して同じ取引を返す", async () => {
    const signer = keypairSigner(payer);
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: BLOCKHASH }).add(
      topUpIx(payer.publicKey, payee, 1),
    );
    expect(signer.publicKey.equals(payer.publicKey)).toBe(true);
    const signed = await signer.signTransaction(tx);
    expect(signed).toBe(tx);
    expect(signed.signature).not.toBeNull();
  });
});

describe("sendAndMeasure", () => {
  const signer = keypairSigner(payer);
  const ixs = () => [topUpIx(payer.publicKey, payee, 1)];
  type Notify = (r: { err: unknown }) => void;
  // 購読の callback を commitment ごとに取り出す
  const subscriptions = () => {
    const cbs: Record<string, Notify> = {};
    let id = 0;
    rpc.onSignature.mockImplementation((_sig: string, cb: Notify, commitment: string) => {
      cbs[commitment] = cb;
      return ++id;
    });
    return cbs;
  };

  it("WebSocket の通知で processed / finalized を計測して返す", async () => {
    const cbs = subscriptions();
    rpc.sendRawTransaction.mockImplementation(async () => {
      setTimeout(() => cbs.processed({ err: null }), 5);
      setTimeout(() => cbs.finalized({ err: null }), 20);
      return "sig";
    });
    const m = await sendAndMeasure(signer, ixs(), 1000, undefined, 500);
    expect(m.error).toBeNull();
    expect(m.processedMs).not.toBeNull();
    expect(m.finalizedMs).not.toBeNull();
    expect(m.finalizedMs!).toBeGreaterThanOrEqual(m.processedMs!);
    expect(bs58.decode(m.signature)).toHaveLength(64);
    expect(m.rateLimited).toBe(false);
  });
  it("送信の前に processed と finalized の両方を購読する", async () => {
    const order: string[] = [];
    rpc.onSignature.mockImplementation((_s: string, _cb: unknown, c: string) => {
      order.push(`sub:${c}`);
      return 1;
    });
    rpc.sendRawTransaction.mockImplementation(async () => {
      order.push("send");
      return "sig";
    });
    await sendAndMeasure(signer, ixs(), 30, undefined, 10);
    expect(order).toEqual(["sub:processed", "sub:finalized", "send"]);
  });
  it("onSent に送信時刻を渡す", async () => {
    const onSent = vi.fn();
    await sendAndMeasure(signer, ixs(), 30, onSent, 10);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(typeof onSent.mock.calls[0][0]).toBe("number");
  });
  it("通知が失敗（err）なら error を返し、finalizedMs は null", async () => {
    const cbs = subscriptions();
    rpc.sendRawTransaction.mockImplementation(async () => {
      setTimeout(() => cbs.processed({ err: { InstructionError: [0, "Custom"] } }), 5);
      return "sig";
    });
    const m = await sendAndMeasure(signer, ixs(), 1000, undefined, 500);
    expect(m.error).toBe(JSON.stringify({ InstructionError: [0, "Custom"] }));
    expect(m.finalizedMs).toBeNull();
    expect(m.processedMs).not.toBeNull();
  });
  it("通知が来なくてもポーリングで finalized を拾う", async () => {
    rpc.getSignatureStatuses
      .mockResolvedValueOnce({ value: [{ confirmationStatus: "processed", err: null }] })
      .mockResolvedValue({ value: [{ confirmationStatus: "finalized", err: null }] });
    const m = await sendAndMeasure(signer, ixs(), 1000, undefined, 5);
    expect(m.finalizedMs).not.toBeNull();
    expect(m.processedMs).not.toBeNull();
    expect(m.error).toBeNull();
  });
  it("ポーリングで取引の失敗を見つけたら error を返す", async () => {
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ confirmationStatus: "processed", err: "boom" }] });
    const m = await sendAndMeasure(signer, ixs(), 1000, undefined, 5);
    expect(m.error).toBe('"boom"');
    expect(m.finalizedMs).toBeNull();
  });
  it("時間切れなら finalizedMs は null（未確定）", async () => {
    const m = await sendAndMeasure(signer, ixs(), 40, undefined, 10);
    expect(m.finalizedMs).toBeNull();
    expect(m.processedMs).toBeNull();
    expect(m.error).toBeNull();
  });
  it("枠を過ぎてから届いた通知は計測に含めない", async () => {
    const cbs = subscriptions();
    rpc.sendRawTransaction.mockImplementation(async () => {
      setTimeout(() => cbs.finalized({ err: null }), 60);
      return "sig";
    });
    const m = await sendAndMeasure(signer, ixs(), 30, undefined, 10);
    expect(m.finalizedMs).toBeNull();
  });
  it("ポーリングの 429 は rateLimited に記録し、待ちは続ける", async () => {
    rpc.getSignatureStatuses.mockRejectedValue(new Error("429 Too Many Requests"));
    const m = await sendAndMeasure(signer, ixs(), 40, undefined, 10);
    expect(m.rateLimited).toBe(true);
    expect(m.finalizedMs).toBeNull();
  });
  it("ポーリングが 429 以外で失敗しても WebSocket の通知を待つ", async () => {
    const cbs = subscriptions();
    rpc.getSignatureStatuses.mockRejectedValue(new Error("network down"));
    rpc.sendRawTransaction.mockImplementation(async () => {
      setTimeout(() => cbs.finalized({ err: null }), 15);
      return "sig";
    });
    const m = await sendAndMeasure(signer, ixs(), 1000, undefined, 500);
    expect(m.finalizedMs).not.toBeNull();
    expect(m.rateLimited).toBe(false);
  });
  it("送信が 429 なら err.rateLimitedSend", async () => {
    rpc.sendRawTransaction.mockRejectedValue(new Error("429 Too Many Requests"));
    await expect(sendAndMeasure(signer, ixs(), 30, undefined, 10)).rejects.toThrow("err.rateLimitedSend");
  });
  it("送信が 429 以外で失敗したらそのまま投げる", async () => {
    rpc.sendRawTransaction.mockRejectedValue(new Error("blockhash not found"));
    await expect(sendAndMeasure(signer, ixs(), 30, undefined, 10)).rejects.toThrow("blockhash not found");
  });
  it("例外でも通知を受けていない購読を解除する", async () => {
    rpc.sendRawTransaction.mockRejectedValue(new Error("x"));
    await expect(sendAndMeasure(signer, ixs(), 30, undefined, 10)).rejects.toThrow("x");
    expect(rpc.removeSignatureListener).toHaveBeenCalledTimes(2);
  });
  it("通知を受けていない購読だけを解除する", async () => {
    const cbs = subscriptions();
    rpc.sendRawTransaction.mockImplementation(async () => {
      setTimeout(() => cbs.processed({ err: null }), 5);
      return "sig";
    });
    await sendAndMeasure(signer, ixs(), 40, undefined, 10);
    expect(rpc.removeSignatureListener).toHaveBeenCalledTimes(1);
    expect(rpc.removeSignatureListener).toHaveBeenCalledWith(2);
  });
  it("接続は通常用と計測用（429 の自動リトライなし）の 2 本", () => {
    expect(connection).toBe(rpc.instances[0].self);
    expect(rpc.instances.map((i) => i.isMeasure)).toEqual([false, true]);
  });
  it("blockhash は confirmed で取る", async () => {
    await sendAndMeasure(signer, ixs(), 20, undefined, 10);
    expect(rpc.getLatestBlockhash).toHaveBeenCalledWith("confirmed");
  });
  it("sendSetup は skipPreflight で送り、確定まで待つ", async () => {
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ confirmationStatus: "finalized", err: null }] });
    const m = await sendSetup(signer, ixs());
    expect(m.finalizedMs).not.toBeNull();
    expect(rpc.sendRawTransaction).toHaveBeenCalledWith(expect.anything(), { skipPreflight: true });
  });
});

describe("subscribeSlots", () => {
  it("slot の通知を渡し、解除関数で購読を外す", () => {
    let cb: (i: { slot: number }) => void = () => {};
    rpc.onSlotChange.mockImplementation((f: typeof cb) => {
      cb = f;
      return 9;
    });
    const seen: number[] = [];
    const off = subscribeSlots((s) => seen.push(s));
    cb({ slot: 100 });
    expect(seen).toEqual([100]);
    off();
    expect(rpc.removeSlotChangeListener).toHaveBeenCalledWith(9);
  });
});

describe("sweepEscrows", () => {
  const signer = keypairSigner(Keypair.generate());
  const row = async (status: number, deadlineSlot: number) => ({
    pubkey: Keypair.generate().publicKey,
    account: accountInfo(await encodeEscrow({ payer: payer.publicKey, status, deadlineSlot })),
  });
  const finalizeAll = () =>
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ confirmationStatus: "finalized", err: null }] });

  afterEach(() => vi.useRealTimers());

  it("発注者と今のレイアウトの大きさで口座を絞り込む", async () => {
    rpc.getProgramAccounts.mockResolvedValue([]);
    rpc.getSlot.mockResolvedValue(10);
    await sweepEscrows(signer, payer.publicKey);
    const [programId, config] = rpc.getProgramAccounts.mock.calls[0];
    expect(programId.equals(PROGRAM_ID)).toBe(true);
    const filters = config.filters as { memcmp?: { offset: number; bytes: string }; dataSize?: number }[];
    expect(filters).toContainEqual({ memcmp: { offset: 8, bytes: payer.publicKey.toBase58() } });
    expect(filters.some((f) => typeof f.dataSize === "number")).toBe(true);
  });
  it("期限前の open は触らず waiting に数える", async () => {
    rpc.getProgramAccounts.mockResolvedValue([await row(0, 100)]);
    rpc.getSlot.mockResolvedValue(99);
    expect(await sweepEscrows(signer, payer.publicKey)).toEqual({ refunded: 0, closed: 0, waiting: 1, failed: 0 });
    expect(rpc.sendRawTransaction).not.toHaveBeenCalled();
  });
  it("期限ちょうど（slot == deadline）の open は回収する（refund + close）", async () => {
    rpc.getProgramAccounts.mockResolvedValue([await row(0, 100)]);
    rpc.getSlot.mockResolvedValue(100);
    finalizeAll();
    expect(await sweepEscrows(signer, payer.publicKey)).toEqual({ refunded: 1, closed: 1, waiting: 0, failed: 0 });
    expect(rpc.sendRawTransaction).toHaveBeenCalledTimes(1);
  });
  it.each([1, 2])("終了済み（status %i）は期限前でも close だけ（refunded に数えない）", async (status) => {
    rpc.getProgramAccounts.mockResolvedValue([await row(status, 1_000_000)]);
    rpc.getSlot.mockResolvedValue(1);
    finalizeAll();
    expect(await sweepEscrows(signer, payer.publicKey)).toEqual({ refunded: 0, closed: 1, waiting: 0, failed: 0 });
  });
  it("期限切れの open は refund と close を 1 取引に入れる", async () => {
    const r = await row(0, 1);
    rpc.getProgramAccounts.mockResolvedValue([r]);
    rpc.getSlot.mockResolvedValue(5);
    finalizeAll();
    await sweepEscrows(signer, payer.publicKey);
    const tx = Transaction.from(rpc.sendRawTransaction.mock.calls[0][0]);
    expect(tx.instructions).toHaveLength(2);
    const refund = await refundIx(payer.publicKey, r.pubkey);
    const close = await closeIx(payer.publicKey, r.pubkey);
    expect(tx.instructions[0].data.equals(refund.data)).toBe(true);
    expect(tx.instructions[1].data.equals(close.data)).toBe(true);
    expect(tx.instructions[0].keys[1].pubkey.equals(r.pubkey)).toBe(true);
  });
  it("送信の失敗・取引の失敗は failed に数え、残りの口座は続ける", async () => {
    vi.useFakeTimers();
    rpc.getProgramAccounts.mockResolvedValue([await row(1, 1), await row(1, 1), await row(1, 1)]);
    rpc.getSlot.mockResolvedValue(5);
    rpc.sendRawTransaction.mockRejectedValueOnce(new Error("boom")).mockResolvedValue("sig");
    rpc.getSignatureStatuses
      .mockResolvedValueOnce({ value: [{ confirmationStatus: "processed", err: { x: 1 } }] })
      .mockResolvedValue({ value: [{ confirmationStatus: "finalized", err: null }] });
    const p = sweepEscrows(signer, payer.publicKey);
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ refunded: 0, closed: 1, waiting: 0, failed: 2 });
  });
  it("確定しなかった取引も failed に数える", async () => {
    vi.useFakeTimers();
    rpc.getProgramAccounts.mockResolvedValue([await row(1, 1)]);
    rpc.getSlot.mockResolvedValue(5);
    const p = sweepEscrows(signer, payer.publicKey);
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ refunded: 0, closed: 0, waiting: 0, failed: 1 });
  });
  it("2 件目からは送信の前に間を空ける", async () => {
    vi.useFakeTimers();
    rpc.getProgramAccounts.mockResolvedValue([await row(1, 1), await row(1, 1)]);
    rpc.getSlot.mockResolvedValue(5);
    finalizeAll();
    const p = sweepEscrows(signer, payer.publicKey);
    await vi.advanceTimersByTimeAsync(0);
    expect(rpc.sendRawTransaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(rpc.sendRawTransaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(rpc.sendRawTransaction).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();
    expect((await p).closed).toBe(2);
  });
});

describe("airdropTo / fundAddress", () => {
  const finalized = { value: [{ confirmationStatus: "finalized", err: null }] };
  afterEach(() => vi.unstubAllGlobals());

  it("airdrop が finalized になれば完了", async () => {
    rpc.requestAirdrop.mockResolvedValue("airdropSig");
    rpc.getSignatureStatuses.mockResolvedValue(finalized);
    await expect(airdropTo(payee)).resolves.toBeUndefined();
    expect(rpc.requestAirdrop).toHaveBeenCalledWith(payee, 1_000_000_000);
  });
  it("airdrop の取引が失敗なら例外", async () => {
    rpc.requestAirdrop.mockResolvedValue("airdropSig");
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ confirmationStatus: "processed", err: "bad" }] });
    await expect(airdropTo(payee)).rejects.toThrow('"bad"');
  });
  it("faucet が 409（残高は十分）なら何もしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 409 })));
    await fundAddress(payee);
    expect(rpc.getSignatureStatuses).not.toHaveBeenCalled();
  });
  it("faucet が失敗したら err.fundFailed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(fundAddress(payee)).rejects.toThrow("err.fundFailed");
  });
  it("faucet の署名が finalized になれば完了。宛先を POST する", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ signature: "fundSig" }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    rpc.getSignatureStatuses.mockResolvedValue(finalized);
    await fundAddress(payee);
    expect(f.mock.calls[0][0]).toBe("/api/fund");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ address: payee.toBase58() });
    expect(rpc.getSignatureStatuses).toHaveBeenCalledWith(["fundSig"]);
  });
  it("faucet の取引が失敗なら例外", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ signature: "s" }), { status: 200 })),
    );
    rpc.getSignatureStatuses.mockResolvedValue({ value: [{ confirmationStatus: "processed", err: "bad" }] });
    await expect(fundAddress(payee)).rejects.toThrow('"bad"');
  });
  it("airdrop が時間内に finalized にならなければ err.airdropUnconfirmed", async () => {
    vi.useFakeTimers();
    rpc.requestAirdrop.mockResolvedValue("airdropSig");
    const p = airdropTo(payee).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(31000);
    expect(((await p) as Error).message).toBe("err.airdropUnconfirmed");
    vi.useRealTimers();
  });
  it("faucet の署名が時間内に finalized にならなければ err.airdropUnconfirmed", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ signature: "s" }), { status: 200 })),
    );
    const p = fundAddress(payee).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(31000);
    expect(((await p) as Error).message).toBe("err.airdropUnconfirmed");
    vi.useRealTimers();
  });
});

describe("fetchAlpenglowStatus", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

  it("genesis cert があれば alpenglow（slot つき）", async () => {
    respond({ result: { block: { slot: 321 } } });
    expect(await fetchAlpenglowStatus()).toEqual({ kind: "alpenglow", genesisSlot: 321 });
  });
  it("result が null なら legacy", async () => {
    respond({ result: null });
    expect(await fetchAlpenglowStatus()).toEqual({ kind: "legacy" });
  });
  it("メソッドが無い（-32601）なら unknown", async () => {
    respond({ error: { code: -32601, message: "x" } });
    expect(await fetchAlpenglowStatus()).toMatchObject({ kind: "unknown", reason: { k: "rpc.methodMissing" } });
  });
  it("その他の RPC エラーは unknown（コードつき）", async () => {
    respond({ error: { code: -32000, message: "x" } });
    expect(await fetchAlpenglowStatus()).toMatchObject({
      kind: "unknown",
      reason: { k: "rpc.error", p: { code: -32000 } },
    });
  });
  it("slot が数値でなければ unknown", async () => {
    respond({ result: { block: { slot: "1" } } });
    expect(await fetchAlpenglowStatus()).toMatchObject({ kind: "unknown", reason: { k: "rpc.unexpected" } });
  });
  it("HTTP エラーは unknown（status つき）", async () => {
    respond({}, 404);
    expect(await fetchAlpenglowStatus()).toMatchObject({
      kind: "unknown",
      reason: { k: "rpc.http", p: { status: 404 } },
    });
  });
  it("通信が落ちたら unknown（理由つき）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchAlpenglowStatus()).toMatchObject({
      kind: "unknown",
      reason: { k: "rpc.network", p: { error: "offline" } },
    });
  });
  it("Error 以外で投げられても理由にする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("str"));
    expect(await fetchAlpenglowStatus()).toMatchObject({ reason: { p: { error: "str" } } });
  });
});

describe("予備 RPC の配線", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setRpcFallbackToken("");
  });
  it("公開 RPC が 429 でトークンがあれば予備へ送り、経路を通知する", async () => {
    const routes: string[] = [];
    onRpcRoute((r) => routes.push(r));
    setRpcFallbackToken("tok");
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: null }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await fetchAlpenglowStatus()).toEqual({ kind: "legacy" });
    expect(f.mock.calls[1][0]).toBe("/api/rpc");
    expect(new Headers(f.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer tok");
    expect(routes).toEqual(["fallback"]);
  });
});
