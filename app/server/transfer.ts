/// <reference types="@cloudflare/workers-types" />
import bs58 from "bs58";
import { ed25519FromSeedHex } from "./ed25519";
import { pubkeyBytes } from "./oracle";

// System Program（11111111111111111111111111111111）と transfer 命令の番号。
const SYSTEM_PROGRAM = new Uint8Array(32);
const TRANSFER_INDEX = 2;

/**
 * SOL の送金 1 件だけを含む legacy 取引のメッセージを組み立てる（web3.js を Workers に持ち込まないため）。
 * 並び: header[署名者 1, 読み取り専用の署名者 0, 読み取り専用の非署名者 1]
 *       || 口座 3 つ [送り元, 送り先, System Program] || 直近の blockhash || 命令 1 つ
 */
export function transferMessage(from: Uint8Array, to: Uint8Array, lamports: number, blockhash: string): Uint8Array {
  if (from.every((b, i) => b === to[i])) throw new Error("from and to must differ");
  const recent = bs58.decode(blockhash);
  if (recent.length !== 32) throw new Error("blockhash must be 32 bytes");
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, TRANSFER_INDEX, true);
  view.setBigUint64(4, BigInt(lamports), true);
  return Uint8Array.from([
    1, 0, 1, // header
    3, ...from, ...to, ...SYSTEM_PROGRAM, // 口座（compact-u16 の 3）
    ...recent,
    1, // 命令の数
    2, // program id = 口座 2（System Program）
    2, 0, 1, // 口座の添字 [送り元, 送り先]
    data.length, ...data,
  ]);
}

/** 送り元の seed で署名した送金取引（base64）と、その署名（base58 = 取引 ID）を返す。 */
export async function signedTransfer(
  seedHex: string,
  to: string,
  lamports: number,
  blockhash: string,
): Promise<{ base64: string; signature: string }> {
  const signer = await ed25519FromSeedHex(seedHex);
  const message = transferMessage(signer.publicKey, pubkeyBytes(to), lamports, blockhash);
  const signature = await signer.sign(message);
  const tx = Uint8Array.from([1, ...signature, ...message]); // 署名の数（compact-u16 の 1）|| 署名 || メッセージ
  return { base64: btoa(String.fromCharCode(...tx)), signature: bs58.encode(signature) };
}
