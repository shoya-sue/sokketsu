import { describe, expect, it } from "vitest";
import { DICTIONARY, KEYS, KeyedError, describeError, msg, parseLang, translate } from "./i18n";

describe("辞書", () => {
  it("日本語と英語でキーがそろっている", () => {
    expect(Object.keys(DICTIONARY.en).sort()).toEqual([...KEYS].sort());
  });
  it("英語に空の訳が無い", () => {
    for (const k of KEYS) expect(DICTIONARY.en[k].trim(), k).not.toBe("");
  });
  it("両言語で差し込み名 {name} がそろっている", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of KEYS) expect(names(DICTIONARY.en[k]), k).toEqual(names(DICTIONARY.ja[k]));
  });
});

describe("translate", () => {
  it("言語ごとに訳す", () => {
    expect(translate("ja", "play.demo")).toBe("デモを流す");
    expect(translate("en", "play.demo")).toBe("Run the demo");
  });
  it("値を差し込む", () => {
    expect(translate("en", "result.speedup", { x: 15 })).toBe("About 15× faster than Tower BFT");
  });
  it("値が足りなければ {name} のまま残す", () => {
    expect(translate("ja", "result.speedup")).toBe("Tower BFT の約 {x}倍 速い");
  });
  it("未知のキーはそのまま返す", () => expect(translate("en", "no.such.key")).toBe("no.such.key"));
  it("@ で始まる値は文言キーとして訳す（言語を切り替えると差し込み値も変わる）", () => {
    expect(translate("en", "tl.sent", { label: "@label.release" })).toBe("Released to payee finalized");
    expect(translate("ja", "tl.sent", { label: "@label.release" })).toBe("受注者へ解放 finalized");
  });
});

describe("describeError", () => {
  it("KeyedError は値ごと訳す", () => {
    expect(describeError("en", new KeyedError("err.depositTx", { error: "x" }))).toBe(
      "Deposit transaction error x",
    );
  });
  it("Error のメッセージがキーなら訳す", () =>
    expect(describeError("en", new Error("err.keyLength"))).toBe("The secret key must be 64 bytes"));
  it("キーでない Error はそのまま", () => expect(describeError("ja", new Error("boom"))).toBe("boom"));
  it("Error でなければ文字列にする", () => expect(describeError("ja", 42)).toBe("42"));
});

describe("msg / parseLang", () => {
  it("msg はキーと値を持つ", () => expect(msg("a", { b: 1 })).toEqual({ k: "a", p: { b: 1 } }));
  it("既定は英語。ja を選んだときだけ日本語", () => {
    expect(parseLang("ja")).toBe("ja");
    expect(parseLang("en")).toBe("en");
    expect(parseLang(null)).toBe("en");
    expect(parseLang("fr")).toBe("en");
  });
});
