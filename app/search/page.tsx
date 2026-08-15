import { Search } from "lucide-react";
import ReadOnlyBadge from "@/components/ReadOnlyBadge";
import SearchView from "@/components/SearchView";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Search size={22} className="text-[var(--color-accent)]" />
          Recherche
        </h1>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Recherche full-text à travers tous les transcripts (prompts &amp; réponses) —
        casse et accents ignorés.
      </p>

      <div className="mt-6">
        <SearchView />
      </div>
    </div>
  );
}
