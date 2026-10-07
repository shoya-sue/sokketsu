# 即決エスクロー Sokketsu

> **Stop agent payments with typed decisions, not generated text — and measure finality on Alpenglow devnet.**
> A payer escrows SOL in a PDA vault. A judge (Jev, with a mock fallback) returns `release` / `hold` / `refund` with a probability. The decision is ed25519-signed by an oracle and **verified on-chain**; the program only moves funds when the signed decision meets the 70% threshold. The page measures milliseconds to `finalized` live.

- Live: https://sokketsu.pages.dev
- Program (devnet): `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`
- 仕様（正本）: [`sokketsu-spec.md`](./sokketsu-spec.md)

## 何ができるか

| | |
|---|---|
| 操作は 2 つだけ | ウォレットを接続（または「お試し」）→「▶ デモを流す」。hold で止まる → release で即決、が自動で流れる |
| 承認は 1 回 | ウォレットで承認するのは預け入れだけ。settle はページ内の操作鍵が出す。秘密鍵は貼らない（貼る入口は開発者向けに折りたたみ） |
| お試し | ブラウザ内で捨て鍵を作り、自前の faucet（`/api/fund`）から devnet SOL を受け取る |
| 型付き判断 | Jev（`typesafe-ai/jev`）が choice + 確率だけを返す。使えないときはサーバ側のモック |
| オンチェーン署名検証 | オラクル（Pages Function）が判断と**出所（Jev / モック）**に署名し、`settle` が Ed25519 検証命令を照合。署名なし・書き換え・別 escrow への使い回し・出所の書き換えは `MissingOracleSignature` / `BadOracleSignature` で拒否 |
| 誰が執行できるか | Jev の判断は誰が出しても執行される（発注者が止められない）。モックの判断は発注者か登録した操作鍵だけ（`UnauthorizedSubmitter`）。refund / close は誰でも出せ、戻り先は発注者に固定 |
| 確定の実測 | WebSocket の `signatureSubscribe` で processed / finalized を受け、Tower BFT（約 12.8 秒）と比べる |
| ゲームの手触り | レベル・スコア・コンボ・S〜C ランク・実績 7 種・紙吹雪・効果音（ミュート可） |
| 見せ方 | 発注者 → 金庫 PDA → 受注者 をコインが流れる舞台、直近 5 件と中央値、日本語 / English |
| 止まらない工夫 | 公開 RPC の 429 対策、障害時だけ使う予備 RPC、期限切れ escrow の回収 |

## 仕組み

```
ブラウザ ──(依頼文)──▶ /api/judge（Jev）または /api/decide（モック）
                         └ 判断を ed25519 で署名: "sokketsu-decision-v3" ‖ escrow ‖ sha256(依頼文) ‖ decision ‖ bps ‖ source
ウォレット ──[deposit（+ 操作鍵へ手数料）]──▶ sokketsu プログラム   ← 承認はここだけ
操作鍵 ──[Ed25519 検証命令, settle]──▶ sokketsu プログラム（devnet）
                         └ 直前の命令の公開鍵 = ORACLE_PUBKEY、メッセージ = この escrow・state_hash・判断・出所 を照合
                         └ release かつ 7000 bps 以上のときだけ受注者へ送金
```

## リポジトリ構成

```
programs/sokketsu/src/lib.rs   Anchor プログラム（deposit / settle / refund / close + オラクル署名検証）
tests/sokketsu.ts              anchor test（14 本）
app/src                        React + Vite のフロント（App / components / lib / i18n）
app/functions/api              Pages Functions（judge / decide / rpc / fund）
app/server                     Function 共通（auth / oracle / judgeInput / ed25519 / transfer）
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
| `FAUCET_SECRET_KEY` | お試し用 faucet 鍵の ed25519 seed（32 バイト hex）。devnet SOL だけを入れる。1 回 0.12 SOL・残高のあるアドレスには送らない・IP ごとに 10 分 | 任意（無ければお試しは公開 faucet だけ） |

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> npx wrangler pages secret put <NAME> --project-name sokketsu
```

`CLOUDFLARE_ACCOUNT_ID` をシェルで別アカウントに固定していると、Pages の操作が認証エラーになる。コマンドの前で上書きする。

## デモ台本

1. 証明書と、動き続ける slot を見せ、「この devnet は Alpenglow」と言う。
2. ウォレットを接続（または「お試し」）して「▶ デモを流す」。hold で金庫に錠が掛かり、受注者の残高が動かないことを見せる。
3. カウントダウンのあと release が走り、コインが受注者へ流れて、finalized ミリ秒・倍率・ランクが出る。
4. 「Tower BFT なら約 12.8 秒。判断も確定もサブ秒。判断はオラクルが署名し、書き換えた取引はプログラムが拒否する」で終える。

## 制約

- devnet 専用。mainnet には接続しない。
- オンチェーンで検証するのは自前のオラクルの署名まで。Jev（モデル提供者）自身の署名は検証しない。
- プログラムは upgrade 可能なまま（ハッカソン中の改修のため）。凍結するなら `solana program set-upgrade-authority Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp --final`（元に戻せない）。
- 貼る鍵は devnet 専用の捨て鍵にする。受注者の鍵は発注者の鍵（ウォレット・お試しでは公開鍵）から導けるので、受注者の口座はデモ用の受け皿として扱う。
- 操作鍵はページのメモリにだけ置く。再読み込みすると、残った手数料（最大 0.002 SOL）はそのまま残る。
- プログラムを upgrade すると口座のレイアウトが変わることがある。2026-10-07 の upgrade 前に旧い escrow は回収済み。
- 画面の finalized ミリ秒は、ブラウザ → 公開 RPC の往復を含む値。
