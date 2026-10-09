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
