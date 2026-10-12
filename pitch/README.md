# 提出資料（#64）

Colosseum のハッカソンに出す資料。提出フォームの文面と、持ち主が埋める項目は `SUBMISSION.md`。

| ファイル | 中身 |
|---|---|
| `sokketsu-deck.pdf` | 発表用スライド（10 ページ・16:9）。`slides.html?deck=pitch&print` を PDF にしたもの |
| `sokketsu-demo.mp4` | デモ動画（56 秒・実画面だけ：本番の画面 + Solana Explorer の実際の取引）。Colosseum のフォームの「demo video」欄用。`node pitch/build.mjs demo` |
| `SUBMIT-CHECKLIST.md` | 提出当日の手順（アップロード → フォーム → 提出） |
| `sokketsu-tech-demo.mp4` | 技術デモ動画（154.6 秒・1920×1080・60fps・英語ナレーション）。技術スライド + ピッチ動画の実演の場面 |
| `slides.html` | スライドの元。ブラウザで開くと 1 枚ずつ表示（← → / クリックで送る、`#3` で 3 枚目）。`?deck=tech` で技術デモ用の組 |
| `assets/logo-1024.png` | 提出用のロゴ（1024×1024・透過） |
| `assets/og-en-1200x630.png` | 提出用の英語のバナー（`tools/brand/og.html` の文言だけ英語にしたもの） |
| `assets/cover-1920x1080.png` | スライドの表紙（グラデーションつき） |
| `assets/demo-*.jpg` | スライドに載せた本番の画面（`video/capture/out/screen.webm` から切り出し） |
| `SUBMISSION.md` | 提出フォームの英語の文面と、提出前にやること |
| `YOUTUBE.md` | YouTube に載せるタイトル・説明文・章立て・タグ |
| `thumbnails.html`・`assets/youtube-thumb-*.jpg` | YouTube のサムネイル（1280×720・2 MB 以下）。`?v=pitch` / `?v=tech` |

## 作り直す

数値（確定ミリ秒・確率・slot・取引 ID）はすべて `video/capture/out/run.json` から入る。発表動画を撮り直したら、これも作り直す。

```sh
cd video && npm install                    # Playwright は video/ の依存を使う
cd .. && node pitch/build.mjs              # PDF・ロゴ・画像・技術デモ動画（pdf / logo / graphics / thumbs / tech を個別にも指定できる）
# 画面を撮り直したときは、スライドの画面も切り出し直す
ffmpeg -ss <秒> -i video/capture/out/screen.webm -frames:v 1 -q:v 3 pitch/assets/demo-hold.jpg
```

- 技術デモ動画は `video/sokketsu-pitch.timeline.json`（`render.mjs` が書く）から実演の場面を切り出すので、先に発表動画を書き出す
- 3 分を超えると `build.mjs` が失敗で終わる
- PDF では文字のグラデーションを単色にしている（Chrome の PDF 書き出しは `background-clip: text` の箱の縁を線として描くため）。画面と動画はグラデーションのまま
- `slides.html` を直接開くと `run.json` を読めない（file://）。`npx serve .` などでリポジトリの直下を配って開く
