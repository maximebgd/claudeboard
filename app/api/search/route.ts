import { searchTranscripts } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * Recherche full-text **lecture seule** à travers tous les transcripts JSONL
 * (`~/.claude/projects`). Aucune écriture : hors du modèle de permissions.
 *
 *   /api/search?q=…&projectId=…&thinking=1&tools=1
 *
 * `thinking=1` inclut les blocs de réflexion de l'assistant, `tools=1` les
 * résultats d'outils. Par défaut, seuls les prompts et réponses (texte) sont scannés.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const projectId = searchParams.get("projectId") ?? undefined;
  const includeThinking = searchParams.get("thinking") === "1";
  const includeToolResults = searchParams.get("tools") === "1";

  if (projectId && (projectId.includes("/") || projectId.includes(".."))) {
    return new Response("Invalid project", { status: 400 });
  }

  try {
    const results = await searchTranscripts(q, {
      projectId,
      includeThinking,
      includeToolResults,
    });
    return Response.json(results);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return new Response(msg, { status: 500 });
  }
}
