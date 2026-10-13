import { Buffer } from "buffer";

// web3.js・anchor は Node の Buffer をグローバルにある前提で使う。main.tsx の最初に読み込む。
// vite-plugin-node-polyfills は ESM 版と CJS 版の Buffer を二重に束ねていたので使わない（#77）。
// @types/node の有無に依らず型が通るよう、globalThis に Buffer があるものとして書く（CI はルートの型を見ない）。
(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
