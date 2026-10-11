// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "./test/dom";
import { LangProvider, useLang } from "./lang";

function Probe() {
  const { lang, t, toggle } = useLang();
  return (
    <button onClick={toggle} data-lang={lang}>
      {t("play.demo")}
    </button>
  );
}

afterEach(() => localStorage.clear());

describe("LangProvider", () => {
  it("保存が無ければ英語で始まり、html の lang も en", () => {
    const { getByRole } = render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(getByRole("button").textContent).toBe("Run the demo");
    expect(document.documentElement.lang).toBe("en");
  });
  it("切り替えると日本語になり、選んだ言語を覚える", () => {
    const { getByRole } = render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    act(() => getByRole("button").click());
    expect(getByRole("button").textContent).toBe("デモを流す");
    expect(document.documentElement.lang).toBe("ja");
    expect(localStorage.getItem("sokketsu.lang")).toBe("ja");
  });
  it("日本語を選んで保存してあれば日本語で始まる", () => {
    localStorage.setItem("sokketsu.lang", "ja");
    const { getByRole } = render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );
    expect(getByRole("button").getAttribute("data-lang")).toBe("ja");
  });
});
