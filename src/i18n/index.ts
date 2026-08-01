import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./en.json";
import de from "./de.json";

export type AppLang = "en" | "de";
export const SUPPORTED_LANGS: AppLang[] = ["en", "de"];
const STORAGE_KEY = "app_lang";

export function normalizeAppLang(x: unknown): AppLang {
  return x === "de" ? "de" : "en";
}

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

/** Preferred UI language of the staff member (localStorage, per device). */
export function readStoredLang(): AppLang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "de" || stored === "en") return stored;
  return window.navigator?.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

export function setAppLanguage(lang: AppLang) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
  void i18next.changeLanguage(lang);
}

/** Apply the stored preference after hydration (avoids SSR markup mismatch). */
export function applyStoredLanguage() {
  const lang = readStoredLang();
  if (i18next.language !== lang) void i18next.changeLanguage(lang);
}

/** Translate in a fixed language — used for client-facing docs and emails. */
export function tFor(lang: AppLang | string | null | undefined) {
  return i18next.getFixedT(normalizeAppLang(lang));
}

export { useTranslation };
export default i18next;
