# 発表動画（#21・提出用の英語版）

`sokketsu-pitch.mp4`（1920×1080・30fps・131.8 秒・英語ナレーションつき。次の書き出しから 60fps）。Solana ハッカソンの提出用ピッチ動画。本番の画面を英語表示で実際に操作して撮った素材と、時刻からコマを決める場面（`docs/video/tooling.md` の B 方式）を組み合わせ、macOS の `say`（Samantha）で作った英語ナレーションを重ねて書き出す。

## 構成

場面の長さはナレーションの長さで決まる（`SCENE_S` より長ければ伸ばし、動きは元の台本の時間軸を引き伸ばして進める）。

| 場面 | 長さ | 中身 |
|---|---|---|
| hook | 14.2 秒 | Tower BFT 12.8 s と Alpenglow 839 ms（実測）の比較 → 「Don't wait.」 |
| problem | 17.2 秒 | LLM の長文では払いを止められない → Jev の型付きの答え（decision・probability） |
| flow | 20.0 秒 | Deposit → Jev decides → Verify（Ed25519 on-chain）→ Finalize、閾値 70% |
| demo | 42.2 秒（撮影の長さ） | 本番の画面（初回の案内 → お試し → hold で止める → release で確定）。ナレーションは撮影の段階の印に合わせて置く |
| numbers | 11.5 秒 | 確定ミリ秒・Tower BFT との比・sent → processed → finalized の内訳・slot・取引 ID |
| solana | 15.1 秒 | Why Solana：Alpenglow のサブ秒確定・Ed25519 のオンチェーン検証・手数料 |
| close | 11.5 秒 | ロゴ・sokketsu.pages.dev・github.com/shoya-sue/sokketsu |

ナレーションの文は `scenes/narration.mjs`（数値は撮影データから入れる。読めなければ数を言わない）。

## 画面とナレーションに出る数値と取引（撮影 2026-10-09 09:46 UTC・英語表示）

`capture/out/run.json` がそのまま動画の数値になる（作った数字は使わない）。判断はデモトークンを入れて Jev が返したもの（`source: jev · ✓ signed`）。

| 出来事 | 値 | 取引 |
|---|---|---|
| hold の預け入れ | 2866 ms | [3ty7ss33…95pZBW16](https://explorer.solana.com/tx/3ty7ss33EpBfex7ZZniiirmAVJ8XWJLtDiDMK9ZHaTFRR3CymxJsttpaVxffpGyxDQeSpWPUQ2orh2NC95pZBW16?cluster=devnet) |
| Jev の判断 | hold 99% | |
| hold で止めた（送金なし） | — | [5uqDnkPj…6tE58ngX](https://explorer.solana.com/tx/5uqDnkPjpSbZhbg3yUvra6x5Ys7FnaviE6Bt9UqNveaEhtX5phvtQmBwfs7pS2zCjXDpkFitywtBmk6L6tE58ngX?cluster=devnet) |
| release の預け入れ | 906 ms | [4dYsBgP7…QiaEqKSd](https://explorer.solana.com/tx/4dYsBgP7wXRZZwt9L9GQcviV3beniSUr33n4t8UTYgGuprEKJrXwzqEPaE1rsaJtZMVCWCigc2c3L5Y4QiaEqKSd?cluster=devnet) |
| Jev の判断 | release 96% | （オラクルの署名はプログラムが検証） |
| 受注者へ解放 finalized | **839 ms**（sent 0 → processed 406 → finalized 839）・Tower BFT の約 15 倍 | [gcVHL2Hy…LMibKbrS](https://explorer.solana.com/tx/gcVHL2HyqdPMBERQJc6F5rAaPN7Zk5XbsjxHZkQkZ4noh5nzVfFSgbZrZP28JJj2xikmTrTAUCY5Jk4LMibKbrS?cluster=devnet)（受注者 `3s66…DZo2` に 0 → 0.05 SOL） |
| slot（確定の瞬間） | 509,138,098 | |

実演の冒頭に映る「REPLAY」は、待機中に流れる送金しない再生（#30）で、今回の撮影の値ではない。確定直後の画面で受注者の残高が 0.0000 のままなのはアプリの表示の更新遅れで、送金はオンチェーンで成立している（上の取引）。

## 作り直す

```sh
cd video && npm install
npx playwright-core install chromium chromium-headless-shell   # 初回だけ（撮影は chromium、書き出しは headless-shell）

# 1. 本番を英語表示で撮る（お試しで始め、デモトークンを入れて Jev に判断させる）。capture/out/ に screen.webm・audio.webm・run.json
npm run capture -- --token-file ../.keys/demo-token.txt          # 日本語で撮るなら --lang ja
# 2. 要所のコマだけ確かめる（動画は書き出さない）→ <出力>.<秒>.png
PREVIEW=4,27,75,97,118 node render.mjs /tmp/preview.mp4
# 3. 書き出す（60fps。30fps のときは約 23 分だった。60fps はその約 2 倍の見込み・未計測）→ sokketsu-pitch.mp4
npm run render                                                     # 声は VOICE=… VOICE_RATE=…（既定 Samantha・182）
# 台本とナレーションのテスト
npm test
```

- お試しは faucet を使う（IP ごとに 10 分 1 回）。続けて撮るときは `--keypair <devnet 鍵の JSON>`
- 撮影はページを 1.5 倍に拡大する（`--zoom`）。1920×1080 の画面に 1280×720 相当のレイアウトで、動画でも文字が読める
- 実演のナレーションが次の文に重なると、書き出しのときに `narration overlaps` と警告が出る。撮影が速く終わると段階の間隔が縮んで重なる（2026-10-11 の試し撮りは 26 秒で、最大 4.2 秒重なった）
- 撮影は CDP の screencast でコマを受け取り、受け取った時刻どおりに 60fps の VP9 にまとめる（`capture/screencast.mjs`）。Playwright の recordVideo は 25fps が上限で、headless では実質 10fps 前後だった。2026-10-11 の実測：実演の区間で実際に変化したコマが約 50fps（旧方式は同じ基準で約 24fps）
- 書体とロゴはアプリと同じ（`docs/brand/README.md`）

## ファイル

| パス | 役割 |
|---|---|
| `capture/capture.mjs` | 本番を操作して撮り、数値と取引 ID を `run.json` に書く（`--lang en` が既定） |
| `capture/screencast.mjs` | CDP screencast でコマを受け取り、60fps の `screen.webm` にする |
| `capture/audio-hook.js` | アプリの効果音を MediaRecorder で録る |
| `scenes/index.html` | 時刻 t から全場面のコマを決める（`window.renderAt(t)`） |
| `scenes/timeline.mjs` | 台本（場面の長さ）・実演で撮影のどの時刻を映すか・字幕・実演のナレーションの位置（純粋関数、テストあり） |
| `scenes/narration.mjs` | 英語ナレーションの文（純粋関数、テストあり） |
| `render.mjs` | ナレーションを `say` で作って長さを測り、1 コマずつ撮って MP4 にし、ナレーションと効果音を重ねる |
| `prototypes/` | 制作手段を決めたときの試作（#20） |

## 提出用の説明文（英語・そのまま貼れる）

> **Sokketsu — stop agent payments with typed decisions, not generated text.**
> A payer escrows SOL in a program-owned vault. Jev, a typed judge, returns only `release` / `hold` / `refund` with a probability. Our oracle signs the decision and the Anchor program verifies the Ed25519 signature on-chain; funds move only when a signed release clears a 70% threshold. On Alpenglow devnet we measured 839 ms from send to finalized — about 15× faster than Tower BFT's ~12.8 s. Every number in the video comes from real devnet transactions.
> Live: https://sokketsu.pages.dev · Code: https://github.com/shoya-sue/sokketsu · Program (devnet): `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`
