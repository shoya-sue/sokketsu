import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Ed25519Program,
  Keypair,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import idl from "./idl/sokketsu.json";
import type { Sokketsu } from "./idl/sokketsu";
import { SOURCE_CODE, type DecisionName, type JudgeOutput, type SourceName } from "./judge";
import { createFallbackFetch, type RpcRoute } from "./lib/rpcFallback";
import { KeyedError, msg, type Msg } from "./i18n";

// devnet 以外へは接続しない。公開 RPC が落ちたときだけ、予備（/api/rpc 経由の devnet RPC）を使う。
export const RPC_URL = "https://api.devnet.solana.com";
const FALLBACK_RPC_PATH = "/api/rpc";

let fallbackToken = "";
let routeListener: (route: RpcRoute) => void = () => {};
/** 予備 RPC に使うトークン（DEMO_TOKEN）。空なら予備は使わない。 */
export const setRpcFallbackToken = (token: string) => {
  fallbackToken = token;
};
/** 公開 / 予備のどちらで応答を得たかを受け取る。 */
export const onRpcRoute = (listener: (route: RpcRoute) => void) => {
  routeListener = listener;
};

const rpcFetch = createFallbackFetch({
  fallbackUrl: FALLBACK_RPC_PATH,
  getToken: () => fallbackToken,
  onRoute: (route) => routeListener(route),
});

export const connection = new Connection(RPC_URL, { commitment: "finalized", fetch: rpcFetch });
// 計測専用。web3.js の 429 自動リトライ（最大 7.5 秒待つ）が計測値を水増しするので切る。
const measureConnection = new Connection(RPC_URL, {
  commitment: "finalized",
  disableRetryOnRateLimit: true,
  fetch: rpcFetch,
});
export const PROGRAM_ID = new PublicKey(idl.address);

export const DEPOSIT_LAMPORTS = 0.05 * LAMPORTS_PER_SOL;
export const DEADLINE_SLOTS = 400;
export const RELEASE_THRESHOLD_BPS = 7000;
export const MEASURE_TIMEOUT_MS = 3000;
// WebSocket 通知が主。ポーリングは予備なので粗くする（公開 RPC の 429 対策）。
export const MEASURE_INTERVAL_MS = 300;
const SETUP_TIMEOUT_MS = 8000;
const SETUP_INTERVAL_MS = 1000;
const AIRDROP_LAMPORTS = LAMPORTS_PER_SOL;
const GENESIS_CERT_TIMEOUT_MS = 5000;
const SWEEP_GAP_MS = 1500;

export const DECISION_CODE: Record<DecisionName, number> = { release: 1, hold: 2, refund: 3 };

/**
 * 取引に署名する者。ページ内の Keypair（お試しの捨て鍵・操作鍵）と、接続したウォレットを同じ形で扱う。
 * ウォレットは承認ダイアログを出すので、署名は非同期。
 */
export type TxSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export const keypairSigner = (kp: Keypair): TxSigner => ({
  publicKey: kp.publicKey,
  signTransaction: async (tx) => {
    tx.partialSign(kp);
    return tx;
  },
});

// ---- Alpenglow 判定 ----

export type AlpenglowStatus =
  | { kind: "alpenglow"; genesisSlot: number }
  | { kind: "legacy" }
  | { kind: "unknown"; reason: Msg };

export async function fetchAlpenglowStatus(): Promise<AlpenglowStatus> {
  try {
    const res = await rpcFetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAgGenesisCert" }),
      signal: AbortSignal.timeout(GENESIS_CERT_TIMEOUT_MS),
    });
    if (!res.ok) return { kind: "unknown", reason: msg("rpc.http", { status: res.status }) };
    const body = (await res.json()) as {
      result?: { block?: { slot?: unknown } } | null;
      error?: { code: number; message: string };
    };
    if (body.error) {
      const reason =
        body.error.code === -32601 ? msg("rpc.methodMissing") : msg("rpc.error", { code: body.error.code });
      return { kind: "unknown", reason };
    }
    if (body.result === null) return { kind: "legacy" };
    const slot = body.result?.block?.slot;
    if (typeof slot === "number") return { kind: "alpenglow", genesisSlot: slot };
    return { kind: "unknown", reason: msg("rpc.unexpected") };
  } catch (e) {
    return { kind: "unknown", reason: msg("rpc.network", { error: e instanceof Error ? e.message : String(e) }) };
  }
}

// ---- 鍵 ----

/** base58 の秘密鍵、または solana-keygen の JSON 配列を受け付ける。 */
export function parseSecretKey(text: string): Keypair {
  const trimmed = text.trim();
  let bytes: Uint8Array;
  try {
    bytes = trimmed.startsWith("[")
      ? Uint8Array.from(JSON.parse(trimmed) as number[])
      : bs58.decode(trimmed);
  } catch {
    throw new KeyedError("err.keyFormat");
  }
  if (bytes.length !== 64) throw new KeyedError("err.keyLength");
  return Keypair.fromSecretKey(bytes);
}

export async function airdropTo(pubkey: PublicKey): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, AIRDROP_LAMPORTS);
  const result = await waitForSignature(sig, 30000, 500);
  if (result.error) throw new Error(result.error);
  if (result.finalizedMs === null) throw new KeyedError("err.airdropUnconfirmed");
}

/**
 * お試し用の faucet（/api/fund）から devnet SOL を受け取り、finalized まで待つ。
 * 残高がすでに十分なら（409）何もしない。公開 faucet は 429 が多いので、こちらを先に使う。
 */
export async function fundAddress(pubkey: PublicKey): Promise<void> {
  const res = await fetch("/api/fund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: pubkey.toBase58() }),
  });
  if (res.status === 409) return;
  if (!res.ok) throw new KeyedError("err.fundFailed", { status: res.status });
  const { signature } = (await res.json()) as { signature: string };
  const result = await waitForSignature(signature, 30000, 500);
  if (result.error) throw new Error(result.error);
  if (result.finalizedMs === null) throw new KeyedError("err.airdropUnconfirmed");
}

// ---- プログラム ----

function walletFor(signer?: Keypair): Wallet {
  const fail = async (): Promise<never> => {
    throw new Error("署名者がいない");
  };
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (!signer) throw new Error("署名者がいない");
    if (tx instanceof VersionedTransaction) tx.sign([signer]);
    else tx.partialSign(signer);
    return tx;
  };
  return {
    publicKey: signer?.publicKey ?? PublicKey.default,
    signTransaction: signer ? async (tx) => sign(tx) : fail,
    signAllTransactions: signer ? async (txs) => txs.map(sign) : fail,
  } as Wallet;
}

const readonlyProgram = new Program<Sokketsu>(
  idl as Sokketsu,
  new AnchorProvider(connection, walletFor(), { commitment: "finalized" }),
);

export async function stateHashOf(task: string): Promise<number[]> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(task));
  return [...new Uint8Array(digest)];
}

export function escrowAddress(payer: PublicKey, stateHash: number[]): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("escrow"), payer.toBytes(), Uint8Array.from(stateHash)],
    PROGRAM_ID,
  )[0];
}

export type EscrowView = {
  payee: string;
  amount: number;
  decision: number;
  probabilityBps: number;
  status: number;
  deadlineSlot: number;
};

export async function fetchEscrow(address: PublicKey): Promise<EscrowView | null> {
  const e = await readonlyProgram.account.escrow.fetchNullable(address);
  if (!e) return null;
  return {
    payee: e.payee.toBase58(),
    amount: e.amount.toNumber(),
    decision: e.decision,
    probabilityBps: e.probabilityBps,
    status: e.status,
    deadlineSlot: e.deadlineSlot.toNumber(),
  };
}

export const getBalance = (key: PublicKey): Promise<number> => connection.getBalance(key);
export const getSlot = (): Promise<number> => connection.getSlot();

/** 預け入れ。operator は、モックの判断を発注者の代わりに settle してよい鍵（ブラウザ内の操作鍵）。 */
export async function depositIx(
  payer: PublicKey,
  payee: PublicKey,
  stateHash: number[],
  operator: PublicKey,
): Promise<TransactionInstruction> {
  return readonlyProgram.methods
    .deposit(new BN(DEPOSIT_LAMPORTS), stateHash, new BN(DEADLINE_SLOTS), operator)
    .accountsPartial({
      payer,
      payee,
      escrow: escrowAddress(payer, stateHash),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// プログラム（lib.rs の decision_message）と同じ並び: prefix || escrow || state_hash || decision || bps(LE) || source
const DECISION_MESSAGE_PREFIX = new TextEncoder().encode("sokketsu-decision-v3");

export function decisionMessage(
  escrow: PublicKey,
  stateHash: number[],
  decision: DecisionName,
  bps: number,
  source: SourceName,
): Uint8Array {
  const n = DECISION_MESSAGE_PREFIX.length;
  const message = new Uint8Array(n + 32 + 32 + 1 + 2 + 1);
  message.set(DECISION_MESSAGE_PREFIX, 0);
  message.set(escrow.toBytes(), n);
  message.set(stateHash, n + 32);
  message[n + 64] = DECISION_CODE[decision];
  new DataView(message.buffer).setUint16(n + 65, bps, true);
  message[n + 67] = SOURCE_CODE[source];
  return message;
}

/** 長さの決まった hex を読む。形式が違えば「署名が無い」扱いで止める。 */
function hexToBytes(hex: string, bytes: number): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "i").test(hex)) throw new KeyedError("err.decisionUnsigned");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

/**
 * settle の命令列: [オラクル署名の Ed25519 検証命令, settle]。
 * プログラムは直前の Ed25519 命令を読み、オラクルの公開鍵と判断（出所を含む）が一致しなければ拒否する。
 * submitter は取引に署名して出す鍵。Jev の判断なら誰でもよく、モックなら発注者か操作鍵でなければ拒否される。
 */
export async function settleIxs(
  submitter: PublicKey,
  payer: PublicKey,
  payee: PublicKey,
  escrow: PublicKey,
  stateHash: number[],
  judgement: JudgeOutput,
): Promise<TransactionInstruction[]> {
  const { proof } = judgement;
  if (!proof) throw new KeyedError("err.decisionUnsigned");
  const verify = Ed25519Program.createInstructionWithPublicKey({
    publicKey: hexToBytes(proof.publicKey, 32),
    message: decisionMessage(escrow, stateHash, judgement.decision, proof.bps, judgement.source),
    signature: hexToBytes(proof.signature, 64),
  });
  const settle = await readonlyProgram.methods
    .settle(DECISION_CODE[judgement.decision], proof.bps, SOURCE_CODE[judgement.source])
    .accountsPartial({ submitter, payer, payee, escrow, instructions: SYSVAR_INSTRUCTIONS_PUBKEY })
    .instruction();
  return [verify, settle];
}

/** refund / close は誰が出してもよい（戻り先は escrow の payer に固定）。payer は戻り先の指定で、署名は要らない。 */
export async function refundIx(payer: PublicKey, escrow: PublicKey): Promise<TransactionInstruction> {
  return readonlyProgram.methods.refund().accountsPartial({ payer, escrow }).instruction();
}

export async function closeIx(payer: PublicKey, escrow: PublicKey): Promise<TransactionInstruction> {
  return readonlyProgram.methods.close().accountsPartial({ payer, escrow }).instruction();
}

export type SweepResult = { refunded: number; closed: number; waiting: number; failed: number };

/**
 * この発注者の escrow を回収する。
 * 期限切れの open は refund + close、終わったもの（settled / refunded）は close でレントごと戻す。
 * 期限前の open は触らない（waiting に数える）。refund / close は誰が出してもよいので、submitter は
 * 発注者でなくてよい（操作鍵が手数料を払い、資金とレントは発注者に戻る）。
 */
export async function sweepEscrows(submitter: TxSigner, payer: PublicKey): Promise<SweepResult> {
  const PAYER_OFFSET = 8; // discriminator の直後が payer
  const [accounts, slot] = await Promise.all([
    readonlyProgram.account.escrow.all([
      { memcmp: { offset: PAYER_OFFSET, bytes: payer.toBase58() } },
      // 旧レイアウト（operator / source が無い）の口座は読めないので、今の大きさのものだけを対象にする。
      { dataSize: readonlyProgram.account.escrow.size },
    ]),
    connection.getSlot(),
  ]);
  const result: SweepResult = { refunded: 0, closed: 0, waiting: 0, failed: 0 };
  let sent = 0;
  for (const { publicKey: escrow, account } of accounts) {
    const open = account.status === 0;
    const expired = slot >= account.deadlineSlot.toNumber();
    if (open && !expired) {
      result.waiting += 1;
      continue;
    }
    // 連続送信で公開 RPC の 429 に当たらないよう間を空ける。1 件の失敗では止めない。
    if (sent++ > 0) await sleep(SWEEP_GAP_MS);
    try {
      const ixs = open
        ? [await refundIx(payer, escrow), await closeIx(payer, escrow)]
        : [await closeIx(payer, escrow)];
      const m = await sendSetup(submitter, ixs);
      if (m.error || m.finalizedMs === null) {
        result.failed += 1;
      } else {
        if (open) result.refunded += 1;
        result.closed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

// ---- 送信と計測 ----

export type Measurement = {
  signature: string;
  processedMs: number | null;
  finalizedMs: number | null;
  error: string | null;
  rateLimited: boolean; // 計測中に公開 RPC の 429 に当たった（値は上振れしうる）
};

const RATE_LIMIT_BACKOFF_MS = 300;
const isRateLimited = (e: unknown) => String(e instanceof Error ? e.message : e).includes("429");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * getSignatureStatuses を intervalMs 間隔で呼び、processed / finalized を観測した時刻を返す。
 * timeoutMs で打ち切る（finalizedMs が null なら未確定）。
 */
async function waitForSignature(
  signature: string,
  timeoutMs: number,
  intervalMs: number,
  t0 = performance.now(),
): Promise<Measurement> {
  let processedMs: number | null = null;
  let rateLimited = false;
  while (performance.now() - t0 < timeoutMs) {
    const pollStart = performance.now();
    let status;
    try {
      status = (await measureConnection.getSignatureStatuses([signature])).value[0];
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      // 429 はこの回を「不明」として次へ。打ち切り時間は守る。
      rateLimited = true;
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
    const elapsed = performance.now() - t0;
    if (status?.err) {
      return { signature, processedMs, finalizedMs: null, error: JSON.stringify(status.err), rateLimited };
    }
    if (status && processedMs === null) processedMs = elapsed;
    if (status?.confirmationStatus === "finalized") {
      return { signature, processedMs, finalizedMs: elapsed, error: null, rateLimited };
    }
    await sleep(Math.max(0, intervalMs - (performance.now() - pollStart)));
  }
  return { signature, processedMs, finalizedMs: null, error: null, rateLimited };
}

/**
 * 署名済み取引を sendRawTransaction 直前から計測する。
 * 主: WebSocket の signatureSubscribe（push・呼び出し回数制限に当たらない）。送信前に購読しておく。
 * 予備: getSignatureStatuses を intervalMs 間隔で。通知が来たら待ちを打ち切る。
 * timeoutMs で打ち切る（finalizedMs が null なら未確定）。
 */
export async function sendAndMeasure(
  signer: TxSigner,
  instructions: TransactionInstruction[],
  timeoutMs = MEASURE_TIMEOUT_MS,
  onSent?: (t0: number) => void,
  intervalMs = MEASURE_INTERVAL_MS,
  retrySend = false,
): Promise<Measurement> {
  // finalized の blockhash は公開 RPC の遅れで期限切れに近づくので confirmed で取る。
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: signer.publicKey, recentBlockhash: blockhash }).add(
    ...instructions,
  );
  // ウォレットの承認待ちは計測に含めない（t0 は署名のあと）。
  const signed = await signer.signTransaction(tx);
  const signature = bs58.encode(signed.signature!);
  const raw = signed.serialize();

  // 観測した絶対時刻。最初に観測した値だけを残す。
  const seen = {
    processed: null as number | null,
    finalized: null as number | null,
    error: null as string | null,
    rateLimited: false,
  };
  let wake = () => {};
  const observe = (finalized: boolean, err: unknown) => {
    const now = performance.now();
    seen.processed ??= now;
    if (finalized) seen.finalized ??= now;
    if (err) seen.error ??= JSON.stringify(err);
    wake();
  };
  // 通知を 1 回受けた購読は web3.js が自動で解除するので、受けていないものだけ後で解除する。
  const subs = (["processed", "finalized"] as const).map((commitment) => {
    const sub = { id: 0, fired: false };
    sub.id = measureConnection.onSignature(
      signature,
      (r) => {
        sub.fired = true;
        observe(commitment === "finalized", r.err);
      },
      commitment,
    );
    return sub;
  });

  const t0 = performance.now();
  onSent?.(t0);
  try {
    // 計測する送金はリトライ無しで送る（自動リトライの待ちが計測の 3 秒枠に入らないように）。
    // 計測しない準備用の取引は、429 を自動リトライで吸収してよい。
    try {
      await (retrySend ? connection : measureConnection).sendRawTransaction(raw, { skipPreflight: true });
    } catch (e) {
      if (isRateLimited(e)) throw new KeyedError("err.rateLimitedSend");
      throw e;
    }
    while (performance.now() - t0 < timeoutMs && seen.finalized === null && seen.error === null) {
      try {
        const status = (await measureConnection.getSignatureStatuses([signature])).value[0];
        if (status) observe(status.confirmationStatus === "finalized", status.err);
      } catch (e) {
        // ポーリングは予備。失敗しても WebSocket の通知を待ち続ける。
        if (isRateLimited(e)) seen.rateLimited = true;
      }
      if (seen.finalized !== null || seen.error !== null) break;
      const remaining = timeoutMs - (performance.now() - t0);
      await new Promise<void>((resolve) => {
        wake = resolve;
        setTimeout(resolve, Math.max(0, Math.min(intervalMs, remaining)));
      });
    }
  } finally {
    for (const sub of subs) {
      if (!sub.fired) measureConnection.removeSignatureListener(sub.id).catch(() => undefined);
    }
  }

  const since = (at: number | null) => (at === null || at - t0 > timeoutMs ? null : at - t0);
  return {
    signature,
    processedMs: since(seen.processed),
    finalizedMs: seen.error ? null : since(seen.finalized),
    error: seen.error,
    rateLimited: seen.rateLimited,
  };
}

/** 計測を表示しない準備用の取引（deposit / hold の記録）。ポーリングは粗くする。 */
export const sendSetup = (signer: TxSigner, instructions: TransactionInstruction[]) =>
  sendAndMeasure(signer, instructions, SETUP_TIMEOUT_MS, undefined, SETUP_INTERVAL_MS, true);

/** slot を WebSocket で購読する（ポーリングしない）。解除関数を返す。 */
export function subscribeSlots(onSlot: (slot: number) => void): () => void {
  const id = measureConnection.onSlotChange((info) => onSlot(info.slot));
  return () => {
    measureConnection.removeSlotChangeListener(id).catch(() => undefined);
  };
}

/** 発注者から操作鍵へ手数料ぶんを送る命令（預け入れと同じ取引に入れ、承認を 1 回で済ませる）。 */
export const topUpIx = (from: PublicKey, to: PublicKey, lamports: number): TransactionInstruction =>
  SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports });
