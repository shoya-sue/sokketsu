import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { signedTransfer, transferMessage } from "./transfer";

const SEED = new Uint8Array(32).fill(7);
const SEED_HEX = Buffer.from(SEED).toString("hex");
const FROM = Keypair.fromSeed(SEED);
const TO = new PublicKey("CgKtt9XQ9ydTtPXkm691r3aDVhiHD95juD5854x4FGkk");
const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";

const web3Tx = (lamports: number) =>
  new Transaction({ feePayer: FROM.publicKey, recentBlockhash: BLOCKHASH }).add(
    SystemProgram.transfer({ fromPubkey: FROM.publicKey, toPubkey: TO, lamports }),
  );

describe("transferMessage", () => {
  it("web3.js の SystemProgram.transfer とバイト単位で一致する", () => {
    const ours = transferMessage(FROM.publicKey.toBytes(), TO.toBytes(), 120_000_000, BLOCKHASH);
    expect([...ours]).toEqual([...web3Tx(120_000_000).serializeMessage()]);
  });

  it("送り先と送り元が同じなら例外（このアプリでは使わない形）", () =>
    expect(() => transferMessage(FROM.publicKey.toBytes(), FROM.publicKey.toBytes(), 1, BLOCKHASH)).toThrow());
});

describe("signedTransfer", () => {
  it("web3.js で読み戻せて、送り元の署名が検証に通る", async () => {
    const { base64, signature } = await signedTransfer(SEED_HEX, TO.toBase58(), 120_000_000, BLOCKHASH);
    const tx = Transaction.from(Buffer.from(base64, "base64"));
    expect(tx.verifySignatures()).toBe(true);
    expect(tx.feePayer?.toBase58()).toBe(FROM.publicKey.toBase58());
    // Ed25519 の署名は決定的なので、web3.js で同じ鍵から作った署名と一致する
    const expected = web3Tx(120_000_000);
    expected.sign(FROM);
    expect(Buffer.from(tx.signature!).toString("hex")).toBe(Buffer.from(expected.signature!).toString("hex"));
    expect(signature).toBe(bs58.encode(expected.signature!));
    const ix = SystemProgram.transfer({ fromPubkey: FROM.publicKey, toPubkey: TO, lamports: 120_000_000 });
    expect(tx.instructions[0].data).toEqual(ix.data);
    expect(tx.instructions[0].keys.map((k) => k.pubkey.toBase58())).toEqual([FROM.publicKey.toBase58(), TO.toBase58()]);
  });

  it("送り先が base58 の公開鍵でなければ例外", async () =>
    expect(signedTransfer(SEED_HEX, "not-a-key", 1, BLOCKHASH)).rejects.toThrow());
});
