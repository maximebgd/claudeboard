"use client";

import { useState } from "react";
import { Play, Check, Copy } from "lucide-react";

/** Commande CLI pour reprendre une session Claude Code. */
function resumeCommand(sessionId: string) {
  return `claude --resume ${sessionId}`;
}

async function copyToClipboard(text: string, onCopied: () => void) {
  try {
    await navigator.clipboard.writeText(text);
    onCopied();
  } catch {
    /* clipboard indisponible — on ignore */
  }
}

/**
 * Commande « claude --resume <sessionId> » affichée et copiable (même logique que
 * `CopyCommand` de PluginCatalog — l'exécution reste du ressort du CLI).
 */
export function ResumeCommand({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);
  const command = resumeCommand(sessionId);

  function copy() {
    copyToClipboard(command, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded bg-[var(--color-code)] px-2 py-1 font-mono text-xs text-[var(--color-muted)]">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        title="Copier la commande"
        className="flex items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-1 text-[10px] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "copié" : "copier"}
      </button>
    </div>
  );
}

/**
 * Bouton « Reprendre » : copie `claude --resume <sessionId>` dans le presse-papier
 * (même logique que `CopyCommand` de PluginCatalog — l'exécution reste du ressort du CLI).
 */
export default function ResumeButton({
  sessionId,
  className = "",
}: {
  sessionId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    copyToClipboard(resumeCommand(sessionId), () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copier « ${resumeCommand(sessionId)} »`}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors ${className}`}
    >
      {copied ? <Check size={13} /> : <Play size={13} />}
      {copied ? "copié" : "Reprendre"}
    </button>
  );
}
