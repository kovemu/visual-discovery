"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LOCALE_STORAGE_KEY,
  translations,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n/translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext =
  createContext<LanguageContextValue | null>(
    null,
  );

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const stored = localStorage.getItem(
      LOCALE_STORAGE_KEY,
    );

    if (stored === "ko" || stored === "en") {
      return stored;
    }
  } catch {
    // ignore
  }

  return navigator.language.startsWith("ko")
    ? "ko"
    : "en";
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] =
    useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);

      try {
        localStorage.setItem(
          LOCALE_STORAGE_KEY,
          next,
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) =>
        translations[locale][key],
    }),
    [locale, setLocale],
  );

  if (!ready) {
    return (
      <LanguageContext.Provider
        value={value}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

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
