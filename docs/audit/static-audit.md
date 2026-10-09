# 静的監査の記録（2026-10-07）

対象はブランチ `task/6-static-audit`（`feat/10-wallet-escrow` の上）。devnet に出ているコードと同じ内容。

## 結論

対応が必要な検出は無い。未使用の直接依存 1 件はこのブランチで外した。依存の既知脆弱性はすべて Anchor・web3.js・ウォレット接続ライブラリの推移的依存で、こちらで直す手段が無く、ブラウザの配信物にも入っていない。

## 1. gitleaks（git 履歴全体の秘密混入）

```
$ gitleaks git --no-banner --redact .
INF scanned ~834409 bytes (834.41 KB)
INF no leaks found
```

`.keys/`（デプロイ鍵・オラクル鍵・faucet 鍵）と `app/.dev.vars` は gitignore 済みで、履歴にも入っていない。

## 2. npm audit（`--omit=dev`）

| 対象 | critical | high | moderate |
|---|---|---|---|
| ルート（anchor test 用） | 0 | 2 | 5 |
| app | 0 | 15 | 11 |

- ルートと app に共通の 7 件：`@coral-xyz/anchor` → `toml`（high）、`@solana/web3.js` → `jayson` → `stream-json`・`uuid`（moderate）。修正版は無い（`fixAvailable: false`）
- app で増えた分：`@solana/wallet-adapter-react` → `@solana-mobile/wallet-adapter-mobile` → `react-native` → `metro`・`micromatch`・`braces` など（React Native の開発ツール）。修正版は無い
- **配信物への混入は無い**：`app/dist/assets/*.js` に `react-native`・`metro-config`・`micromatch`・`toml-node`・`jayson` は 1 件も含まれない（grep で確認）。Vite が使わないモジュールを落としている

## 3. cargo audit

```
$ cargo audit
Scanning Cargo.lock for vulnerabilities (214 crate dependencies)
warning: 3 allowed warnings found
```

脆弱性は 0 件。警告 3 件はいずれも Anchor / Solana の依存で、このクレートは直接使っていない。

| クレート | ID | 内容 |
|---|---|---|
| bincode | RUSTSEC-2025-0141 | unmaintained |
| libsecp256k1 | RUSTSEC-2025-0161 | unmaintained |
| rand | RUSTSEC-2026-0097 | custom logger と `rand::rng()` の組み合わせで unsound |

## 4. knip（app の未使用ファイル・export・依存）

```
$ npx knip@5 --no-progress
Unused dependencies (1)   @solana/wallet-adapter-base
Unused exports (9)        ALLOWED_METHODS, MAX_BODY_BYTES, connection, DEADLINE_SLOTS,
                          MEASURE_TIMEOUT_MS, MEASURE_INTERVAL_MS, DECISION_CODE, closeIx, ACHIEVEMENTS
Unused exported types (7) Ed25519Signer, SourceName, EscrowView, MsgKey, Judge, RunResult, Sfx
```

| 検出 | 判断 |
|---|---|
| `@solana/wallet-adapter-base` | **外した**。`@solana/wallet-adapter-react(-ui)` の依存として入るので直接の指定は不要。外したあとも `tsc -b`・`vite build`・vitest 176 件が通る |
| 未使用の export 9 件 | 対応不要。どれも定義したモジュールの中で使われており、`export` が余分なだけ（動作に影響なし） |
| 未使用の型 7 件 | 対応不要。公開している型の別名で、動作に影響なし |

未使用のファイルは 0 件。

## 別 issue にしたもの

なし。
