import { defineConfig } from "vitest/config";

// テストは Node 環境で動かす（ブラウザ向けの polyfill は使わない）。
// 画面の部品（*.test.tsx）はファイル先頭の `@vitest-environment jsdom` で jsdom にする。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "functions/**/*.test.ts", "server/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // 判断・計算・API の層に加え、チェーンとのやり取り（chain.ts）と画面の部品も対象にする（#4）。
      // App.tsx は全体の配線（ウォレット・devnet への送金）なので対象外。動きは tools/motion の実測で確かめる。
      include: [
        "src/lib/**/*.ts",
        "src/judge.ts",
        "src/i18n.ts",
        "src/chain.ts",
        "src/components/**/*.tsx",
        "src/hooks/**/*.ts",
        "functions/**/*.ts",
        "server/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
