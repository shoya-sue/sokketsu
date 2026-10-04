import { Keypair } from "@solana/web3.js";

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
