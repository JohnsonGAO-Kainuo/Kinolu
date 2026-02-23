"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import en, { type TranslationKeys } from "./locales/en";
import zhCN from "./locales/zh-CN";
import zhTW from "./locales/zh-TW";

export type Locale = "en" | "zh-CN" | "zh-TW";

const LOCALES: Record<Locale, Record<TranslationKeys, string>> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

export const LOCALE_LABELS: { key: Locale; label: string }[] = [
  { key: "en", label: "English" },
  { key: "zh-CN", label: "简体中文" },
  { key: "zh-TW", label: "繁體中文" },
];

const STORAGE_KEY = "kinolu_locale";

function detectDefaultLocale(): Locale {
  // Check localStorage first
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
  }
  // Detect from browser
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || "";
    if (lang.startsWith("zh")) {
      // zh-TW, zh-Hant → 繁體；otherwise → 简体
      if (lang.includes("TW") || lang.includes("HK") || lang.includes("Hant")) return "zh-TW";
      return "zh-CN";
    }
  }
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKeys, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectDefaultLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    // Update html lang attribute
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: TranslationKeys, vars?: Record<string, string>): string => {
      let str = LOCALES[locale]?.[key] ?? LOCALES.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, v);
        }
      }
      return str;
    },
    [locale]
  );

  // During SSR / hydration, always render with "en" to avoid mismatch.
  // After mount, the real locale kicks in.
  const value: I18nContextValue = {
    locale: mounted ? locale : "en",
    setLocale,
    t: mounted ? t : (key) => LOCALES.en[key] ?? key,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { TranslationKeys };
