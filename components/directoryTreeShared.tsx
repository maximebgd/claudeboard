import type { ReactNode } from "react";

/*
 * Éléments partagés entre l'explorateur de structure (`DirectoryExplorer`) et ses
 * contenus par langue (`directoryTree.fr` / `directoryTree.en`). On y isole le type
 * de nœud, les badges, et les deux petits composants de rendu inline (`A` pour un
 * lien vers la doc officielle, `C` pour du code) afin que les fichiers d'arbre
 * n'aient à importer que ça et restent de purs jeux de données JSX.
 */

export const DOCS = "https://code.claude.com/docs";

/** Lien vers la doc officielle (ouvre dans un nouvel onglet). */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href.startsWith("http") ? href : `${DOCS}${href}`}
      target="_blank"
      rel="noreferrer"
      style={{
        color: "var(--ce-accent)",
        textDecoration: "none",
        borderBottom: "1px dotted var(--ce-accent)",
      }}
    >
      {children}
    </a>
  );
}

/** Code inline dans le corps des descriptions. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--ce-mono)",
        fontSize: "0.92em",
        padding: "1px 4px",
        borderRadius: "3px",
        background: "var(--ce-surface)",
        border: "0.5px solid var(--ce-border-subtle)",
      }}
    >
      {children}
    </code>
  );
}

export type BadgeKey = "committed" | "gitignored" | "local" | "autogen";

export type TreeNode = {
  id: string;
  label: string;
  type: "file" | "folder";
  icon: "md" | "json" | "folder";
  color: string;
  badge?: Exclude<BadgeKey, "autogen">;
  autogen?: boolean;
  oneLiner?: ReactNode;
  when?: ReactNode;
  note?: ReactNode;
  description?: ReactNode | ReactNode[];
  contains?: ReactNode[];
  tips?: ReactNode[];
  exampleIntro?: ReactNode;
  example?: string;
  docsLink?: string;
  children?: TreeNode[];
};
