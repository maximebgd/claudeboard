import Link from "next/link";
import { Webhook, Terminal } from "lucide-react";
import { getHooks } from "@/lib/hooks";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";

export const dynamic = "force-dynamic";

/** Courte description de chaque event pour situer quand il se déclenche. */
const EVENT_DESC: Record<string, string> = {
  PreToolUse: "Avant l'exécution d'un outil (peut bloquer l'appel).",
  PostToolUse: "Après l'exécution d'un outil.",
  UserPromptSubmit: "À l'envoi d'un prompt utilisateur.",
  Notification: "Sur les notifications de l'agent.",
  Stop: "Quand l'agent principal s'arrête.",
  SubagentStop: "Quand un sous-agent s'arrête.",
  PreCompact: "Avant une compaction du contexte.",
  SessionStart: "Au démarrage d'une session.",
  SessionEnd: "À la fin d'une session.",
};

export default async function HooksPage() {
  const { events, totalHooks, sources } = await getHooks();

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Webhook size={22} className="text-[var(--color-accent)]" />
          Hooks
        </h1>
        <ReadOnlyBadge />
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {totalHooks} hook{totalHooks > 1 ? "s" : ""} sur {events.length} event
        {events.length > 1 ? "s" : ""}, lus depuis settings.json + settings.local.json.
        Vue en lecture seule — modifie-les dans{" "}
        <Link href="/config/settings" className="text-[var(--color-accent)] underline">
          Settings
        </Link>
        .
      </p>

      {events.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
          Aucun hook configuré. Ajoute une clé <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5">hooks</code> dans{" "}
          <Link href="/config/settings" className="text-[var(--color-accent)] underline">
            settings.json
          </Link>
          .
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {events.map((ev) => (
            <div
              key={ev.event}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
            >
              <div className="flex items-baseline gap-2">
                <h2 className="font-semibold text-[var(--color-accent)]">{ev.event}</h2>
                <span className="text-xs text-[var(--color-muted)]">
                  {EVENT_DESC[ev.event] || "Event de hook."}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {ev.matchers.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <span className="text-[var(--color-muted)]">matcher</span>
                      <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 text-[var(--color-fg)]">
                        {m.matcher || "* (tous)"}
                      </code>
                      <span className="ml-auto text-[10px] text-[var(--color-faint)]">
                        {m.source}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {m.hooks.map((h, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <Terminal
                            size={13}
                            className="mt-1 shrink-0 text-[var(--color-faint)]"
                          />
                          <div className="min-w-0 flex-1">
                            <pre className="overflow-x-auto rounded bg-[var(--color-code)] p-2 font-mono text-[12px] text-[var(--color-fg)]">
                              {h.command || `(${h.type})`}
                            </pre>
                            <div className="mt-1 flex gap-2 text-[10px] text-[var(--color-faint)]">
                              <span>type: {h.type}</span>
                              {h.timeout != null && <span>· timeout: {h.timeout}s</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-[11px] text-[var(--color-faint)] font-mono">
        {sources.map((s) => (
          <div key={s.file}>
            {s.path} {s.hasHooks ? "· contient des hooks" : "· pas de hooks"}
          </div>
        ))}
      </div>
    </div>
  );
}
