import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { derivePayee, derivePayeeAddress } from "./payee";

describe("derivePayee", () => {
  it("同じ発注者からは常に同じ受注者", async () => {
    const payer = Keypair.generate();
    const a = await derivePayee(payer);
    const b = await derivePayee(Keypair.fromSecretKey(payer.secretKey));
    expect(a.publicKey.equals(b.publicKey)).toBe(true);
  });

  it("発注者が違えば受注者も違う", async () => {
    const a = await derivePayee(Keypair.generate());
    const b = await derivePayee(Keypair.generate());
    expect(a.publicKey.equals(b.publicKey)).toBe(false);
  });

  it("受注者は発注者と別の鍵", async () => {
    const payer = Keypair.generate();
    expect((await derivePayee(payer)).publicKey.equals(payer.publicKey)).toBe(false);
  });

  it("既知の発注者から既知の受注者（導出規則を固定する）", async () => {
    const payer = Keypair.fromSeed(new Uint8Array(32).fill(7));
    const payee = await derivePayee(payer);
    // 規則（sha256(秘密鍵 || "sokketsu-payee-v1") を seed）を変えると、ここが変わる。
    const again = await derivePayee(Keypair.fromSeed(new Uint8Array(32).fill(7)));
    expect(payee.publicKey.toBase58()).toBe(again.publicKey.toBase58());
    expect(payee.publicKey.toBase58()).toMatchInlineSnapshot(`"sh1VLfZBchHfoZbPj2xGveLxHgjn6Xf2ceBFLa72qu5"`);
  });
});

describe("derivePayeeAddress（ウォレット・お試し用。公開鍵から導く）", () => {
  it("同じ発注者なら同じ受注者、別の発注者なら別の受注者", async () => {
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    expect((await derivePayeeAddress(a)).toBase58()).toBe((await derivePayeeAddress(a)).toBase58());
    expect((await derivePayeeAddress(a)).toBase58()).not.toBe((await derivePayeeAddress(b)).toBase58());
  });

  it("発注者自身とは異なるアドレスになる", async () => {
    const a = Keypair.generate().publicKey;
    expect((await derivePayeeAddress(a)).toBase58()).not.toBe(a.toBase58());
  });
});
