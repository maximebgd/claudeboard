import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { listDocs } from "@/lib/docs";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DocsIndexPage() {
  const { t, locale } = await getT();
  const docs = await listDocs(locale);
  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <BookOpen size={22} className="text-[var(--color-accent)]" />
        {t("sidebar.docs")}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{t("docsIndex.subtitle")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-hover)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{doc.title}</span>
              <ArrowRight
                size={16}
                className="text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]"
              />
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{doc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
