"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  MessagesSquare,
  Brain,
  Wrench,
  User,
  Bot,
  ChevronRight,
} from "lucide-react";
import type { SearchResults, SearchMatch, MatchKind } from "@/lib/search";

const MIN_QUERY_LENGTH = 2;

const DIACRITIC = /[̀-ͯ]/g;

/** Repli aligné (mêmes index) : minuscule + accents ôtés — miroir de `lib/search.ts`. */
function fold(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const f = c.normalize("NFD").replace(DIACRITIC, "").toLowerCase();
    out += f.length === 1 ? f : c.toLowerCase();
  }
  return out;
}

/** Découpe un extrait en segments, en surlignant chaque occurrence de la requête. */
function highlight(snippet: string, query: string): React.ReactNode[] {
  const needle = fold(query.trim());
  if (!needle) return [snippet];
  const hay = fold(snippet);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < snippet.length) {
    const at = hay.indexOf(needle, i);
    if (at === -1) {
      out.push(snippet.slice(i));
      break;
    }
    if (at > i) out.push(snippet.slice(i, at));
    out.push(
      <mark
        key={key++}
        className="rounded bg-[var(--color-accent)]/25 px-0.5 text-[var(--color-fg)]"
      >
        {snippet.slice(at, at + needle.length)}
      </mark>,
    );
    i = at + needle.length;
  }
  return out;
}

const KIND_META: Record<MatchKind, { label: string; icon: typeof Brain }> = {
  text: { label: "Message", icon: MessagesSquare },
  thinking: { label: "Réflexion", icon: Brain },
  tool_result: { label: "Résultat d'outil", icon: Wrench },
};

function MatchRow({ match, query }: { match: SearchMatch; query: string }) {
  const meta = KIND_META[match.kind];
  const RoleIcon = match.role === "user" ? User : Bot;
  return (
    <div className="flex gap-2.5 border-t border-[var(--color-border)] px-4 py-2.5 text-sm">
      <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1 text-[var(--color-faint)]">
        <RoleIcon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--color-faint)]">
          <span>{match.role === "user" ? "Vous" : "Assistant"}</span>
          <span>·</span>
          <meta.icon size={11} />
          <span>{meta.label}</span>
        </div>
        <p className="leading-relaxed text-[var(--color-muted)]">
          {highlight(match.snippet, query)}
        </p>
      </div>
    </div>
  );
}

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [tools, setTools] = useState(false);
  const [data, setData] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (q: string, opts: { thinking: boolean; tools: boolean }) => {
      abortRef.current?.abort();
      if (q.trim().length < MIN_QUERY_LENGTH) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q });
        if (opts.thinking) params.set("thinking", "1");
        if (opts.tools) params.set("tools", "1");
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as SearchResults;
        setData(json);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Échec de la recherche");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Débounce sur la saisie et les filtres.
  useEffect(() => {
    const t = setTimeout(() => run(query, { thinking, tools }), 250);
    return () => clearTimeout(t);
  }, [query, thinking, tools, run]);

  const showEmpty =
    !loading && data && data.results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-8 mb-4 bg-[var(--color-bg)]/90 px-8 pb-3 pt-1 backdrop-blur">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans tous les transcripts…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] py-3 pl-11 pr-11 text-base text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          {loading && (
            <Loader2
              size={18}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-accent)]"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Toggle active={thinking} onClick={() => setThinking((v) => !v)} icon={Brain}>
            Réflexions
          </Toggle>
          <Toggle active={tools} onClick={() => setTools((v) => !v)} icon={Wrench}>
            Résultats d'outils
          </Toggle>
          {data && query.trim().length >= MIN_QUERY_LENGTH && (
            <span className="ml-auto text-xs text-[var(--color-faint)]">
              {data.totalMatches.toLocaleString("fr-FR")} correspondance
              {data.totalMatches > 1 ? "s" : ""} · {data.totalSessions} session
              {data.totalSessions > 1 ? "s" : ""} · {data.scannedFiles} fichiers scannés ·{" "}
              {data.elapsedMs} ms
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {query.trim().length < MIN_QUERY_LENGTH && !loading && (
        <p className="mt-16 text-center text-sm text-[var(--color-muted)]">
          Saisissez au moins {MIN_QUERY_LENGTH} caractères pour lancer la recherche.
        </p>
      )}

      {showEmpty && (
        <p className="mt-16 text-center text-sm text-[var(--color-muted)]">
          Aucun résultat pour «&nbsp;{query.trim()}&nbsp;».
        </p>
      )}

      <div className="flex flex-col gap-3">
        {data?.results.map((r) => (
          <div
            key={`${r.projectId}/${r.sessionId}`}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]"
          >
            <Link
              href={`/projects/${encodeURIComponent(r.projectId)}/${encodeURIComponent(r.sessionId)}`}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium group-hover:text-[var(--color-accent)]">
                  {r.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-[var(--color-muted)]">
                  {r.projectLabel}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--color-inset)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                {r.matchCount}
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-[var(--color-faint)] group-hover:text-[var(--color-fg)]"
              />
            </Link>
            {r.matches.map((m, i) => (
              <MatchRow key={i} match={m} query={query} />
            ))}
            {r.matchCount > r.matches.length && (
              <div className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-faint)]">
                + {r.matchCount - r.matches.length} autre
                {r.matchCount - r.matches.length > 1 ? "s" : ""} dans cette session
              </div>
            )}
          </div>
        ))}
      </div>

      {data?.truncated && (
        <p className="mt-4 text-center text-xs text-[var(--color-faint)]">
          Affichage des {data.results.length} sessions les plus récentes. Affinez votre
          recherche pour réduire les résultats.
        </p>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Brain;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      }`}
    >
      <Icon size={13} />
      {children}
    </button>
  );
}
