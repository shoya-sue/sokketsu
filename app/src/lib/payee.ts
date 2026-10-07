import { Keypair, PublicKey } from "@solana/web3.js";

const PAYEE_LABEL = new TextEncoder().encode("sokketsu-payee-v1");

/**
 * 発注者の鍵から受注者の鍵を決定的に導く（seed = sha256(発注者の秘密鍵 || ラベル)）。
 * 同じ発注者ならいつでも同じ受注者になり、残高が積み上がる。発注者の鍵があれば受注者の鍵も作り直せる。
 */
export async function derivePayee(payer: Keypair): Promise<Keypair> {
  const material = new Uint8Array(payer.secretKey.length + PAYEE_LABEL.length);
  material.set(payer.secretKey, 0);
  material.set(PAYEE_LABEL, payer.secretKey.length);
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", material));
  return Keypair.fromSeed(seed);
}

const PAYEE_ADDRESS_LABEL = new TextEncoder().encode("sokketsu-payee-v2");

/**
 * 発注者の公開鍵から受注者のアドレスを決定的に導く（seed = sha256(発注者の公開鍵 || ラベル)）。
 * ウォレットは秘密鍵を読めないので、こちらを使う。公開鍵から誰でも同じ鍵を作れるので、
 * 受注者の口座は devnet のデモ用の受け皿として扱う（価値のある資金は置かない）。
 */
export async function derivePayeeAddress(payer: PublicKey): Promise<PublicKey> {
  const material = new Uint8Array(32 + PAYEE_ADDRESS_LABEL.length);
  material.set(payer.toBytes(), 0);
  material.set(PAYEE_ADDRESS_LABEL, 32);
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", material));
  return Keypair.fromSeed(seed).publicKey;
}
