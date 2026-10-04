# 即決エスクロー Sokketsu

> **Stop agent payments with typed decisions, not generated text — and measure finality on Alpenglow devnet.**
> A payer escrows SOL in a PDA vault. A judge (Jev, with a mock fallback) returns `release` / `hold` / `refund` with a probability. The decision is ed25519-signed by an oracle and **verified on-chain**; the program only moves funds when the signed decision meets the 70% threshold. The page measures milliseconds to `finalized` live.

- Live: https://sokketsu.pages.dev
- Program (devnet): `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`
- 仕様（正本）: [`sokketsu-spec.md`](./sokketsu-spec.md)

## 何ができるか

| | |
|---|---|
| 操作は 2 つだけ | 発注者の鍵を貼る → 「▶ デモを流す」。hold で止まる → release で即決、が自動で流れる |
| 型付き判断 | Jev（`typesafe-ai/jev`）が choice + 確率だけを返す。使えないときはサーバ側のモック |
| オンチェーン署名検証 | オラクル（Pages Function）が判断に署名し、`settle` が Ed25519 検証命令を照合。署名なし・書き換え・別 escrow への使い回しは `MissingOracleSignature` / `BadOracleSignature` で拒否 |
| 確定の実測 | WebSocket の `signatureSubscribe` で processed / finalized を受け、Tower BFT（約 12.8 秒）と比べる |
| ゲームの手触り | レベル・スコア・コンボ・S〜C ランク・実績 7 種・紙吹雪・効果音（ミュート可） |
| 見せ方 | 発注者 → 金庫 PDA → 受注者 をコインが流れる舞台、直近 5 件と中央値、日本語 / English |
| 止まらない工夫 | 公開 RPC の 429 対策、障害時だけ使う予備 RPC、期限切れ escrow の回収 |

## 仕組み

```
ブラウザ ──(依頼文)──▶ /api/judge（Jev）または /api/decide（モック）
                         └ 判断を ed25519 で署名: "sokketsu-decision-v2" ‖ escrow ‖ sha256(依頼文) ‖ decision ‖ bps
ブラウザ ──[Ed25519 検証命令, settle]──▶ sokketsu プログラム（devnet）
                         └ 直前の命令の公開鍵 = ORACLE_PUBKEY、メッセージ = この escrow・state_hash・判断 を照合
                         └ release かつ 7000 bps 以上のときだけ受注者へ送金
```

## リポジトリ構成

```
programs/sokketsu/src/lib.rs   Anchor プログラム（deposit / settle / refund / close + オラクル署名検証）
tests/sokketsu.ts              anchor test（8 本）
app/src                        React + Vite のフロント（App / components / lib / i18n）
app/functions/api              Pages Functions（judge / decide / rpc）
app/server                     Function 共通（auth / oracle / judgeInput）
```

## 開発

Xcode 本体は不要（Command Line Tools で足りる）。秘密鍵は `.keys/`（git 管理外）に置く。

```bash
# プログラム: テスト（テスト用オラクル鍵でビルド）
export DEVELOPER_DIR=/Library/Developer/CommandLineTools   # DEVELOPER_DIR が Xcode.app を指す環境のみ
npm install
anchor build -- --features localnet-oracle && anchor test --skip-build

# プログラム: devnet へ（本番のオラクル鍵でビルドし直す）
touch programs/sokketsu/src/lib.rs && anchor build
anchor deploy --provider.cluster devnet
cp target/idl/sokketsu.json target/types/sokketsu.ts app/src/idl/

# フロント
cd app && npm install
npm test               # vitest（判断・計算・API 層。カバレッジ閾値 80%）
npm run dev            # Vite のみ（Function は無く、判断は署名なしになる）
npm run dev:cf         # Pages Function 込み。app/.dev.vars に secret を書く
CLOUDFLARE_ACCOUNT_ID=<your-account-id> npm run deploy
```

### Pages の secret

| 名前 | 用途 | 必須 |
|---|---|---|
| `ORACLE_SECRET_KEY` | オラクルの ed25519 seed（32 バイト hex）。公開鍵は `lib.rs` の `ORACLE_PUBKEY` と対 | ○ |
| `DEMO_TOKEN` | `/api/judge`・`/api/rpc` を使うためのトークン（画面の ⚙ に入れる） | ○ |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway（`vck_…`）か TypeSafe のキー。Gateway → 拒否されたら TypeSafe 直、の順で試す | 任意 |
| `HELIUS_RPC_URL` | 公開 RPC の障害時だけ使う予備の devnet RPC | 任意 |

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> npx wrangler pages secret put <NAME> --project-name sokketsu
```

`CLOUDFLARE_ACCOUNT_ID` をシェルで別アカウントに固定していると、Pages の操作が認証エラーになる。コマンドの前で上書きする。

## デモ台本

1. 証明書と、動き続ける slot を見せ、「この devnet は Alpenglow」と言う。
2. 鍵を貼って「▶ デモを流す」。hold で金庫に錠が掛かり、受注者の残高が動かないことを見せる。
3. カウントダウンのあと release が走り、コインが受注者へ流れて、finalized ミリ秒・倍率・ランクが出る。
4. 「Tower BFT なら約 12.8 秒。判断も確定もサブ秒。判断はオラクルが署名し、書き換えた取引はプログラムが拒否する」で終える。

## 制約

- devnet 専用。mainnet には接続しない。
- オンチェーンで検証するのは自前のオラクルの署名まで。Jev（モデル提供者）自身の署名は検証しない。
- プログラムは upgrade 可能なまま（ハッカソン中の改修のため）。凍結するなら `solana program set-upgrade-authority Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp --final`（元に戻せない）。
- 貼る鍵は devnet 専用の捨て鍵にする。受注者の鍵は発注者の鍵から導けるので、価値のある鍵は貼らない。
- 画面の finalized ミリ秒は、ブラウザ → 公開 RPC の往復を含む値。
