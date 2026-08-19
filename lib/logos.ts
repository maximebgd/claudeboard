/**
 * Logos « clawd » disponibles dans `/public/logo`. Liste **isomorphe** (statique,
 * aucune lecture FS) : importable côté serveur (validation du store) comme côté
 * client (Sidebar, sélecteur de Préférences). Le nom stocké dans les préférences
 * est le **nom de fichier** seul ; `logoSrc` reconstruit le chemin public.
 */
export const LOGO_FILES = [
  "clawd.svg",
  "clawd-book.svg",
  "clawd-bubble.svg",
  "clawd-coffee.svg",
  "clawd-dizzy.svg",
  "clawd-happy.svg",
  "clawd-headphones.svg",
  "clawd-heart.svg",
  "clawd-lightbulb.svg",
  "clawd-magnifier.svg",
  "clawd-red.svg",
  "clawd-wand.svg",
] as const;

export type LogoFile = (typeof LOGO_FILES)[number];

/** Vrai si `x` est l'un des noms de fichier de logo connus. */
export function isLogoFile(x: unknown): x is LogoFile {
  return typeof x === "string" && (LOGO_FILES as readonly string[]).includes(x);
}

/** Nom de fichier → chemin public servi depuis `/public/logo`. */
export function logoSrc(file: string): string {
  return `/logo/${file}`;
}
