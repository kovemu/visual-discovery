"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";

import {
  translations,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n/translations";

const EN_LOCALE: Locale = "en";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext =
  createContext<LanguageContextValue | null>(
    null,
  );

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setLocale = useCallback(
    (_next: Locale) => {
      // English-only public UI.
    },
    [],
  );

  const value = useMemo(
    () => ({
      locale: EN_LOCALE,
      setLocale,
      t: (key: TranslationKey) =>
        translations.en[key],
    }),
    [setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(
    LanguageContext,
  );

  if (!context) {
    throw new Error(
      "useTranslation must be used within LanguageProvider",
    );
  }

  return context;
}
