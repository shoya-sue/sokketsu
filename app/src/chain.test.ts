import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { PROGRAM_ID, escrowAddress, parseSecretKey, stateHashOf } from "./chain";

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
