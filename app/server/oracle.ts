/// <reference types="@cloudflare/workers-types" />
import bs58 from "bs58";

export type DecisionName = "release" | "hold" | "refund";
export const DECISION_CODE: Record<DecisionName, number> = { release: 1, hold: 2, refund: 3 };

// プログラム（lib.rs の decision_message）と同じ並び: prefix || escrow || sha256(依頼文) || decision || bps(LE)
const PREFIX = new TextEncoder().encode("sokketsu-decision-v2");
// Ed25519 秘密鍵（32 バイトの seed）を PKCS#8 で包むための固定ヘッダ
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export type Proof = { bps: number; signature: string; publicKey: string };

export const toBps = (probability: number) => Math.round(probability * 10000);

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error("invalid hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

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
): Promise<Uint8Array> {
  const stateHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(task)));
  const message = new Uint8Array(PREFIX.length + 32 + 32 + 1 + 2);
  message.set(PREFIX, 0);
  message.set(pubkeyBytes(escrow), PREFIX.length);
  message.set(stateHash, PREFIX.length + 32);
  message[PREFIX.length + 64] = DECISION_CODE[decision];
  new DataView(message.buffer).setUint16(PREFIX.length + 65, bps, true);
  return message;
}

/** 判断に署名する。seedHex はオラクル秘密鍵の 32 バイト seed（hex）。 */
export async function signDecision(
  seedHex: string,
  escrow: string,
  task: string,
  decision: DecisionName,
  probability: number,
): Promise<Proof> {
  const seed = fromHex(seedHex.trim());
  if (seed.length !== 32) throw new Error("oracle seed must be 32 bytes");
  const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + 32);
  pkcs8.set(PKCS8_ED25519_PREFIX, 0);
  pkcs8.set(seed, PKCS8_ED25519_PREFIX.length);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  const bps = toBps(probability);
  const message = await decisionMessage(escrow, task, decision, bps);
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", key, message));
  const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
  return { bps, signature: toHex(signature), publicKey: toHex(fromBase64Url(jwk.x ?? "")) };
}
