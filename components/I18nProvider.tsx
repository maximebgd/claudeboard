"use client";

import { createContext, useContext, useMemo } from "react";
import { translate, type Language, type TParams, type TranslationKey } from "@/lib/i18n/core";

/**
 * Fournit la langue courante aux composants client. Seedé depuis la valeur lue
 * côté serveur dans `app/layout.tsx`. Après un changement de langue, `router.refresh()`
 * re-rend `layout.tsx`, qui relit le store et re-seed ce provider — tous les
 * consommateurs de `useTranslation()` se re-rendent dans la nouvelle langue.
 */

interface I18nValue {
  locale: Language;
  t: (key: TranslationKey, params?: TParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Language;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: (key, params) => translate(locale, key, params) }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Hook i18n pour les composants client (dans l'arbre de `I18nProvider`). */
export function useTranslation(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation doit être utilisé dans un I18nProvider");
  return ctx;
}
