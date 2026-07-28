"use client";

import { useState, useEffect, useCallback } from "react";
import { t as translate, setLocale as setLocaleFn, getLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * useTranslation hook — wraps the global t() function in a React-friendly way.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   return <span>{t("common.loading")}</span>;
 */
export function useTranslation() {
  const [, forceUpdate] = useState(0);

  const refresh = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  useEffect(() => {
    const stored = getLocale();
    // Store initial locale
    if (stored !== "vi") {
      setLocaleFn(stored);
    }
  }, []);

  return {
    t: translate,
    locale: getLocale() as Locale,
    setLocale: (l: Locale) => {
      setLocaleFn(l);
      refresh();
    },
  };
}
