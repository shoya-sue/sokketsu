import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { expect } from "chai";
import { Sokketsu } from "../target/types/sokketsu";

const RELEASE = 1;
const HOLD = 2;
const REFUND = 3;
const STATUS_OPEN = 0;
const STATUS_SETTLED = 1;
const STATUS_REFUNDED = 2;
const AMOUNT = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
const DEADLINE_SLOTS = new anchor.BN(400);

// ローカルテスト用のオラクル（feature "localnet-oracle" のプログラムに埋め込まれた公開鍵と対）。
const ORACLE = Keypair.fromSeed(new Uint8Array(32).fill(9));
const DECISION_MESSAGE_PREFIX = Buffer.from("sokketsu-decision-v2");

const decisionMessage = (escrow: PublicKey, stateHash: number[], decision: number, bps: number): Buffer => {
  const bpsLe = Buffer.alloc(2);
  bpsLe.writeUInt16LE(bps);
  return Buffer.concat([
    DECISION_MESSAGE_PREFIX,
    escrow.toBuffer(),
    Buffer.from(stateHash),
    Buffer.from([decision]),
    bpsLe,
  ]);
};

const oracleIx = (
  escrow: PublicKey,
  stateHash: number[],
  decision: number,
  bps: number,
  signer = ORACLE,
): TransactionInstruction =>
  Ed25519Program.createInstructionWithPrivateKey({
    privateKey: signer.secretKey,
    message: decisionMessage(escrow, stateHash, decision, bps),
  });

describe("sokketsu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.sokketsu as Program<Sokketsu>;
  const payer = provider.wallet.publicKey;

  const hashOf = (task: string): number[] => [...createHash("sha256").update(task).digest()];

  const escrowPda = (stateHash: number[]): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), payer.toBuffer(), Buffer.from(stateHash)],
      program.programId,
    )[0];

  const balance = (key: PublicKey) => provider.connection.getBalance(key);

  const openEscrow = async (task: string) => {
    const payee = Keypair.generate().publicKey;
    const stateHash = hashOf(task);
    await program.methods
      .deposit(AMOUNT, stateHash, DEADLINE_SLOTS)
      .accountsPartial({ payer, payee })
      .rpc();
    return { payee, stateHash, escrow: escrowPda(stateHash) };
  };

  /** オラクル署名つきで settle する（署名を付けない・別の判断に署名する、も指定できる）。 */
  const settle = (
    e: { payee: PublicKey; stateHash: number[]; escrow: PublicKey },
    decision: number,
    bps: number,
    opts: { signed?: { decision: number; bps: number; signer?: Keypair; escrow?: PublicKey } | null } = {},
  ) => {
    const signed = opts.signed === undefined ? { decision, bps } : opts.signed;
    const pre = signed
      ? [oracleIx(signed.escrow ?? e.escrow, e.stateHash, signed.decision, signed.bps, signed.signer)]
      : [];
    return program.methods
      .settle(decision, bps)
      .accountsPartial({ payer, payee: e.payee, escrow: e.escrow })
      .preInstructions(pre);
  };

  const expectError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
      expect.fail(`${code} で失敗するはず`);
    } catch (e) {
      expect(String(e)).to.contain(code);
    }
  };

  it("deposit すると escrow 残高が amount + レント分増える", async () => {
    const { escrow } = await openEscrow("deposit test");
    const rent = await provider.connection.getMinimumBalanceForRentExemption(program.account.escrow.size);
    expect(await balance(escrow)).to.equal(AMOUNT.toNumber() + rent);
  });

  it("release / 7000（オラクル署名つき）で payee が増え status が settled", async () => {
    const e = await openEscrow("release 7000");
    await settle(e, RELEASE, 7000).rpc();
    expect(await balance(e.payee)).to.equal(AMOUNT.toNumber());
    const state = await program.account.escrow.fetch(e.escrow);
    expect(state.status).to.equal(STATUS_SETTLED);
  });

  it("release / 6999 では残高が動かず status は open のまま", async () => {
    const e = await openEscrow("release 6999");
    const before = await balance(e.escrow);
    await settle(e, RELEASE, 6999).rpc();
    expect(await balance(e.escrow)).to.equal(before);
    expect(await balance(e.payee)).to.equal(0);
    const state = await program.account.escrow.fetch(e.escrow);
    expect(state.status).to.equal(STATUS_OPEN);
  });

  it("hold は送金せず再判断できない。refund は期限前に失敗し、refund 判断後なら戻る", async () => {
    const held = await openEscrow("hold: wait");
    const before = await balance(held.escrow);
    await settle(held, HOLD, 9100).rpc();
    expect(await balance(held.escrow)).to.equal(before);
    expect(await balance(held.payee)).to.equal(0);
    await expectError(settle(held, RELEASE, 9000).rpc(), "AlreadyDecided");
    await expectError(
      program.methods.refund().accountsPartial({ payer, escrow: held.escrow }).rpc(),
      "RefundNotAllowed",
    );

    const refunded = await openEscrow("refund: cancel");
    const payerBefore = await balance(payer);
    await settle(refunded, REFUND, 7000)
      .postInstructions([
        await program.methods.refund().accountsPartial({ payer, escrow: refunded.escrow }).instruction(),
      ])
      .rpc();
    const state = await program.account.escrow.fetch(refunded.escrow);
    expect(state.status).to.equal(STATUS_REFUNDED);
    // 手数料を差し引いても預かり金分は戻っている
    expect(await balance(payer)).to.be.greaterThan(payerBefore + AMOUNT.toNumber() - 0.001 * LAMPORTS_PER_SOL);
  });

  it("オラクルの署名が無い settle は MissingOracleSignature", async () => {
    const e = await openEscrow("unsigned");
    await expectError(settle(e, RELEASE, 9000, { signed: null }).rpc(), "MissingOracleSignature");
    expect(await balance(e.payee)).to.equal(0);
  });

  it("オラクル以外の鍵で署名した判断は BadOracleSignature", async () => {
    const e = await openEscrow("forged signer");
    const forger = Keypair.generate();
    await expectError(
      settle(e, RELEASE, 9000, { signed: { decision: RELEASE, bps: 9000, signer: forger } }).rpc(),
      "BadOracleSignature",
    );
    expect(await balance(e.payee)).to.equal(0);
  });

  it("別の escrow 用の署名を使い回すと BadOracleSignature（同じ依頼文でも）", async () => {
    const e = await openEscrow("replay target");
    const other = Keypair.generate().publicKey;
    await expectError(
      settle(e, RELEASE, 9000, { signed: { decision: RELEASE, bps: 9000, escrow: other } }).rpc(),
      "BadOracleSignature",
    );
    expect(await balance(e.payee)).to.equal(0);
  });

  it("hold と署名された判断を release に書き換えると BadOracleSignature", async () => {
    const e = await openEscrow("hold: tamper");
    await expectError(
      settle(e, RELEASE, 9100, { signed: { decision: HOLD, bps: 9100 } }).rpc(),
      "BadOracleSignature",
    );
    // 確率だけの書き換えも拒否される
    await expectError(
      settle(e, RELEASE, 9900, { signed: { decision: RELEASE, bps: 9100 } }).rpc(),
      "BadOracleSignature",
    );
    expect(await balance(e.payee)).to.equal(0);
    const state = await program.account.escrow.fetch(e.escrow);
    expect(state.decision).to.equal(0);
  });
});
