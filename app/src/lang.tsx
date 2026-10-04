import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { parseLang, translate, type Lang, type Msg, type Params } from "./i18n";

const LANG_KEY = "sokketsu.lang";

type LangValue = {
  lang: Lang;
  toggle: () => void;
  t: (k: string, p?: Params) => string;
  tm: (m: Msg) => string;
};

const LangContext = createContext<LangValue>({
  lang: "ja",
  toggle: () => {},
  t: (k, p) => translate("ja", k, p),
  tm: (m) => translate("ja", m.k, m.p),
});

function loadLang(): Lang {
  try {
    return parseLang(localStorage.getItem(LANG_KEY));
  } catch {
    return "ja";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(loadLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // 保存できなくても切り替え自体は効く
    }
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      toggle: () => setLang((l) => (l === "ja" ? "en" : "ja")),
      t: (k, p) => translate(lang, k, p),
      tm: (m) => translate(lang, m.k, m.p),
    }),
    [lang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => useContext(LangContext);
