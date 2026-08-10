"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Synchronise l'état React avec la classe déjà posée par le script anti-FOUC.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    // Neutralise les transitions le temps du switch, puis les rétablit.
    root.classList.add("theme-switching");
    root.classList.toggle("light", next === "light");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage indisponible (mode privé) : on reste sur le choix en mémoire.
    }
    setTheme(next);
  }

  const isLight = theme === "light";
  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Passer en mode nuit" : "Passer en mode jour"}
      title={isLight ? "Mode nuit" : "Mode jour"}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] transition-colors"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
