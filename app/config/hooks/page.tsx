import Link from "next/link";
import { Webhook, Terminal } from "lucide-react";
import { getHooks, getHooksRaw } from "@/lib/hooks";
import { isAllowed } from "@/lib/store";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import ConfigEditor from "@/components/ConfigEditor";

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
  const [{ events, totalHooks, sources }, canWrite, hooksRaw] = await Promise.all([
    getHooks(),
    isAllowed("hooks", "modify"),
    getHooksRaw(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Webhook size={22} className="text-[var(--color-accent)]" />
          Hooks
        </h1>
        {!canWrite && <ReadOnlyBadge />}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {totalHooks} hook{totalHooks > 1 ? "s" : ""} sur {events.length} event
        {events.length > 1 ? "s" : ""}, lus depuis settings.json + settings.local.json.
        {canWrite
          ? " Édite le bloc hooks de settings.json ci-dessous."
          : " Vue en lecture seule."}
      </p>
      <div className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {sources.map((s) => (
          <div key={s.file}>
            {s.path} {s.hasHooks ? "· contient des hooks" : "· pas de hooks"}
          </div>
        ))}
      </div>

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

      <section className="mt-10">
        <h2 className="text-lg font-medium">Éditer les hooks</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
          Objet <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5 font-mono text-[12px]">hooks</code>{" "}
          de <code className="font-mono text-[12px]">settings.json</code> (event → matchers).
          Ajouter, modifier ou supprimer un hook se fait ici. Un backup horodaté est créé à
          chaque écriture. Les hooks de{" "}
          <code className="font-mono text-[12px]">settings.local.json</code> ne sont pas touchés.
        </p>
        <ConfigEditor
          endpoint="/api/hooks"
          payload={{}}
          initialRaw={hooksRaw}
          mode="json"
          label="hooks (settings.json)"
          exists
          canWrite={canWrite}
        />
      </section>
    </div>
  );
}
