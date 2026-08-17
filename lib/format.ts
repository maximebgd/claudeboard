import type { Language } from "@/lib/store";

/**
 * Fabrique de formatteurs de nombres / monnaie **sensibles à la locale**. Les
 * constantes `Intl.NumberFormat` ne peuvent pas être déclarées en portée module
 * (elles figeraient la langue) : chaque appelant construit ses formatteurs pour la
 * locale courante. Serveur : `makeFormatters(locale)` après `await getT()`. Client :
 * `useMemo(() => makeFormatters(locale), [locale])`.
 */

function bcp(locale: Language): string {
  return locale === "en" ? "en-US" : "fr-FR";
}

export interface Formatters {
  /** Nombre entier, notation compacte au-delà de 10 000. */
  num: (n: number) => string;
  /** Montant en USD (`$12.34` en anglais, `12,34 $` en français). */
  usd: (n: number) => string;
  /** Nombre brut localisé (groupement de milliers). */
  int: (n: number) => string;
}

export function makeFormatters(locale: Language): Formatters {
  const tag = bcp(locale);
  const compact = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const full = new Intl.NumberFormat(tag);
  const en = locale === "en";
  return {
    num: (n) => (n >= 10000 ? compact.format(n) : full.format(n)),
    int: (n) => full.format(n),
    usd: (n) => {
      if (n > 0 && n < 0.01) return en ? "< $0.01" : "< 0,01 $";
      const amount = n.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return en ? `$${amount}` : `${amount} $`;
    },
  };
}
