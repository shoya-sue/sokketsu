import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 1 つが 500 kB を超えないよう、大きい依存を別のチャンクにする（どれも初回に並行して読む）。#77
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "web3", test: /node_modules[\\/]@solana[\\/]web3\.js[\\/]/ },
          ],
        },
      },
    },
  },
});
