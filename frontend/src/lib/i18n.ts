/**
 * Lightweight i18n utility (no external dependency required).
 *
 * Works by loading a flat key-value dictionary from JSON files at startup.
 * In production, switch to next-intl or react-i18next if more features are needed.
 *
 * Usage:
 *   import { t, setLocale, locale } from "@/lib/i18n";
 *
 *   // In component
 *   <span>{t("common.loading")}</span>
 *
 *   // Switch language
 *   setLocale("en");
 */

"use client";

import vi from "@/locales/vi.json";
import en from "@/locales/en.json";

type Messages = typeof vi;

const LOCALES: Record<string, Messages> = {
  vi,
  en,
};

export type Locale = "vi" | "en";

let currentLocale: Locale = "vi";

export function setLocale(locale: Locale) {
  currentLocale = locale;
  // Persist to localStorage so it survives page reloads.
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("locale", locale);
    } catch (_) {
      // ignore
    }
  }
}

export function getLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("locale");
    if (stored === "vi" || stored === "en") return stored;
  }
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const messages = LOCALES[currentLocale] || LOCALES.vi;
  let value = getNestedValue(messages, key);

  if (value === undefined) {
    // Fall back to Vietnamese if key missing in current locale.
    value = getNestedValue(LOCALES.vi, key);
  }

  if (value === undefined) {
    console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      value = value.replace(new RegExp(`{{${k}}}`, "g"), String(v));
    });
  }

  return value;
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const k of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[k];
  }
  return typeof current === "string" ? current : undefined;
}

export { currentLocale as locale };
