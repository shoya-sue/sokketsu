# 発表動画（#21・提出用の英語版）

`sokketsu-pitch.mp4`（1920×1080・**60fps**・127.1 秒・英語ナレーションつき）。Solana ハッカソンの提出用ピッチ動画。本番の画面を英語表示で実際に操作して撮った素材と、時刻からコマを決める場面（`docs/video/tooling.md` の B 方式）を組み合わせ、macOS の `say`（Samantha）で作った英語ナレーションを重ねて書き出す。

## 構成

場面の長さはナレーションの長さで決まる（`SCENE_S` より長ければ伸ばし、動きは元の台本の時間軸を引き伸ばして進める）。

| 場面 | 長さ | 中身 |
|---|---|---|
| hook | 14.2 秒 | Tower BFT 12.8 s と Alpenglow 858 ms（実測）の比較 → 「Don't wait.」 |
| problem | 17.2 秒 | LLM の長文では払いを止められない → Jev の型付きの答え（decision・probability） |
| flow | 20.0 秒 | Deposit → Jev decides → Verify（Ed25519 on-chain）→ Finalize、閾値 70% |
| demo | 36.7 秒（撮影 29.8 秒 + 止めて待つ 7.6 秒） | 本番の画面（#56 の新しい画面。初回の案内 → お試し → hold で止める → release で確定）。ナレーションは撮影の段階の印に合わせて置き、収まらない所は止めて待つ |
| numbers | 11.5 秒 | 確定ミリ秒・Tower BFT との比・sent → processed → finalized の内訳・slot・取引 ID |
| solana | 15.1 秒 | Why Solana：Alpenglow のサブ秒確定・Ed25519 のオンチェーン検証・手数料 |
| close | 12.3 秒 | ロゴ・sokketsu.pages.dev・github.com/shoya-sue/sokketsu・Thank you |

ナレーションの文は `scenes/narration.mjs`（数値は撮影データから入れる。読めなければ数を言わない）。

## 画面とナレーションに出る数値と取引（撮影 2026-10-11 09:58 UTC・英語表示・#56 の新しい画面）

`capture/out/run.json` がそのまま動画の数値になる（作った数字は使わない）。判断はデモトークンを入れて Jev が返したもの（`source: jev · ✓ signed`）。撮影は screencast で 48.2 fps（`docs/video/tooling.md` の「実演の撮り方」）。

| 出来事 | 値 | 取引 |
|---|---|---|
| hold の預け入れ | 781 ms | [4nBvpPBx…FuU53YrW](https://explorer.solana.com/tx/4nBvpPBxXYrsnafTLc6VWHF4R7G7c4nD3TaLSfJU1v7rUkw5Z99tnzdGf8KkQAnm9BEw5TbaTqgUNuPxFuU53YrW?cluster=devnet) |
| Jev の判断 | hold 99% | |
| hold で止めた（送金なし） | — | [49YeBRTG…pJ9tTZe4b](https://explorer.solana.com/tx/49YeBRTGSc41d8NCAaoeS5mbVTP7ZuyH2t7wDMfZUKN1qEffTSgGb9HPKGiwG3YgZbFdK71RAcePPf5pJ9tTZe4b?cluster=devnet) |
| release の預け入れ | 717 ms | [36NjAyiC…87nyY7mMvW](https://explorer.solana.com/tx/36NjAyiCsVRkCYc6VDyQdYxNes1m4Mmv35rtH56Kqdu8teZaAn23kp8ToBUev9pxUY2aQtH84dw94R87nyY7mMvW?cluster=devnet) |
| Jev の判断 | release 97% | （オラクルの署名はプログラムが検証） |
| 受注者へ解放 finalized | **858 ms**（sent 0 → processed 451 → finalized 858）・Tower BFT の約 15 倍 | [4ondkUqt…3TWbF4v8a](https://explorer.solana.com/tx/4ondkUqtcL9g6NZbtRPBYLZM1uwTSKXvScRPeGDuFbYUqcGn6zSv2d9Nf7JxeQydmujmjaRnkLbdXBG3TWbF4v8a?cluster=devnet) |
| slot（確定の瞬間） | 509,864,530 | |

実演の冒頭に映る「REPLAY 797 ms」は、待機中に流れる送金しない再生（#30）で、今回の撮影の値ではない。

## 作り直す

```sh
cd video && npm install
npx playwright-core install chromium chromium-headless-shell   # 初回だけ（撮影は chromium、書き出しは headless-shell）

# 1. 本番を英語表示で撮る（お試しで始め、デモトークンを入れて Jev に判断させる）。capture/out/ に screen.webm・audio.webm・run.json
npm run capture -- --token-file ../.keys/demo-token.txt          # 日本語で撮るなら --lang ja。画面の倍率は --scale（既定 1.5）
# 2. 要所のコマだけ確かめる（動画は書き出さない）→ <出力>.<秒>.png
PREVIEW=4,27,75,97,118 node render.mjs /tmp/preview.mp4
# 3. 書き出す（60fps・手元の M4 Pro の高負荷下で 38 分 48 秒）→ sokketsu-pitch.mp4
npm run render                                                     # 声は VOICE=… VOICE_RATE=…（既定 Samantha・182）
# 台本とナレーションのテスト
npm test
```

- お試しは faucet を使う（IP ごとに 10 分 1 回）。続けて撮るときは `--keypair <devnet 鍵の JSON>`
- 撮影は 1280×720 の画面を 1.5 倍の解像度で描く（`--scale`・`deviceScaleFactor`）。CSS の zoom は新しい 1 画面の HUD をはみ出させるので使わない
- 実演のナレーションが次の段階までに収まらなければ、実演を次の段階の直前のコマで止めて待つ（`timeline.mjs` の holds。効果音も同じ区切りで並べ直す）。書き出しのときに `hold … s before capture … s` と出る。撮影の速さに左右されない（2026-10-11：28 秒の撮影で 3 か所・計 9.1 秒止めて重なり 0）
- 書き出しは音の無い映像（`<出力>.video.mp4`）を残す。台本の長さが変わらない変更（効果音の音量など）は `MUX_ONLY=1 npm run render` で音だけ重ね直せる（コマは撮り直さない）
- 撮影の終わりに screencast の fps が出る。45 fps 未満なら警告が出るので、重い処理を止めて撮り直す（同じ方式で 57 fps と 28 fps に分かれたことがある）
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
> A payer escrows SOL in a program-owned vault. Jev, a typed judge, returns only `release` / `hold` / `refund` with a probability. Our oracle signs the decision and the Anchor program verifies the Ed25519 signature on-chain; funds move only when a signed release clears a 70% threshold. On Alpenglow devnet we measured 858 ms from send to finalized — about 15× faster than Tower BFT's ~12.8 s. Every number in the video comes from real devnet transactions.
> Live: https://sokketsu.pages.dev · Code: https://github.com/shoya-sue/sokketsu · Program (devnet): `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`
