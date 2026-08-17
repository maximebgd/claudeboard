import { getPreferences } from "@/lib/store";
import { translate, type Language, type TParams, type TranslationKey } from "@/lib/i18n/core";

/**
 * Accès i18n **côté serveur**. Les server components ne peuvent pas utiliser le
 * contexte React : ils appellent `await getT()`, qui lit la langue du store et
 * renvoie un `t` lié. Les pages sont déjà `async` et lisent déjà le store, donc
 * cela s'intègre au flux existant.
 */

export { translate };
export type { Language, TParams, TranslationKey };

export interface ServerI18n {
  locale: Language;
  t: (key: TranslationKey, params?: TParams) => string;
}

/** Lit la langue courante du store et renvoie `{ locale, t }`. */
export async function getT(): Promise<ServerI18n> {
  const { language } = await getPreferences();
  return {
    locale: language,
    t: (key, params) => translate(language, key, params),
  };
}
