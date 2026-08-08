"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function Collapsible({
  label,
  accent,
  children,
  defaultOpen = false,
}: {
  label: string;
  accent?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-inset)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-[var(--color-hover)]"
        style={accent ? { color: accent } : undefined}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {label}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
