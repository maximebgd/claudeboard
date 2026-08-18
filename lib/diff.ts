/**
 * Diff unifié **isomorphe** (aucune dépendance FS/DOM) pour le panneau Versions :
 * compare deux textes ligne à ligne et produit une liste de lignes façon `git diff`
 * (en-têtes de hunk `@@ -a,b +c,d @@`, lignes de contexte, ajouts `+`, retraits `-`).
 * L'algo est un LCS par programmation dynamique — largement suffisant pour des
 * fichiers de config (petits) ; on n'optimise pas pour de très gros fichiers.
 */

export type DiffKind = "hunk" | "context" | "add" | "del";

export interface DiffLine {
  kind: DiffKind;
  /** Texte de la ligne (sans préfixe) ; pour un hunk, l'en-tête complet. */
  text: string;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
}

type Op = { t: "eq" | "del" | "ins" };

/** Découpe en lignes en ignorant le saut de ligne final (comme git). */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const t = text.endsWith("\n") ? text.slice(0, -1) : text;
  return t.split("\n");
}

/** Séquence d'opérations (égalité / suppression / insertion) via LCS. */
function diffOps(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = longueur de la LCS de a[i..] et b[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: "eq" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: "del" });
      i++;
    } else {
      ops.push({ t: "ins" });
      j++;
    }
  }
  while (i < n) {
    ops.push({ t: "del" });
    i++;
  }
  while (j < m) {
    ops.push({ t: "ins" });
    j++;
  }
  return ops;
}

/**
 * Compare `oldText` → `newText` et renvoie les lignes du diff unifié, regroupées en
 * hunks avec `context` lignes de contexte de part et d'autre des changements. Un
 * résultat sans ajout ni retrait signifie des textes identiques (`lines` vide).
 */
export function unifiedDiff(oldText: string, newText: string, context = 3): DiffResult {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = diffOps(a, b);
  const nOps = ops.length;

  // Numéros de ligne (1-based) portés par chaque op selon son côté.
  const oldNo: number[] = new Array(nOps);
  const newNo: number[] = new Array(nOps);
  let oc = 0;
  let nc = 0;
  let added = 0;
  let removed = 0;
  for (let x = 0; x < nOps; x++) {
    const t = ops[x].t;
    if (t === "eq") {
      oldNo[x] = ++oc;
      newNo[x] = ++nc;
    } else if (t === "del") {
      oldNo[x] = ++oc;
      removed++;
    } else {
      newNo[x] = ++nc;
      added++;
    }
  }

  if (added === 0 && removed === 0) return { lines: [], added: 0, removed: 0 };

  // Une op est visible si elle est à ≤ context d'un changement ; les plages
  // visibles contiguës forment les hunks (fusion auto quand les contextes se touchent).
  const visible = new Array(nOps).fill(false);
  for (let x = 0; x < nOps; x++) {
    if (ops[x].t === "eq") continue;
    for (let d = -context; d <= context; d++) {
      const y = x + d;
      if (y >= 0 && y < nOps) visible[y] = true;
    }
  }

  const lines: DiffLine[] = [];
  let x = 0;
  while (x < nOps) {
    if (!visible[x]) {
      x++;
      continue;
    }
    // Étendre le hunk sur la plage visible contiguë.
    let end = x;
    while (end + 1 < nOps && visible[end + 1]) end++;

    let oldLen = 0;
    let newLen = 0;
    for (let k = x; k <= end; k++) {
      if (ops[k].t !== "ins") oldLen++;
      if (ops[k].t !== "del") newLen++;
    }
    // Début de hunk : 1er numéro présent, sinon la ligne précédente (côté vide).
    const oldStart = oldLen > 0 ? oldNo[firstWith(oldNo, x, end)] : fallbackNo(oldNo, x);
    const newStart = newLen > 0 ? newNo[firstWith(newNo, x, end)] : fallbackNo(newNo, x);
    lines.push({ kind: "hunk", text: `@@ -${oldStart},${oldLen} +${newStart},${newLen} @@` });

    for (let k = x; k <= end; k++) {
      const t = ops[k].t;
      const idx = t === "del" ? oldNo[k] - 1 : t === "ins" ? newNo[k] - 1 : oldNo[k] - 1;
      const text = t === "ins" ? b[newNo[k] - 1] : a[idx];
      lines.push({ kind: t === "del" ? "del" : t === "ins" ? "add" : "context", text });
    }
    x = end + 1;
  }

  return { lines, added, removed };
}

/** Premier index de [x..end] portant un numéro de ligne défini. */
function firstWith(nums: number[], x: number, end: number): number {
  for (let k = x; k <= end; k++) if (nums[k] !== undefined) return k;
  return x;
}

/** Numéro de repli quand un hunk n'a aucune ligne d'un côté (dernier avant, 0 si en tête). */
function fallbackNo(nums: number[], x: number): number {
  for (let k = x - 1; k >= 0; k--) if (nums[k] !== undefined) return nums[k];
  return 0;
}
