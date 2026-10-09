# 演出の改修を本番で測り直す（#43・2026-10-09）

本番 https://sokketsu.pages.dev（Pages `55d47f6f`・main `f714540`。#30〜#35・#45・#47・#48 入り）を `tools/motion` で測った。デモは devnet 鍵（`--keypair`）で始めた。

## 待機中（10 秒）

| 条件 | 静止（<0.3%） | 平均の差分面積 | 最長の静止 | 送った取引 |
|---|---|---|---|---|
| 1280×900 | 0% | 11.20% | 0.00 s | 0 件 |
| 390×844 | 0% | 10.27% | 0.00 s | 0 件 |
| 1280×900・reduced-motion | 96% | 0.04% | 2.85 s | 0 件 |

#30 の条件（静止 50% 以下・平均 1% 以上・再生中の取引 0 件・reduced-motion で止まる）を満たす。改修前（2026-10-08・本番 `5a219dee`）は静止 100%・平均 0.13%。

## デモ 1 回（hold → release）

| 区間 | 1280×900 | 390×844 | 条件 |
|---|---|---|---|
| 判断中の静止 | 0% | 0% | #34: 20% 以下 |
| カウントダウン中の静止 | 0% | 0% | #34: 20% 以下 |
| 最長の静止（全体） | 0.05 s | 0.00 s | #34: 1 秒未満 |
| 確定から 3 秒の平均 | 18.75% | 24.11% | #31・#45: 10% 以上 |
| 確定の瞬間に画面内 | .stage・.judge-flow・.vault-ms・中央の数字 すべて ○ | 同左 | #31・#32 |

色調の切り替わりの前後 1 秒の平均（#33・#48: 5% 以上）

| 切り替わり | 1280×900 | 390×844 |
|---|---|---|
| depositing（1 回目 / 2 回目） | 19.2% / 11.6% | 17.6% / 9.3% |
| judging（1 回目 / 2 回目） | 15.8% / 17.7% | 12.4% / 11.4% |
| holding | 16.9% | 13.6% |
| releasing | 19.3% | 14.2% |

stopped・countdown は色調が変わらない切り替わり（holding と同じ琥珀）なので対象外。

## 3 回続けて流した録画（#35 から移した条件）

`2026-10-09-production-runs.mp4`（音声つき・46 秒・平均 −37.7 dB。960 幅に縮めた）、各回の確定の瞬間は `2026-10-09-run{1,2,3}.png`、記録は `2026-10-09-production-runs.json`。

| 回 | 確定 | ランク・格 | 惜しさ | コンボ | 取引 |
|---|---|---|---|---|---|
| 1 | 766 ms | A・epic | あと 167 ms で S ランク | ×1 | [2xt1PPgG…7GrGGxk](https://explorer.solana.com/tx/2xt1PPgGUyRnxbY1DKAqi6QrgU1BvDAQ7pcpGTfybk6oB77pUBjK6A5hkqsihSVKpL9DgRGX7zHyFz6Eb7GrGGxk?cluster=devnet) |
| 2 | 991 ms | B・rare | あと 92 ms で A ランク | ×2 🔥 | [5VYDZynv…oC8BBMz](https://explorer.solana.com/tx/5VYDZynvRkkmV3hFS3BWGsd9sFQEFkp1Sf1sumFiR4vCk6aeSt7o5rukDmKZMqwCHZ32q4xW4mZcxULZpoC8BBMz?cluster=devnet) |
| 3 | 878 ms | A・epic | あと 279 ms で S ランク | ×3 🔥🔥 | [34yDiRf9…2YCfn36](https://explorer.solana.com/tx/34yDiRf93FfbARFuM2nJT1h48xNfyhpLwmfvhZE3AaVMBthPjKNrxjCEgfiSkU5n66cJC5d1rKfUMpLPm2YCfn36?cluster=devnet) |

この 3 回は自己ベストの更新が無く、大当たり（光線と帯）は出なかった。大当たりはローカル + 本番 API の録画（2026-10-08、2 回目 739 ms で自己ベスト更新）で確認済み。

## 再現

```sh
cd tools/motion
node measure.mjs --mode idle --viewport 1280x900 --out out/prod
node measure.mjs --mode play --viewport 1280x900 --keypair <devnet 鍵> --out out/prod
node record-runs.mjs --keypair <devnet 鍵> --runs 3 --out out/runs
```
