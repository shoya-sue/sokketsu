import { defineConfig } from "vitest/config";

// テストは Node 環境で動かす（ブラウザ向けの polyfill は使わない）。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "functions/**/*.test.ts", "server/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // 画面とネットワーク呼び出しを除いた、判断・計算・API の層を対象にする。
      include: ["src/lib/**/*.ts", "src/judge.ts", "src/i18n.ts", "functions/**/*.ts", "server/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
