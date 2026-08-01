// Bilingual (English / German) support for client-facing surfaces.
// Manager UI, staff notifications, and internal labels stay in English.
// Strings live in src/i18n/{en,de}.json under the `client` namespace so the
// whole app shares one translation source.

import { tFor, normalizeAppLang } from "@/i18n";

export type Lang = "en" | "de";

export function normalizeLang(x: unknown): Lang {
  return normalizeAppLang(x);
}

/** Return the German field when lang='de' and it's non-empty, otherwise the default. */
export function pickLocalized<T extends Record<string, any>>(
  item: T | null | undefined,
  lang: Lang,
  field: string,
): string {
  if (!item) return "";
  const en = (item[field] ?? "") as string;
  if (lang !== "de") return en;
  const de = (item[`${field}_de`] ?? "") as string;
  const deTrim = typeof de === "string" ? de.trim() : de;
  return deTrim ? de : en;
}

export function t(lang: Lang | string | null | undefined, key: string): string {
  return tFor(lang)(`client.${key}`) as string;
}
