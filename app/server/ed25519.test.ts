import { describe, expect, it } from "vitest";
import { fromHex, toHex } from "./ed25519";

describe("fromHex / toHex", () => {
  it("往復する", () => expect(toHex(fromHex("00ff10ab"))).toBe("00ff10ab"));
  it("空文字は空の配列", () => expect([...fromHex("")]).toEqual([]));
  it("奇数桁・16 進以外は例外", () => {
    expect(() => fromHex("abc")).toThrow("invalid hex");
    expect(() => fromHex("zz")).toThrow("invalid hex");
  });
  it("大文字も読める", () => expect([...fromHex("FF")]).toEqual([255]));
});
