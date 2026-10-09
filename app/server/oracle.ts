/// <reference types="@cloudflare/workers-types" />
import bs58 from "bs58";
import { SOURCE_CODE, type SourceName } from "../src/judge";
import { ed25519FromSeedHex, fromHex, toHex } from "./ed25519";

export { SOURCE_CODE, fromHex, type SourceName };

export type DecisionName = "release" | "hold" | "refund";
export const DECISION_CODE: Record<DecisionName, number> = { release: 1, hold: 2, refund: 3 };

// プログラム（lib.rs の decision_message）と同じ並び: prefix || escrow || sha256(依頼文) || decision || bps(LE) || source
const PREFIX = new TextEncoder().encode("sokketsu-decision-v3");

export type Proof = { bps: number; signature: string; publicKey: string };

export const toBps = (probability: number) => Math.round(probability * 10000);


/** base58 の公開鍵を 32 バイトに。形式が違えば例外。 */
export function pubkeyBytes(base58: string): Uint8Array {
  const bytes = bs58.decode(base58);
  if (bytes.length !== 32) throw new Error("pubkey must be 32 bytes");
  return bytes;
}

export async function decisionMessage(
  escrow: string,
  task: string,
  decision: DecisionName,
  bps: number,
  source: SourceName,
): Promise<Uint8Array> {
  const stateHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(task)));
  const message = new Uint8Array(PREFIX.length + 32 + 32 + 1 + 2 + 1);
  message.set(PREFIX, 0);
  message.set(pubkeyBytes(escrow), PREFIX.length);
  message.set(stateHash, PREFIX.length + 32);
  message[PREFIX.length + 64] = DECISION_CODE[decision];
  new DataView(message.buffer).setUint16(PREFIX.length + 65, bps, true);
  message[PREFIX.length + 67] = SOURCE_CODE[source];
  return message;
}

/** 判断に署名する。seedHex はオラクル秘密鍵の 32 バイト seed（hex）。source は判断の出所（署名に含める）。 */
export async function signDecision(
  seedHex: string,
  escrow: string,
  task: string,
  decision: DecisionName,
  probability: number,
  source: SourceName,
): Promise<Proof> {
  const signer = await ed25519FromSeedHex(seedHex);
  const bps = toBps(probability);
  const message = await decisionMessage(escrow, task, decision, bps, source);
  return { bps, signature: toHex(await signer.sign(message)), publicKey: toHex(signer.publicKey) };
}
