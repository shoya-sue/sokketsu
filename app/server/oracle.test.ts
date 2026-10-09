import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { DECISION_CODE, SOURCE_CODE, decisionMessage, fromHex, pubkeyBytes, signDecision, toBps } from "./oracle";
import { decisionMessage as clientDecisionMessage, stateHashOf } from "../src/chain";

const SEED = new Uint8Array(32).fill(9);
const SEED_HEX = Buffer.from(SEED).toString("hex");
const ESCROW = "Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp";

describe("decisionMessage", () => {
  it("prefix(20) || escrow(32) || sha256(依頼文)(32) || decision(1) || bps LE(2) || source(1) の 88 バイト", async () => {
    const m = await decisionMessage(ESCROW, "hold: wait", "hold", 9100, "mock");
    expect(m).toHaveLength(88);
    expect(Buffer.from(m.slice(0, 20)).toString()).toBe("sokketsu-decision-v3");
    expect([...m.slice(20, 52)]).toEqual([...new PublicKey(ESCROW).toBytes()]);
    expect([...m.slice(52, 84)]).toEqual(await stateHashOf("hold: wait"));
    expect(m[84]).toBe(DECISION_CODE.hold);
    expect(m[85] | (m[86] << 8)).toBe(9100);
    expect(m[87]).toBe(SOURCE_CODE.mock);
  });

  it("出所の符号はプログラムの SOURCE_JEV=1 / SOURCE_MOCK=2 と同じ", () =>
    expect(SOURCE_CODE).toEqual({ jev: 1, mock: 2 }));

  it("escrow が 32 バイトの公開鍵でなければ例外", async () => {
    expect(() => pubkeyBytes("abc")).toThrow("32 bytes");
    await expect(decisionMessage("0OIl", "x", "release", 8600, "jev")).rejects.toThrow();
  });

  it.each(["jev", "mock"] as const)("クライアント（chain.ts）の組み立てとバイト単位で一致する（%s）", async (source) => {
    const task = "release: delivered the devnet ping report; payer verified and approved #ab12";
    const server = await decisionMessage(ESCROW, task, "release", 8600, source);
    const client = clientDecisionMessage(new PublicKey(ESCROW), await stateHashOf(task), "release", 8600, source);
    expect([...server]).toEqual([...client]);
  });
});

describe("signDecision", () => {
  it("署名はオラクル公開鍵で検証でき、公開鍵は Solana の Keypair.fromSeed と一致する", async () => {
    const proof = await signDecision(SEED_HEX, ESCROW, "hold: wait", "hold", 0.91, "jev");
    expect(proof.bps).toBe(9100);
    expect(proof.publicKey).toBe(Buffer.from(Keypair.fromSeed(SEED).publicKey.toBytes()).toString("hex"));
    const key = await crypto.subtle.importKey("raw", fromHex(proof.publicKey), { name: "Ed25519" }, false, [
      "verify",
    ]);
    const ok = await crypto.subtle.verify(
      "Ed25519",
      key,
      fromHex(proof.signature),
      await decisionMessage(ESCROW, "hold: wait", "hold", 9100, "jev"),
    );
    expect(ok).toBe(true);
  });

  it("別の判断・別の出所のメッセージでは検証に失敗する", async () => {
    const proof = await signDecision(SEED_HEX, ESCROW, "hold: wait", "hold", 0.91, "mock");
    const key = await crypto.subtle.importKey("raw", fromHex(proof.publicKey), { name: "Ed25519" }, false, [
      "verify",
    ]);
    const sig = fromHex(proof.signature);
    const verify = (m: Uint8Array) => crypto.subtle.verify("Ed25519", key, sig, m);
    expect(await verify(await decisionMessage(ESCROW, "hold: wait", "hold", 9100, "mock"))).toBe(true);
    expect(await verify(await decisionMessage(ESCROW, "hold: wait", "release", 9100, "mock"))).toBe(false);
    expect(await verify(await decisionMessage(ESCROW, "hold: wait", "hold", 9100, "jev"))).toBe(false);
  });

  it("前後の空白は無視する", async () => {
    const a = await signDecision(`  ${SEED_HEX}\n`, ESCROW, "x", "release", 0.86, "jev");
    const b = await signDecision(SEED_HEX, ESCROW, "x", "release", 0.86, "jev");
    expect(a).toEqual(b);
  });

  it("seed が 32 バイトでなければ例外", async () => {
    await expect(signDecision("abcd", ESCROW, "x", "release", 0.86, "jev")).rejects.toThrow("32 bytes");
  });

  it("hex でなければ例外", async () => {
    await expect(signDecision("zz".repeat(32), ESCROW, "x", "release", 0.86, "jev")).rejects.toThrow("invalid hex");
  });

  it("toBps は四捨五入", () => expect(toBps(0.86)).toBe(8600));
});
