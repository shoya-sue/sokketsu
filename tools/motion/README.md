# 動きの量を測る（#29）

Playwright で画面を実時間で録画し、ffmpeg で 20fps にそろえてコマ間の差分面積を出す。演出の改修（#30〜#35）の完了条件はこの数値で判定する。

## 準備

```sh
cd tools/motion
npm install
npx playwright-core install chromium-headless-shell   # 初回だけ
```

ffmpeg が PATH に要る（`brew install ffmpeg`）。

## 使い方

```sh
# 待機中だけ（SOL を使わない）。読み込み後 2 秒待ってから 10 秒撮る
node measure.mjs --mode idle --url https://sokketsu.pages.dev --out out

# スマホ幅・reduced-motion
node measure.mjs --mode idle --viewport 390x844 --reduced-motion --out out

# デモ 1 回（hold → release）。お試しは faucet から 0.12 SOL を受け取る（IP ごとに 10 分 1 回）
node measure.mjs --mode play --url https://sokketsu.pages.dev --out out

# ローカルの vite（Functions なし）を、API だけ本番に転送して測る。faucet の代わりに devnet 鍵を貼る
node measure.mjs --mode play --url http://localhost:5173 --api https://sokketsu.pages.dev \
  --keypair ../../.keys/demo-payer.json --out out
```

出力は `out/<mode>-<viewport>/` に `recording.webm`・`result.json`・`last.png`（play では確定の瞬間の `released.png` も）。表は標準出力に出る（`--json` で JSON）。

## 指標

| 指標 | 意味 |
|---|---|
| 静止 | 差分面積が 0.3% 未満のコマの割合 |
| 平均の差分面積 | 前のコマと輝度が 10 を超えて違う画素の割合の平均 |
| 最長の静止 | 静止のコマが続いた最長の時間（同じ名前の区間をつないだ箇所では切る） |
| 1% 超の秒 | 1 秒ごとの平均が 1% を超えた秒の数 |

区間は `.shell` の `data-phase`（depositing / judging / holding / stopped / releasing / released …）と、次の依頼までのカウントダウン（`countdown`）で切る。

## 基準値（2026-10-08・改修前）

待機中（本番 `5a219dee`・1280×900・10 秒）：

| 区間 | コマ数 | 静止 | 平均 | 最長の静止 | 1% 超の秒 |
|---|---|---|---|---|---|
| idle | 200 | 100% | 0.13% | 9.95 s | 0 |

待機中（390×844）：静止 92%・平均 0.10%。

デモ 1 回（ローカル `b64f5bb` + 本番 API・1280×900）：

| 区間 | コマ数 | 静止 | 平均 | 最長の静止 | 1% 超の秒 |
|---|---|---|---|---|---|
| depositing | 47 | 62% | 0.86% | 0.50 s | 1 |
| judging | 37 | 70% | 0.36% | 0.35 s | 0 |
| holding | 20 | 85% | 0.24% | 0.70 s | 0 |
| countdown | 120 | 92% | 0.39% | 3.60 s | 1 |
| releasing | 19 | 42% | 0.41% | 0.30 s | 0 |
| released | 81 | 7% | 2.47% | 0.15 s | 5 |

録画はページの描画と同時なので、遅いマシンや CI では値が揺れる。比べるときは同じマシン・同じ viewport で測る。
