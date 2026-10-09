# 発表動画（#21）

`sokketsu-pitch.mp4`（1920×1080・30fps・70.6 秒・音声つき）。本番の画面を実際に操作して撮った素材と、時刻からコマを決める場面（`docs/video/tooling.md` の B 方式）を組み合わせて書き出す。

## 構成

| 場面 | 長さ | 中身 |
|---|---|---|
| 掴み | 8 秒 | 確定まで 12.8 秒待たされていた → Tower BFT と Alpenglow（実測）の比較 → 「待たない。」 |
| 課題 | 9 秒 | LLM の長文の判断では止められない → 型付きの答え（decision・probability） |
| 仕組み | 11 秒 | 預け入れ → Jev が判断 → 署名を検証 → 確定、閾値 70% |
| 実演 | 撮影の長さ（今回 26.6 秒） | 本番の画面の録画（初回の案内ポップアップ → お試し → hold で止める → release で確定）と字幕 |
| 数値 | 9 秒 | 確定ミリ秒・Tower BFT との比・送信 → processed → finalized の内訳・slot・取引 ID |
| 締め | 7 秒 | ロゴ・devnet で動いている・sokketsu.pages.dev |

## 画面に出る数値と取引（撮影 2026-10-09 09:08 UTC・本番 Pages `84135adf`・main `521a370`）

`capture/out/run.json` がそのまま動画の数値になる（作った数字は使わない）。判断はデモトークンを入れて Jev が返したもの（`source: jev · ✓ 署名済み`）。

| 出来事 | 値 | 取引 |
|---|---|---|
| hold の預け入れ | 932 ms | [3n4sZvk7…nLmbz22wi](https://explorer.solana.com/tx/3n4sZvk71tNQPq9G9SRgFo2S2tLS4WAHmXfgKztGP3dCzX7vJjcQu2zSGByJr5apJBsd7HKhpcwgFr5nLmbz22wi?cluster=devnet) |
| hold で止めた（送金なし） | — | [Df7J3fKf…E8tpfgt6](https://explorer.solana.com/tx/Df7J3fKfafECaYyVqWmC4zSxuc6Dicc1uRKqHWMWqGRjaTTmr2yu7CQ8yiWtqFeCH3vqyKPTsPgFGurE8tpfgt6?cluster=devnet) |
| release の預け入れ | 939 ms | [fdJ9aAWS…AwmFa1Vk](https://explorer.solana.com/tx/fdJ9aAWS4vbbhB3oGy6WV1fUCUXhjxzGxzGQrXEaARJ9ro5mL15VzMLVBDMGV1pZd7sehWC48XvNPuhAwmFa1Vk?cluster=devnet) |
| Jev の判断 | release 94% | （オラクルの署名はプログラムが検証） |
| 受注者へ解放 finalized | **809 ms**（送信 0 → processed 276 → finalized 809） | [2DYdKdWG…UetRJaeLD](https://explorer.solana.com/tx/2DYdKdWGdWqz1Ugg8R42z8cT51mnyef8MQxC9h73aqRgDdPD1rogbbjyTmHjuhWjgWgDPhDvYXQnaqxUetRJaeLD?cluster=devnet) |
| slot（確定の瞬間） | 509,128,572 | |

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
