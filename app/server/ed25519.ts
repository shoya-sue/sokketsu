/// <reference types="@cloudflare/workers-types" />

// Ed25519 秘密鍵（32 バイトの seed）を PKCS#8 で包むための固定ヘッダ
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new Error("invalid hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

// atob は Web 標準（forgiving-base64）で「=」の補完が要らないので、URL 用の文字だけ戻す。
function fromBase64Url(text: string): Uint8Array {
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export type Ed25519Signer = { publicKey: Uint8Array; sign: (message: Uint8Array) => Promise<Uint8Array> };

/** 32 バイトの seed（hex・前後の空白は無視）から、WebCrypto の Ed25519 署名者を作る。 */
export async function ed25519FromSeedHex(seedHex: string): Promise<Ed25519Signer> {
  const seed = fromHex(seedHex.trim());
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + 32);
  pkcs8.set(PKCS8_ED25519_PREFIX, 0);
  pkcs8.set(seed, PKCS8_ED25519_PREFIX.length);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
  return {
    // Stryker disable next-line StringLiteral: Ed25519 の JWK は必ず x を持つ（?? は型のためだけ）
    publicKey: fromBase64Url(jwk.x ?? ""),
    sign: async (message) => new Uint8Array(await crypto.subtle.sign("Ed25519", key, message)),
  };
}
