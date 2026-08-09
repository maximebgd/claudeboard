/**
 * Extraction défensive des raccourcis pour l'aperçu en lecture. Le format exact
 * de keybindings.json peut varier ; on gère les deux formes courantes :
 *   - un tableau : [ { key, command, ... }, ... ]
 *   - un objet avec une clé "keybindings" contenant ce tableau
 * On tolère les variantes de noms de champ (key/keys/binding, command/action).
 */
export interface Keybinding {
  key: string;
  command: string;
  when: string | null;
}

export function parseKeybindings(data: Record<string, unknown> | null): Keybinding[] {
  if (!data) return [];
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>).keybindings)
      ? ((data as Record<string, unknown>).keybindings as unknown[])
      : null;
  if (!arr) return [];

  const out: Keybinding[] = [];
  for (const b of arr) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const key = rec.key ?? rec.keys ?? rec.binding ?? rec.chord;
    const command = rec.command ?? rec.action ?? rec.name;
    out.push({
      key: typeof key === "string" ? key : JSON.stringify(key ?? ""),
      command: typeof command === "string" ? command : JSON.stringify(command ?? ""),
      when: typeof rec.when === "string" ? rec.when : null,
    });
  }
  return out;
}
