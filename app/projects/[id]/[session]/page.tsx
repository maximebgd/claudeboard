import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Sparkles } from "lucide-react";
import { getSession, type Block } from "@/lib/projects";
import { formatDate } from "@/lib/claude";
import { getT, type ServerI18n } from "@/lib/i18n";
import { tPlural } from "@/lib/i18n/core";
import Markdown from "@/components/Markdown";
import Collapsible from "@/components/Collapsible";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import { ResumeCommand } from "@/components/ResumeButton";
import FavoriteButton from "@/components/FavoriteButton";
import DeleteButton from "@/components/DeleteButton";
import ExportButton from "@/components/ExportButton";
import { readStore, isAllowed } from "@/lib/store";
import { favoriteKey } from "@/lib/favorites";

export const dynamic = "force-dynamic";

function BlockView({ block, t }: { block: Block; t: ServerI18n["t"] }) {
  switch (block.kind) {
    case "text":
      return <Markdown>{block.text}</Markdown>;
    case "thinking":
      return (
        <Collapsible label={t("block.thinking")} accent="#a78bfa">
          <div className="text-sm text-[var(--color-muted)] whitespace-pre-wrap">{block.text}</div>
        </Collapsible>
      );
    case "tool_use":
      return (
        <Collapsible label={t("block.tool", { name: block.name })} accent="#60a5fa">
          <pre className="text-xs text-[var(--color-muted)] overflow-x-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </Collapsible>
      );
    case "tool_result":
      return (
        <Collapsible
          label={block.isError ? t("block.toolResultError") : t("block.toolResult")}
          accent={block.isError ? "#f87171" : "#34d399"}
        >
          <pre className="text-xs text-[var(--color-muted)] whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
            {block.text}
          </pre>
        </Collapsible>
      );
  }
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string; session: string }>;
}) {
  const { id: rawId, session: rawSession } = await params;
  const id = decodeURIComponent(rawId);
  const sessionId = decodeURIComponent(rawSession);
  const [session, store, canDelete, { t, locale }] = await Promise.all([
    getSession(id, sessionId),
    readStore(),
    isAllowed("projects", "delete"),
    getT(),
  ]);
  if (!session) notFound();
  const favKey = favoriteKey(id, sessionId);
  const favorited = store.favorites.includes(favKey);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <Link
        href={`/projects/${encodeURIComponent(id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> {t("session.back")}
      </Link>

      <div className="mt-4 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{session.title}</h1>
          <ReadOnlyBadge />
          <FavoriteButton favoriteKey={favKey} initial={favorited} variant="labeled" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-faint)] font-mono">
          <span>{tPlural(t, "common.message", session.events.length)}</span>
          {session.gitBranch && <span>{t("session.branch", { branch: session.gitBranch })}</span>}
          {session.version && <span>v{session.version}</span>}
          <span>{sessionId}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ResumeCommand sessionId={sessionId} />
          <ExportButton scope="session" projectId={id} sessionId={sessionId} />
          <DeleteButton
            endpoint="/api/projects"
            body={{ scope: "session", projectId: id, sessionId }}
            label={t("session.delete")}
            title={t("session.deleteTitle")}
            description={t("session.deleteDesc")}
            confirmLabel={t("common.delete")}
            redirectTo={`/projects/${encodeURIComponent(id)}`}
            locked={!canDelete}
            detail={
              <div className="rounded-lg bg-[var(--color-inset)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)] font-mono">
                {sessionId}.jsonl
              </div>
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {session.events.map((ev) => {
          const isUser = ev.role === "user";
          return (
            <div key={ev.uuid} className="flex gap-3">
              <div
                className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${
                  isUser ? "bg-[var(--color-border)]" : "bg-[var(--color-accent)]/20"
                }`}
              >
                {isUser ? (
                  <User size={14} className="text-[var(--color-fg)]" />
                ) : (
                  <Sparkles size={14} className="text-[var(--color-accent)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] mb-1">
                  <span className="font-medium text-[var(--color-muted)]">
                    {isUser ? t("session.you") : "Claude"}
                  </span>
                  {ev.timestamp && <span>{formatDate(ev.timestamp, locale)}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {ev.blocks.map((b, i) => (
                    <BlockView key={i} block={b} t={t} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
