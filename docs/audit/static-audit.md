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

---

# 依存の監査の再確認（2026-10-13・#76）

10-07 の記録から指摘が増えたので、件ごとに「本番のバンドルに入るか・外部の入力に届くか」を実測で判断した。

## 結論

- **ルート（anchor test 用）**：mocha を 9 → 12 に上げ、mocha 経由の high 7 件・low 1 件を解消した。high は 9 → 2。残る 2 件（`toml` と、それを引き込む `@coral-xyz/anchor`）は修正版が無く、テスト実行時に自分の `Anchor.toml` を読むだけなので影響なし
- **app**：修正版のある指摘は開発用ツール（wrangler・stryker・node polyfill）だけ。本番の依存の指摘 26 件はすべて修正版が無く、ブラウザの配信物にも Pages Functions にも、指摘のあるコードが入らないか、入っても外部の入力が届かない
- **cargo audit**：脆弱性 0 件。警告 3 件は Anchor / Solana の推移的依存で、2 件はオンチェーンのビルドに入らない

## 件数（`npm audit` / `cargo audit` の実行出力）

| 対象 | critical | high | moderate | low | 備考 |
|---|---|---|---|---|---|
| ルート（更新前・mocha 9.2.2） | 0 | 9 | 5 | 1 | |
| ルート（更新後・mocha 12.0.3） | 0 | **2** | 5 | 0 | このブランチ |
| app `--omit=dev` | 0 | 15 | 11 | 0 | 10-07 と同数 |
| app（dev を含む） | 0 | 18 | 13 | 6 | |
| cargo audit | 脆弱性 0 | | | | 警告 3（allowed） |

`npm audit` は「指摘のあるパッケージ」と「それに依存しているだけのパッケージ」を同じ 1 件として数える。下の表は、勧告（GHSA）を自分で持つパッケージを行にし、依存しているだけのものは経路に書いた。

## 調べ方

- 経路：`npm ls <pkg> --omit=dev`（app）/ `npm ls <pkg>`（ルート）、`cargo tree -i <crate>`
- ブラウザの配信物：`cd app && npm run build` のあと、`dist/assets/*.js`（1 ファイル・約 976 KB）を各パッケージに固有の文字列で grep した。minify で識別子は消えるがエラーメッセージなどの文字列は残るので、文字列で見る。jayson の `JSON-RPC 1.0 does not support batching` が 1 件ヒットすること（＝入っているものは検出できること）を対照にした
- Pages Functions：`npx wrangler pages functions build --outdir <一時ディレクトリ>` で本番と同じ束ね方をし、出力（約 60 KB）を同じ文字列で grep した。束ねられた外部モジュールは `base-x`・`bs58`・`path-to-regexp`（と wrangler のテンプレート）だけで、`@solana/web3.js` は入っていない（`functions/`・`server/` で web3.js を import しているのはテストだけ）

| 調べた文字列 | 出どころ | dist（ブラウザ） | Functions |
|---|---|---|---|
| `JSON-RPC 1.0 does not support batching` | jayson（ブラウザ用クライアント）※対照 | 1 | 0 |
| `Cannot redefine existing key` | toml | 0 | 0 |
| `Parser cannot parse input` | stream-json | 0 | 0 |
| `Namespace must be array-like` | uuid の v3/v5 実装 | 1 | 0 |
| `expanded array length exceeds range limit` | braces | 0 | 0 |
| `Expected the first argument to be an object` | micromatch | 0 | 0 |
| `DuplicateHasteCandidatesError` / `metro-file-map` | metro | 0 | 0 |
| `ActionSheetIOS` / `NativeModules` / `TurboModuleRegistry` / `react-native` | react-native | 0 | 0 |
| `Mobile Wallet Adapter` | @solana-mobile/wallet-adapter-mobile（ブラウザ用ビルド） | 1 | 0 |
| `secp256k1` / `elliptic` / `createECDH` | elliptic（crypto の polyfill） | 0 | 0 |

## ルート（anchor test 用・本番には出ない）

| パッケージ | 勧告 | 経路 | 判断 |
|---|---|---|---|
| js-yaml 4.1.0 | GHSA-mh29-5h37-fv8m ほか 4 件（high 3） | mocha 9 | **解消**（mocha 12 は js-yaml 5 を使う） |
| minimatch 4.2.1 | GHSA-3ppc-4f35-3m26 ほか 2 件（high） | mocha 9 | **解消** |
| nanoid 3.3.1 | GHSA-28wg-ghj8-5hjv ほか 3 件（high 3） | mocha 9 | **解消**（mocha 12 は nanoid を使わない） |
| serialize-javascript 6.0.0 | GHSA-5c6j-r48x-rmvq ほか 2 件（high 1） | mocha 9 | **解消**（mocha 12 は 7.1 系） |
| braces・chokidar | GHSA-vfj7-8cjw-p6xm（high） | mocha 9 → chokidar 3 | **解消**（mocha 12 は chokidar 5） |
| diff 5.0.0 | GHSA-73rr-hh4g-fpgx（low） | mocha 9 | **解消** |
| toml 3.0.0 | GHSA-82x6-q7mm-w9cf・GHSA-v5mp-jgw5-2x6j（high） | `@coral-xyz/anchor` | **影響なし**。使われるのは `anchor.workspace` を参照したとき（`dist/cjs/workspace.js` が `fs.readFileSync("Anchor.toml")` を `toml.parse` する）だけで、読むのはリポジトリの `Anchor.toml`。外部の入力は届かない。修正版なし（Anchor の更新は対象外） |
| stream-json・uuid（と jayson・web3.js・borsh） | moderate | `@coral-xyz/anchor` → `@solana/web3.js` → jayson | **影響なし**。テストがつなぐ先はローカルの test validator だけ。理由の詳細は app の同じ行 |

### mocha 12 への更新で変えたこと

- `ts-mocha`（10.x）を外し、`ts-node` を直接読ませる形にした。ts-mocha の最新 11.1.0 も peer が `mocha ^11` までで、mocha 12 では peer の衝突になる。また ts-mocha が使う `require.resolve('mocha/bin/mocha')` は、mocha 12 が `bin/_mocha` を消して `exports` を足したので当てにできない
- `Anchor.toml` の test を `TS_NODE_PROJECT=./tsconfig.json npx mocha -r ts-node/register/transpile-only -t 1000000 'tests/**/*.ts'` にした。ts-mocha の `-p ./tsconfig.json` は ts-mocha 独自のオプション（環境変数 `TS_NODE_PROJECT` に移すだけ）で、既定の型検査なし（transpile-only）も同じにした。`-t` は mocha 12 でもそのまま使える
- mocha 12 の破壊的変更のうち関係しうるもの：Node 20.19 以上（CI は Node 24）、CLI の解析が yargs から `util.parseArgs` に変わった（上の引数で動作を確認）、`CI` 環境変数があると `--forbid-only` が既定で有効（テストに `.only` は無い）
- `@types/mocha` を 10 に上げた

ローカル（arm64 の macOS、ネイティブの anchor 0.31.1 / solana 2.3.13）で 14 件が通ることを確認した。`anchor test` の validator は手元の別プロセスとポート 8000 がぶつかったので、validator だけ別ポートで起動し `anchor test --skip-build --skip-local-validator --skip-deploy` で test スクリプトを流した：

```
  14 passing (11s)
```

CI の anchor ジョブ（`npm test`）での結果は PR に記録する。

## app（本番の依存・`--omit=dev`）

| パッケージ | 勧告 | 経路 | 判断 |
|---|---|---|---|
| braces 3.0.3 | GHSA-vfj7-8cjw-p6xm（high） | wallet-adapter-react → @solana-mobile/wallet-adapter-mobile → react-native → @react-native/community-cli-plugin → metro → metro-file-map → micromatch → braces | **影響なし**。React Native の開発サーバ（metro）の部品で、ブラウザでは使われない。dist に braces・micromatch・metro・react-native の文字列は 0 件。@solana-mobile は `browser` 条件のビルド（`index.browser.js`）が入り、react-native 用の入口（`index.native.js`）は使われない。修正版なし |
| （上の経路にある 11 件） | high（依存しているだけ） | react-native・metro・metro-config・metro-file-map・metro-transform-worker・micromatch・@react-native/*・@solana-mobile/*（4 件） | braces と同じ理由で**影響なし**。いずれも自分の勧告は持たない |
| toml 3.0.0 | GHSA-82x6-q7mm-w9cf・GHSA-v5mp-jgw5-2x6j（high） | `@coral-xyz/anchor` | **影響なし**。ブラウザは anchor の `browser` ビルド（`dist/browser/index.js`）を使い、そこに toml は無い（ファイル内 `toml` 0 件）。dist の grep も 0 件 |
| stream-json 1.9.1 | GHSA-528h-pc64-c93x・GHSA-hqr4-qq8f-hg3x・GHSA-mjw6-4jj6-33hc（moderate） | @solana/web3.js → jayson | **影響なし**。jayson の中で stream-json を使うのは Node 用の `lib/utils.js` だけ。web3.js のブラウザ版が使うのは `jayson/lib/client/browser` で、こちらは使わない。dist に 0 件 |
| uuid 8.3.2 | GHSA-w5hq-g745-h8pq（moderate・v3/v5/v6 に `buf` を渡したときの境界チェック漏れ） | @solana/web3.js → jayson | **影響なし**。jayson のブラウザ用クライアントが CommonJS で `require('uuid').v4` するため、v3/v5 の実装ごと dist に入っている（`Namespace must be array-like` 1 件）。ただし呼ばれるのは v4 だけで、アプリのコード（`src`・`functions`・`server`）は uuid を使っていない。v3/v5/v6 に外部の入力は届かない |
| （上の経路にある 9 件） | moderate（依存しているだけ） | jayson・@solana/web3.js・@coral-xyz/anchor・@coral-xyz/borsh・@solana/wallet-adapter-*（5 件） | stream-json・uuid と同じ理由で**影響なし** |

修正版はどれも無い（`fixAvailable: false`）。解消するには web3.js 2 系（@solana/kit）への移行か、ウォレットアダプタの置き換えが要り、どちらも #76 の対象外。

## app（開発用の依存だけに出るもの）

| パッケージ | 勧告 | 経路 | 判断 |
|---|---|---|---|
| sharp 0.35.4（と miniflare・wrangler） | GHSA-wq5f-xc86-pv6w（high・librsvg） | wrangler → miniflare → sharp | **影響なし**。wrangler が手元で Workers を動かすための miniflare（ローカルの実行環境）の依存。本番は Cloudflare 側の実行環境で動き、sharp は配信物にも Functions の束にも入らない。`npm audit fix`（wrangler 4.149.0 への semver 内の更新）で消えるが、この PR では mocha 以外の依存を動かさない。次の定期的な依存更新で上げる（**保留**） |
| qs 6.15.1（と typed-rest-client） | GHSA-q8mj-m7cp-5q26 ほか 2 件（moderate） | @stryker-mutator/core → typed-rest-client | **影響なし**。mutation テスト（手動実行）の中だけで使う。`npm audit fix` で消える。上と同じく**保留** |
| elliptic 6.6.1（と browserify-sign・create-ecdh・crypto-browserify・node-stdlib-browser・vite-plugin-node-polyfills） | GHSA-848j-6mx2-7j84（low） | vite-plugin-node-polyfills → node-stdlib-browser → crypto-browserify | **影響なし**。polyfill として配信物に入りうる経路だが、アプリのコード（`src`）は `crypto` を import しておらず、dist に `secp256k1`・`elliptic`・`createECDH` は 0 件。npm の提案する修正は vite-plugin-node-polyfills 0.2.0 への大きな巻き戻しなので取らない |

## cargo audit（2026-10-13）

```
$ cargo audit
    Scanning Cargo.lock for vulnerabilities (214 crate dependencies)
warning: 3 allowed warnings found
```

脆弱性は 0 件（10-07 と同じ）。

| クレート | ID | 経路（`cargo tree -i`） | 判断 |
|---|---|---|---|
| bincode 1.3.3 | RUSTSEC-2025-0141（unmaintained） | anchor-lang・solana-account-info ほか | **保留**。保守終了の告知で、既知の脆弱性ではない。Anchor が直接使っており、外すには Anchor の更新が要る（対象外） |
| libsecp256k1 0.6.0 | RUSTSEC-2025-0161（unmaintained） | solana-program → solana-secp256k1-recover | **影響なし**。solana-secp256k1-recover の `Cargo.toml` で `cfg(not(target_os = "solana"))` のときだけの依存で、オンチェーンのビルドには入らない（オンチェーンは syscall を使う）。このプログラムは secp256k1 も使っていない（署名の検証は Ed25519） |
| rand 0.7.3 | RUSTSEC-2026-0097（unsound） | libsecp256k1 → rand | **影響なし**。libsecp256k1 と同じく、オンチェーンのビルドには入らない |

## 別 issue にするもの

- wrangler・stryker の semver 内の更新（上の「保留」2 件）は、次の依存更新でまとめて行う。issue はまだ作っていない
