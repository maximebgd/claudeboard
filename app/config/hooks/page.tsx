import Link from "next/link";
import { Webhook, Terminal } from "lucide-react";
import { getHooks, getHooksRaw } from "@/lib/hooks";
import { isAllowed } from "@/lib/store";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import ConfigEditor from "@/components/ConfigEditor";
import { getT } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";
import type { TranslationKey } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

/** Clé de traduction de la description de chaque event. */
const EVENT_DESC_KEY: Record<string, TranslationKey> = {
  PreToolUse: "hooks.evt.PreToolUse",
  PostToolUse: "hooks.evt.PostToolUse",
  UserPromptSubmit: "hooks.evt.UserPromptSubmit",
  Notification: "hooks.evt.Notification",
  Stop: "hooks.evt.Stop",
  SubagentStop: "hooks.evt.SubagentStop",
  PreCompact: "hooks.evt.PreCompact",
  SessionStart: "hooks.evt.SessionStart",
  SessionEnd: "hooks.evt.SessionEnd",
};

export default async function HooksPage() {
  const [{ events, totalHooks, sources }, canWrite, hooksRaw, { t }] = await Promise.all([
    getHooks(),
    isAllowed("hooks", "modify"),
    getHooksRaw(),
    getT(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Webhook size={22} className="text-[var(--color-accent)]" />
          {t("sidebar.hooks")}
        </h1>
        {!canWrite && <ReadOnlyBadge />}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {tPlural(t, "hooks.hook", totalHooks)} {t("hooks.on")} {tPlural(t, "hooks.event", events.length)}, {t("hooks.readSource")}
        {canWrite ? ` ${t("hooks.editHint")}` : ` ${t("hooks.readOnlyHint")}`}
      </p>
      <div className="mt-2 text-[11px] text-[var(--color-faint)] font-mono">
        {sources.map((s) => (
          <div key={s.file}>
            {s.path} {s.hasHooks ? `· ${t("hooks.hasHooks")}` : `· ${t("hooks.noHooks")}`}
          </div>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-muted)]">
          {t("hooks.emptyBefore")} <code className="rounded bg-[var(--color-code)] px-1.5 py-0.5">hooks</code> {t("hooks.emptyIn")}{" "}
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
                  {EVENT_DESC_KEY[ev.event] ? t(EVENT_DESC_KEY[ev.event]) : t("hooks.eventFallback")}
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
                        {m.matcher || t("hooks.matcherAll")}
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
        <h2 className="text-lg font-medium">{t("hooks.editTitle")}</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">{t("hooks.editDesc")}</p>
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
