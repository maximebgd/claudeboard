import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Texte brut d'un nœud de rendu (récursif) → sert à dériver l'ancre d'un titre. */
function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children);
  return "";
}

/**
 * Slug d'ancre déterministe (accents ôtés, ponctuation retirée, espaces → tirets) —
 * façon GitHub mais ramené à l'ASCII pour un `href` sans encodage. Doit rester
 * cohérent avec les liens internes qui pointent vers une section (ex. le bandeau des
 * limites d'usage → `#limites-dusage-fenetres-5-h-7-j`).
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Titre auto-ancré : reçoit un `id` dérivé de son texte (liens profonds vers section). */
function heading(Tag: "h1" | "h2" | "h3" | "h4") {
  return function Heading({ children }: { children?: ReactNode }) {
    return <Tag id={slugifyHeading(nodeText(children))}>{children}</Tag>;
  };
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-claude text-[15px] text-[var(--color-fg)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ h1: heading("h1"), h2: heading("h2"), h3: heading("h3"), h4: heading("h4") }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
