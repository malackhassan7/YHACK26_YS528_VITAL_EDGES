import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { translations, type SupportedLanguage } from "./translations";

type TranslationDictionary = typeof translations["en"];

// Helper mapping snake_case keys to camelCase keys
const KEY_MAP: Record<string, keyof TranslationDictionary> = {
  nav_collector_home: "collectorHome",
  nav_my_lots: "myLots",
  nav_prices: "priceCatalog",
  nav_earnings: "earnings",
  nav_safety: "safetyCenter",
  nav_recycler_home: "recyclerHome",
  nav_admin_home: "adminHome",
  logout: "logout",
  offline_banner: "offline",
  collector_portal: "currentRole",
  collector_dashboard_title: "collectorDashboardTitle",
  collector_dashboard_subtitle: "collectorDashboardSubtitle",
  create_lot: "createLotCta",
  create_lot_desc: "collectorDashboardSubtitle",
  action_start: "createLotCta",
  action_view: "priceCatalog",
  action_manage: "myLots",
  price_catalog_title: "priceTitle",
  price_catalog_desc: "priceSubtitle",
  my_lots_title: "myLots",
  my_lots_desc: "viewLotsCta",
  earnings_title: "earningsTitle",
  earnings_desc: "earningsSubtitle",
  audio_pictorial_badge: "safetyCenter",
  listen_read: "listenAudio",
  safety_center_title: "safetyGuideCta",
  safety_center_desc: "safetySubtitle",
  offline_draft_notice: "offlineNotice"
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const defaultTranslate = (key: string, fallback?: string): string => {
  const mappedKey = (KEY_MAP[key] ?? key) as keyof TranslationDictionary;
  const enDict = translations.en as Record<string, string>;
  return enDict[mappedKey] || enDict[key] || fallback || key;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: defaultTranslate,
});

const STORAGE_KEY = "vital_edges_lang_pref";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage may be disabled
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useMemo(() => {
    return (key: string, fallback?: string): string => {
      const mappedKey = (KEY_MAP[key] ?? key) as keyof TranslationDictionary;
      const dict = translations[language] as Record<string, string>;
      const enDict = translations.en as Record<string, string>;
      return dict[mappedKey] || dict[key] || enDict[mappedKey] || enDict[key] || fallback || key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context || !context.t) {
    return {
      language: "en" as SupportedLanguage,
      setLanguage: () => {},
      t: defaultTranslate,
    };
  }
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg border border-emerald-200 bg-white p-0.5 shadow-sm text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          language === "en"
            ? "bg-emerald-700 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-label="Switch to English"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLanguage("hi")}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          language === "hi"
            ? "bg-emerald-700 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
        aria-label="Switch to Hindi (हिन्दी)"
      >
        हिन्दी
      </button>
    </div>
  );
}
