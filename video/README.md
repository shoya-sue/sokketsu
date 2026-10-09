# 発表動画（#21）

`sokketsu-pitch.mp4`（1920×1080・30fps・66.6 秒・音声つき）。本番の画面を実際に操作して撮った素材と、時刻からコマを決める場面（`docs/video/tooling.md` の B 方式）を組み合わせて書き出す。

## 構成

| 場面 | 長さ | 中身 |
|---|---|---|
| 掴み | 8 秒 | 確定まで 12.8 秒待たされていた → Tower BFT と Alpenglow（実測）の比較 → 「待たない。」 |
| 課題 | 9 秒 | LLM の長文の判断では止められない → 型付きの答え（decision・probability） |
| 仕組み | 11 秒 | 預け入れ → Jev が判断 → 署名を検証 → 確定、閾値 70% |
| 実演 | 撮影の長さ（今回 23 秒） | 本番の画面の録画（お試し → hold で止める → release で確定）と字幕 |
| 数値 | 9 秒 | 確定ミリ秒・Tower BFT との比・送信 → processed → finalized の内訳・slot・取引 ID |
| 締め | 7 秒 | ロゴ・devnet で動いている・sokketsu.pages.dev |

## 画面に出る数値と取引（撮影 2026-10-09 08:28 UTC・本番 Pages `55d47f6f`）

`capture/out/run.json` がそのまま動画の数値になる（作った数字は使わない）。判断はデモトークンを入れて Jev が返したもの（`source: jev · ✓ 署名済み`）。

| 出来事 | 値 | 取引 |
|---|---|---|
| hold の預け入れ | 787 ms | [2RfqJ1QA…kALEGGYa](https://explorer.solana.com/tx/2RfqJ1QAQ3Ndyv1oE9HZ5NBhAgMCRpcN2q5tfGL5p8boHRehahKREumhKCGSUNmKgm141pNYFncYnjo3kALEGGYa?cluster=devnet) |
| hold で止めた（送金なし） | — | [4ZWcBBCS…qPhseuwJ](https://explorer.solana.com/tx/4ZWcBBCSds3iuxtkacK3TWHLC2qbE5Haf42fgDEZ2dT7sDThR4HwTdi6vdsF21ro6NHCe7BYChpaxTD6qPhseuwJ?cluster=devnet) |
| release の預け入れ | 838 ms | [5n7vVZ9K…qtkCRcA7](https://explorer.solana.com/tx/5n7vVZ9KuZRk4Mz8sCtG5UWsh8ffFjN56KxGs3PfWfwoqjQfYLgWsB1tuU2HaejSKLH7u3VSfzZuMXUdqtkCRcA7?cluster=devnet) |
| Jev の判断 | release 96% | （オラクルの署名はプログラムが検証） |
| 受注者へ解放 finalized | **731 ms**（送信 0 → processed 458 → finalized 731） | [36pfdAng…aQabELEvZ2J](https://explorer.solana.com/tx/36pfdAngiAHpnFtWLYb3cumecfYbvJ82w3g9dUSuYDhoMDPuv5TUwRvBKbGZhz12PRvBBDizE5eVaaQabELEvZ2J?cluster=devnet) |
| slot（確定の瞬間） | 509,118,556 | |

実演の冒頭に映る「REPLAY 797 ms」は、待機中に流れる送金しない再生（#30）で、2026-10-08 の本番で測った確定ミリ秒。今回の撮影の値ではない。

## 作り直す

```sh
cd video && npm install
npx playwright-core install chromium-headless-shell   # 初回だけ

# 1. 本番を撮る（お試しで始め、デモトークンを入れて Jev に判断させる）。capture/out/ に screen.webm・audio.webm・run.json
npm run capture -- --token-file ../.keys/demo-token.txt
# 2. 書き出す（約 7 分）→ sokketsu-pitch.mp4
npm run render
# 台本（場面の長さ・字幕）のテスト
npm test
```

- お試しは faucet を使う（IP ごとに 10 分 1 回）。続けて撮るときは `--keypair <devnet 鍵の JSON>`
- 撮影はページを 1.5 倍に拡大する（`--zoom`）。1920×1080 の画面に 1280×720 相当のレイアウトで、動画でも文字が読める
- 書体とロゴはアプリと同じ（`docs/brand/README.md`）

## ファイル

| パス | 役割 |
|---|---|
| `capture/capture.mjs` | 本番を操作して撮り、数値と取引 ID を `run.json` に書く |
| `capture/audio-hook.js` | アプリの効果音を MediaRecorder で録る |
| `scenes/index.html` | 時刻 t から全場面のコマを決める（`window.renderAt(t)`） |
| `scenes/timeline.mjs` | 台本（場面の長さ）と、実演で撮影のどの時刻を映すか・どの字幕を出すか（純粋関数、テストあり） |
| `render.mjs` | 1 コマずつ撮って MP4 にし、撮影の音を実演の場面に重ねる |
| `prototypes/` | 制作手段を決めたときの試作（#20） |
