# 発表動画の制作手段（#20・2026-10-07）

## 結論

**「時刻からコマを計算する HTML → Playwright で 1 コマずつ撮影 → ffmpeg」（以下 B）を採用する。** 同じ入力から**バイト単位で同じ MP4** が書き出せ、手元の道具（Node・Playwright・ffmpeg）だけで完結し、ライセンスの制約も無い。HyperFrames（以下 A）は書き出しは手早いが、ローカルでは決定的にならず（300 コマ中 100 コマが毎回変わる）、決定的にするには Docker が要る。

## 比べたもの

同じ 10 秒の場面（「確定まで 12.8 秒待たされていた」→ Tower BFT と Alpenglow の比較 → 「待たない。」、1280×720・30fps）を 2 通りで作った。

| | A: HyperFrames 0.8.139 | B: 時刻の純関数 + Playwright + ffmpeg |
|---|---|---|
| ソース | `video/prototypes/hyperframes/index.html`（GSAP タイムライン + `data-*` の時間指定） | `video/prototypes/playwright/index.html`（`window.renderAt(t)`）+ `render.mjs` |
| 出力 | `hook-hyperframes.mp4`（548 KB） | `hook-playwright.mp4`（327 KB） |
| 書き出し時間（手元・M 系 Mac） | 69 秒（初回ダウンロード込み） | 59 秒 |
| 決定性（2 回書き出して比較） | **一致しない**：ファイルのハッシュが異なり、`ffmpeg -f framemd5` で 300 コマ中 100 コマが不一致。CLI の `--docker`（"Use Docker for deterministic render"）を使えば決定的になる前提 | **一致**：ファイルの SHA-256 が同じ（`445cf617a313affb…`）、300 コマすべて同一 |
| 音 | `<audio data-*>` で配置・ミックスできる（`/hyperframes-audio`） | ffmpeg で別トラックを合成する（自前） |
| 修正のしやすさ | GSAP の書き方のまま。プレビュー（`hyperframes preview`）がある | すべてが `renderAt(t)` の計算なので、任意の時刻を即座に確かめられる。アニメーションの補間は自前 |
| ライセンス | Apache-2.0 | 依存は playwright-core（Apache-2.0）と ffmpeg のみ |

## 決めたこと

- 本編（#21）は B で作る。画面の数値（確定ミリ秒・確率・slot）は撮影した本番の取引の値を `renderAt` に渡す
- 決定性は「同じ入力 → 同じ SHA-256」で毎回確かめる（`render.mjs` は x264 を 1 スレッド・bitexact・メタデータ無しで書き出す）
- 音（効果音・BGM）が要る場面が増えたら、A を Docker で使うことを再検討する
- Remotion は使わない（従業員 4 人以上の会社では有償。比較の対象から外した）

## 再現手順

```bash
cd video && npm install
npm run render:playwright      # → prototypes/playwright/hook-playwright.mp4
npm run render:hyperframes     # → prototypes/hyperframes/hook-hyperframes.mp4

# 決定性の確認（2 回目を別名で書き出して比べる）
node prototypes/playwright/render.mjs /tmp/pw-2.mp4
shasum -a 256 prototypes/playwright/hook-playwright.mp4 /tmp/pw-2.mp4
diff <(ffmpeg -v error -i prototypes/playwright/hook-playwright.mp4 -f framemd5 -) <(ffmpeg -v error -i /tmp/pw-2.mp4 -f framemd5 -)
```

参考: Prompt Motion の作例（構造の参考のみ）— 時刻の純関数で描く https://prompt-motion.com/xelandre-363f00 ・ https://prompt-motion.com/parkerrex-1a54fe 、掴みの文字演出 https://prompt-motion.com/gdgtify-287ddf

## 実演の撮り方（2026-10-11・#56 の新しい画面）

### 結論

**1280×720 の画面を `deviceScaleFactor` 1.5 で描き、CDP の screencast で JPEG 画質 50 のコマを受け、時刻どおりに並べて lanczos で 1920×1080・60fps にする**（`video/capture/screencast.mjs`）。書き出しも 60fps。

### 比べたもの（本番の待機中の画面・SOL は使わない・各 3 回）

測ったのは「届いたコマの fps」と「実際に変化したコマの数（`mpdecimate=hi=128:lo=64:frac=0.1`）」。手元は仮想マシンが CPU を約 800% 使い、load average 20〜29 の高負荷のまま測った。

| 撮り方 | 結果 | 判断 |
|---|---|---|
| Playwright `recordVideo`（従来） | 25fps が上限。実際に変化したコマは約 24fps（標準の基準では約 10fps） | 不採用 |
| 画面録画（macOS `avfoundation` 60fps） | Chromium の窓が他のアプリの裏に隠れ、別のアプリの画面が写った | 撮影中に画面を明け渡す必要があり不採用 |
| screencast・通常表示（窓あり） | 約 50fps | 窓が出る分だけ劣る |
| **screencast・headless（新しいモード）** | 約 58fps | **採用** |

拡大の仕方（新しい 1 画面の HUD）：

| 拡大 | 結果 |
|---|---|
| CSS `zoom: 1.5`（従来） | ページが縦 1,620px にはみ出し、開始ボタンが画面外（y=1,164）。fps 9.7〜22 |
| 等倍（1920×1080 のレイアウト） | 全体は収まるが文字が小さい。画質 50 で 42.8〜49.5fps |
| **1280×720・`deviceScaleFactor` 1.5** | 全体が収まり文字も大きい。ただしコマは論理サイズ（1280×720）で届く |
| 1280×720・`--force-device-scale-factor=1.5` | 1920×1080 の実画素で届く。窓の高さを 807 にすると表示領域が 1280×720 になる。fps 18 / 18 / 46.8 とぶれる |

screencast の JPEG 画質（1280×720・`deviceScaleFactor` 1.5）：

| 画質 | fps（3 回） |
|---|---|
| 92 | 40 / 27.6 / 51 |
| 92 + GPU の起動オプション（`--use-angle=metal` など） | 37.1 / 50.7 / 42.9 |
| 70 | 56.9 / 49.6 / 42.6、52 / 52.6 / 54 |
| 70 + GPU | 54.7 / 55.9 / 45.9 |
| **50** | **55.7 / 55.5 / 56.2**（大きさの指定を外した回は 59.2） |

- 画質 50 でも、等倍で小さな文字（16 進の列・フッターの注記）まで崩れない。動画では VP9 → H.264 と 2 回圧縮し直すので差はさらに小さい
- 1280×720 を lanczos で 1.5 倍にした文字は、実画素で撮ったものよりわずかに柔らかいが十分に読める。高負荷の下で fps が安定する方を取った
- 本番の通し（お試し → hold → release）を採用した設定で撮ると、届いたコマ 48.2fps・実演の区間で実際に変化したコマ約 48fps（2026-10-11 09:58 UTC）
- 撮影の終わりに 45fps 未満なら警告を出す。重い処理（仮想マシンなど）を止めて撮れば、さらに上がる見込み（未計測）
