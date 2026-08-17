import type { Language } from "@/lib/store";
import { translations, type TranslationKey } from "./translations";

/**
 * Cœur i18n **isomorphe** (serveur et client). Ne doit importer que des types /
 * données statiques — surtout pas `fs` ni la lecture du store — pour rester
 * bundlable côté client. `lib/i18n.ts` (serveur) et `components/I18nProvider.tsx`
 * (client) réutilisent tous deux `translate` d'ici, afin que les deux runtimes ne
 * divergent jamais.
 */

export type { Language, TranslationKey };
export type TParams = Record<string, string | number>;

/** Remplace les `{var}` d'un gabarit par les paramètres fournis. */
function interpolate(s: string, params: TParams): string {
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

/**
 * Résout une clé de traduction pour une langue et interpole les paramètres.
 * Repli : entrée `fr`, puis la clé brute (jamais d'exception).
 */
export function translate(locale: Language, key: TranslationKey, params?: TParams): string {
  const raw = translations[locale]?.[key] ?? translations.fr[key] ?? key;
  return params ? interpolate(raw, params) : raw;
}

/**
 * Pluriel simple (FR/EN partagent ici la règle 1 vs. reste). Attend deux clés
 * appariées `<base>.one` / `<base>.other`. Injecte toujours `count` en paramètre.
 */
export function tPlural(
  t: (key: TranslationKey, params?: TParams) => string,
  base: string,
  count: number,
  params?: TParams
): string {
  const form = count === 1 ? "one" : "other";
  return t(`${base}.${form}` as TranslationKey, { count, ...params });
}
