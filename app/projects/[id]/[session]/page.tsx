import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Sparkles } from "lucide-react";
import { getSession, type Block } from "@/lib/projects";
import { formatDate } from "@/lib/claude";
import Markdown from "@/components/Markdown";
import Collapsible from "@/components/Collapsible";

export const dynamic = "force-dynamic";

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "text":
      return <Markdown>{block.text}</Markdown>;
    case "thinking":
      return (
        <Collapsible label="Réflexion" accent="#a78bfa">
          <div className="text-sm text-neutral-400 whitespace-pre-wrap">{block.text}</div>
        </Collapsible>
      );
    case "tool_use":
      return (
        <Collapsible label={`Outil : ${block.name}`} accent="#60a5fa">
          <pre className="text-xs text-neutral-400 overflow-x-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </Collapsible>
      );
    case "tool_result":
      return (
        <Collapsible
          label={block.isError ? "Résultat outil (erreur)" : "Résultat outil"}
          accent={block.isError ? "#f87171" : "#34d399"}
        >
          <pre className="text-xs text-neutral-400 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
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
  const session = await getSession(id, sessionId);
  if (!session) notFound();

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <Link
        href={`/projects/${encodeURIComponent(id)}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft size={15} /> Sessions
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-xl font-semibold">{session.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600 font-mono">
          <span>{session.events.length} messages</span>
          {session.gitBranch && <span>branche : {session.gitBranch}</span>}
          {session.version && <span>v{session.version}</span>}
          <span>{sessionId}</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {session.events.map((ev) => {
          const isUser = ev.role === "user";
          return (
            <div key={ev.uuid} className="flex gap-3">
              <div
                className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${
                  isUser ? "bg-neutral-700" : "bg-[var(--color-accent)]/20"
                }`}
              >
                {isUser ? (
                  <User size={14} className="text-neutral-300" />
                ) : (
                  <Sparkles size={14} className="text-[var(--color-accent)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 mb-1">
                  <span className="font-medium text-neutral-400">
                    {isUser ? "Vous" : "Claude"}
                  </span>
                  {ev.timestamp && <span>{formatDate(ev.timestamp)}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {ev.blocks.map((b, i) => (
                    <BlockView key={i} block={b} />
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
