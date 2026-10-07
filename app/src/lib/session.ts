import type { Keypair } from "@solana/web3.js";
import type { TxSigner } from "../chain";

/**
 * 発注者の操作の担い手。
 * - signer: 預け入れに署名する（ウォレットなら承認ダイアログが出る）
 * - operator: settle / refund / 回収を出す鍵。ウォレットのときはページ内で作った鍵で、承認を 1 回に保つ。
 *   お試し・貼った鍵のときは発注者の鍵そのもの。
 */
export type PayerSession = {
  kind: "wallet" | "trial" | "pasted";
  signer: TxSigner;
  operator: Keypair;
};

// 操作鍵の手数料。settle 1 回は約 0.00001 SOL。口座が消えないようレント免除の下限（約 0.00089 SOL）を割らせない。
export const OPERATOR_MIN_LAMPORTS = 1_000_000;
export const OPERATOR_TARGET_LAMPORTS = 2_000_000;

/** 操作鍵の残高から、預け入れと同じ取引で足す額を決める。足りていれば 0。 */
export const operatorTopUp = (balance: number): number =>
  balance >= OPERATOR_MIN_LAMPORTS ? 0 : OPERATOR_TARGET_LAMPORTS - balance;
