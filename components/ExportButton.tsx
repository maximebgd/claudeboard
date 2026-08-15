"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, FileCode, ChevronDown } from "lucide-react";

interface Props {
  scope: "session" | "project";
  projectId: string;
  sessionId?: string;
  /** Libellé du bouton (défaut « Exporter »). */
  label?: string;
}

/**
 * Bouton d'export **lecture seule** d'une session ou d'un projet en Markdown/HTML.
 * Déclenche un téléchargement direct via `/api/export` (rien n'est écrit dans
 * ~/.claude). Menu déroulant pour choisir le format.
 */
export default function ExportButton({ scope, projectId, sessionId, label = "Exporter" }: Props) {
  const [open, setOpen] = useState(false);
  const [includeStats, setIncludeStats] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const isProject = scope === "project";

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function href(format: "md" | "html") {
    const params = new URLSearchParams({ scope, projectId, format });
    if (sessionId) params.set("sessionId", sessionId);
    if (isProject && !includeStats) params.set("stats", "0");
    return `/api/export?${params.toString()}`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Exporter en Markdown ou HTML"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        <Upload size={14} /> {label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] shadow-lg">
          {isProject && (
            <label className="flex cursor-pointer items-start gap-2 border-b border-[var(--color-border)] px-3 py-2.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-inset)]">
              <input
                type="checkbox"
                checked={includeStats}
                onChange={(e) => setIncludeStats(e.target.checked)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Inclure les statistiques
                <span className="mt-0.5 block text-[10px] leading-tight text-[var(--color-faint)]">
                  KPI, tokens in/out, modèles, outils &amp; skills
                </span>
              </span>
            </label>
          )}
          <a
            href={href("md")}
            download
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-fg)] hover:bg-[var(--color-inset)]"
          >
            <FileText size={14} className="text-[var(--color-accent)]" />
            Markdown (.md)
          </a>
          <a
            href={href("html")}
            download
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-fg)] hover:bg-[var(--color-inset)] border-t border-[var(--color-border)]"
          >
            <FileCode size={14} className="text-[var(--color-accent)]" />
            HTML (.html)
          </a>
        </div>
      )}
    </div>
  );
}
