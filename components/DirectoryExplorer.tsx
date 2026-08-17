"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "@/components/I18nProvider";
import { DOCS, type BadgeKey, type TreeNode } from "./directoryTreeShared";
import {
  PROJECT_TREE as PROJECT_TREE_FR,
  GLOBAL_TREE as GLOBAL_TREE_FR,
} from "./directoryTree.fr";
import {
  PROJECT_TREE as PROJECT_TREE_EN,
  GLOBAL_TREE as GLOBAL_TREE_EN,
} from "./directoryTree.en";

/*
 * Explorateur interactif de la structure de `~/.claude` (global) et du
 * `.claude/` d'un projet. Reproduit la section « Explore the directory » de la
 * doc officielle (code.claude.com/docs/en/claude-directory) : arbre de fichiers
 * à gauche, panneau de détail à droite (rôle, moment de chargement, description,
 * astuces, exemple copiable, lien doc). Les couleurs sont mappées sur les tokens
 * de thème de l'app (`--color-*`) via des variables `--ce-*` locales, donc ça
 * suit le mode clair/sombre automatiquement.
 *
 * Le **contenu** des arbres est bilingue et externalisé (`directoryTree.fr` /
 * `directoryTree.en`, sélectionné selon la langue) ; le **chrome** (onglets,
 * libellés de sections, badges) passe par `useTranslation`. Le type `TreeNode`
 * et les helpers `A`/`C` vivent dans `directoryTreeShared`.
 */

const BADGE_STYLES: Record<BadgeKey, { bg: string; color: string; border: string }> = {
  committed: {
    bg: "rgba(85,138,66,0.08)",
    color: "var(--ce-badge-committed)",
    border: "rgba(85,138,66,0.15)",
  },
  gitignored: {
    bg: "rgba(217,119,87,0.06)",
    color: "var(--ce-badge-gitignored)",
    border: "rgba(217,119,87,0.15)",
  },
  local: {
    bg: "rgba(115,114,108,0.06)",
    color: "var(--ce-badge-local)",
    border: "rgba(115,114,108,0.12)",
  },
  autogen: {
    bg: "rgba(232,164,92,0.1)",
    color: "var(--ce-badge-autogen)",
    border: "rgba(232,164,92,0.2)",
  },
};

type FlatNode = TreeNode & {
  path: string[];
  parentId: string | null;
  root: "project" | "global";
};

const DEFAULT_EXPANDED = [
  "dot-claude",
  "rules",
  "skills",
  "skill-review",
  "commands",
  "agents",
  "agent-memory",
  "agent-memory-sub",
  "global-dot-claude",
  "global-output-styles",
  "global-projects",
  "memory-dir",
];

function renderIcon(icon: TreeNode["icon"], color: string, size = 14) {
  if (icon === "folder") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path
          d="M1.5 3.5a1 1 0 0 1 1-1h2.6l1 1.2h5.4a1 1 0 0 1 1 1v5.8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V3.5z"
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="1"
        />
      </svg>
    );
  }
  if (icon === "json") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="2" y="1.5" width="10" height="11" rx="1.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" />
        <text x="7" y="9" fontSize="6" fontFamily="monospace" fill={color} textAnchor="middle" fontWeight="700">
          {"{}"}
        </text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1.5" width="10" height="11" rx="1.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" />
      <line x1="4.5" y1="5" x2="9.5" y2="5" stroke={color} strokeWidth="1" />
      <line x1="4.5" y1="7" x2="9.5" y2="7" stroke={color} strokeWidth="1" />
      <line x1="4.5" y1="9" x2="8" y2="9" stroke={color} strokeWidth="1" />
    </svg>
  );
}

export default function DirectoryExplorer() {
  const { t, locale } = useTranslation();

  // Contenu de l'arbre selon la langue (repli français si autre chose que "en").
  const FILE_TREE = useMemo(
    () =>
      locale === "en"
        ? { project: PROJECT_TREE_EN, global: GLOBAL_TREE_EN }
        : { project: PROJECT_TREE_FR, global: GLOBAL_TREE_FR },
    [locale],
  );

  const allNodes = useMemo(() => {
    const acc: Record<string, FlatNode> = {};
    const flatten = (
      nodes: TreeNode[],
      path: string[],
      parentId: string | null,
      root: "project" | "global",
    ) => {
      for (const node of nodes) {
        const nextPath = [...path, node.label];
        acc[node.id] = { ...node, path: nextPath, parentId, root };
        if (node.children) flatten(node.children, nextPath, node.id, root);
      }
    };
    flatten(FILE_TREE.project.children ?? [], [FILE_TREE.project.label], null, "project");
    flatten(FILE_TREE.global.children ?? [], [FILE_TREE.global.label], null, "global");
    return acc;
  }, [FILE_TREE]);

  const allFolderIds = useMemo(
    () => Object.keys(allNodes).filter((id) => allNodes[id].type === "folder"),
    [allNodes],
  );

  const [activeRoot, setActiveRoot] = useState<"project" | "global">("project");
  const [selectedId, setSelectedId] = useState("claude-md");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(DEFAULT_EXPANDED),
  );
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  const selected = allNodes[selectedId];
  const tree = FILE_TREE[activeRoot];

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectNode = (n: TreeNode) => {
    setSelectedId(n.id);
    if (n.type === "folder" && !expandedFolders.has(n.id)) toggleFolder(n.id);
  };

  const switchRoot = (root: "project" | "global") => {
    if (root === activeRoot) return;
    setActiveRoot(root);
    const first = FILE_TREE[root].children?.[0];
    if (first) setSelectedId(first.id);
  };

  const visibleFolderIds = allFolderIds.filter((id) => allNodes[id].root === activeRoot);
  const allExpanded = visibleFolderIds.every((id) => expandedFolders.has(id));

  const toggleAllFolders = () => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      visibleFolderIds.forEach((id) => (allExpanded ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const onTreeKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const visible: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        visible.push(n.id);
        if (n.children && expandedFolders.has(n.id)) walk(n.children);
      }
    };
    walk(tree.children ?? []);
    const i = visible.indexOf(selectedId);
    if (i === -1) return;
    e.preventDefault();
    if (e.key === "ArrowDown" && i < visible.length - 1) {
      selectNode(allNodes[visible[i + 1]]);
    } else if (e.key === "ArrowUp" && i > 0) {
      selectNode(allNodes[visible[i - 1]]);
    } else if (e.key === "ArrowRight" && selected.type === "folder") {
      if (!expandedFolders.has(selectedId)) toggleFolder(selectedId);
      else if (selected.children && selected.children.length) selectNode(selected.children[0]);
    } else if (e.key === "ArrowLeft") {
      if (selected.type === "folder" && expandedFolders.has(selectedId)) toggleFolder(selectedId);
      else if (selected.parentId) selectNode(allNodes[selected.parentId]);
    }
  };

  const copyExample = (text: string) => {
    const done = () => {
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done, () => {});
    }
  };

  const iconBtn: React.CSSProperties = {
    width: 28,
    flexShrink: 0,
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: "var(--ce-text-4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const isFolder = node.type === "folder";
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedId === node.id;
    return (
      <div key={node.id}>
        <button
          role="treeitem"
          tabIndex={-1}
          onClick={() => selectNode(node)}
          aria-selected={isSelected}
          aria-expanded={isFolder ? isExpanded : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            width: "100%",
            padding: `4px 8px 4px ${8 + depth * 16}px`,
            background: isSelected ? "var(--ce-accent-bg)" : "transparent",
            border: "none",
            borderLeft: isSelected ? "2px solid var(--ce-accent)" : "2px solid transparent",
            outline: "none",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "var(--ce-mono)",
            fontSize: "13.5px",
            color: isSelected ? "var(--ce-accent)" : "var(--ce-text-2)",
            fontWeight: isSelected ? 550 : 400,
          }}
        >
          {isFolder ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              style={{
                fontSize: "14px",
                color: "var(--ce-text-4)",
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: "4px",
                marginLeft: "-6px",
                flexShrink: 0,
              }}
            >
              {isExpanded ? "▾" : "▸"}
            </span>
          ) : (
            <span style={{ width: "14px", flexShrink: 0 }} />
          )}
          {renderIcon(node.icon, node.color)}
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.label}
          </span>
          {node.badge && (
            <span
              title={t(`directory.badge.${node.badge}`)}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: BADGE_STYLES[node.badge].color,
                flexShrink: 0,
                opacity: 0.7,
              }}
            />
          )}
        </button>
        {isFolder && isExpanded && node.children && (
          <div role="group">{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const descriptionNodes = Array.isArray(selected.description)
    ? selected.description
    : selected.description
      ? [selected.description]
      : [];

  return (
    <>
      <style>{`
        .cb-explorer {
          --ce-mono: var(--font-mono);
          --ce-accent: var(--color-accent);
          --ce-accent-bg: var(--color-accent-soft);
          --ce-accent-border: var(--color-border);
          --ce-bg: var(--color-panel);
          --ce-surface: var(--color-code);
          --ce-surface-hover: var(--color-hover);
          --ce-border: var(--color-border);
          --ce-border-subtle: var(--color-border);
          --ce-text: var(--color-fg);
          --ce-text-2: var(--color-fg);
          --ce-text-3: var(--color-muted);
          --ce-text-4: var(--color-faint);
          --ce-sep: var(--color-faint);
          --ce-code-header: var(--color-inset);
          --ce-code-bg: #16150f;
          --ce-badge-committed: #6fa85c;
          --ce-badge-gitignored: #e08a60;
          --ce-badge-local: var(--color-muted);
          --ce-badge-autogen: #e8a45c;
          --ce-when-text: #7ba8d8;
        }
      `}</style>
      <div
        className="cb-explorer"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--ce-border)",
          background: "var(--ce-bg)",
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
          fontFamily: "var(--font-sans)",
        }}
      >
        {/* Colonne de l'arbre */}
        <div
          style={{
            width: "min(260px, 38%)",
            minWidth: "190px",
            flexShrink: 0,
            borderRight: "1px solid var(--ce-border-subtle)",
            background: "var(--ce-surface)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 8px 4px",
              borderBottom: "1px solid var(--ce-border-subtle)",
              display: "flex",
              gap: "4px",
            }}
          >
            {(["project", "global"] as const).map((root) => (
              <button
                key={root}
                onClick={() => switchRoot(root)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--ce-mono)",
                  fontSize: "11.5px",
                  background: activeRoot === root ? "var(--ce-accent-bg)" : "transparent",
                  color: activeRoot === root ? "var(--ce-accent)" : "var(--ce-text-4)",
                  fontWeight: activeRoot === root ? 600 : 430,
                }}
              >
                {t(root === "project" ? "directory.tab.project" : "directory.tab.global")}
              </button>
            ))}
            <button
              onClick={toggleAllFolders}
              title={t(allExpanded ? "directory.collapseAll" : "directory.expandAll")}
              style={{ ...iconBtn, fontSize: 11 }}
            >
              {allExpanded ? "⊟" : "⊞"}
            </button>
          </div>
          <div
            role="tree"
            aria-label={t("directory.treeLabel")}
            tabIndex={0}
            onKeyDown={onTreeKeyDown}
            style={{ padding: "6px 0", overflowY: "auto", flex: 1, outline: "none" }}
          >
            {(tree.children ?? []).map((node) => renderNode(node, 0))}
          </div>
        </div>

        {/* Panneau de détail */}
        <div style={{ flex: 1, minWidth: 0, padding: "20px 24px", minHeight: "440px", overflowY: "auto" }}>
          {/* Fil d'Ariane */}
          <div
            style={{
              fontFamily: "var(--ce-mono)",
              fontSize: "11px",
              color: "var(--ce-text-4)",
              marginBottom: "10px",
            }}
          >
            {selected.path.map((seg, i) => (
              <span key={i}>
                <span
                  style={{
                    color: i === selected.path.length - 1 ? "var(--ce-accent)" : "var(--ce-text-4)",
                  }}
                >
                  {seg.replace(/\/$/, "")}
                </span>
                {i < selected.path.length - 1 && <span style={{ color: "var(--ce-sep)" }}> / </span>}
              </span>
            ))}
          </div>

          {/* En-tête */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
            <span style={{ flexShrink: 0, display: "flex", marginTop: "2px" }}>
              {renderIcon(selected.icon, selected.color, 24)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "var(--ce-text)",
                  letterSpacing: "-0.3px",
                  lineHeight: "26px",
                }}
              >
                {selected.label}
              </div>
              {selected.oneLiner && (
                <div style={{ fontSize: "15px", color: "var(--ce-text-3)", marginTop: "3px" }}>
                  {selected.oneLiner}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              {([selected.autogen ? "autogen" : null, selected.badge] as (BadgeKey | null)[])
                .filter((k): k is BadgeKey => Boolean(k))
                .map((k) => {
                  const s = BADGE_STYLES[k];
                  return (
                    <span
                      key={k}
                      style={{
                        fontFamily: "var(--ce-mono)",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.3px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: s.bg,
                        color: s.color,
                        border: `0.5px solid ${s.border}`,
                      }}
                    >
                      {t(`directory.badge.${k}`)}
                    </span>
                  );
                })}
            </div>
          </div>

          {/* Note */}
          {selected.note && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                marginBottom: "14px",
                background: "rgba(217,119,87,0.06)",
                border: "1px solid rgba(217,119,87,0.2)",
                borderLeft: "3px solid var(--ce-accent)",
                fontSize: "15px",
                color: "var(--ce-text-2)",
                lineHeight: 1.6,
              }}
            >
              {selected.note}
            </div>
          )}

          {/* Quand ça charge */}
          {selected.when && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(106,155,204,0.06)",
                border: "0.5px solid rgba(106,155,204,0.12)",
                fontSize: "15px",
                color: "var(--ce-when-text)",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  opacity: 0.65,
                  marginBottom: "3px",
                }}
              >
                {t("directory.when")}
              </div>
              <div style={{ fontWeight: 500 }}>{selected.when}</div>
            </div>
          )}

          {/* Description */}
          {descriptionNodes.length > 0 && (
            <div style={{ fontSize: "16px", color: "var(--ce-text-2)", lineHeight: 1.65, marginBottom: "16px" }}>
              {descriptionNodes.map((para, i) => (
                <div key={i} style={{ marginBottom: i < descriptionNodes.length - 1 ? "12px" : 0 }}>
                  {para}
                </div>
              ))}
            </div>
          )}

          {/* Clés courantes */}
          {selected.contains && selected.contains.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ce-text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  marginBottom: "8px",
                }}
              >
                {t("directory.keys")}
              </div>
              {selected.contains.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "7px",
                    fontSize: "15px",
                    color: "var(--ce-text-2)",
                    lineHeight: 1.5,
                    marginBottom: "5px",
                  }}
                >
                  <span style={{ fontSize: "7px", color: "var(--ce-text-4)", marginTop: "6px" }}>●</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Astuces */}
          {selected.tips && selected.tips.length > 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "var(--ce-surface)",
                border: "1px solid var(--ce-border-subtle)",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ce-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  marginBottom: "6px",
                }}
              >
                {t("directory.tips")}
              </div>
              {selected.tips.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "7px",
                    fontSize: "14.5px",
                    color: "var(--ce-text-2)",
                    marginBottom: i < selected.tips!.length - 1 ? "5px" : 0,
                  }}
                >
                  <span style={{ fontSize: "7px", color: "var(--ce-accent)", marginTop: "6px" }}>●</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Exemple */}
          {selected.example && (
            <div style={{ marginBottom: "16px" }}>
              {selected.exampleIntro && (
                <div style={{ fontSize: "15px", color: "var(--ce-text-2)", lineHeight: 1.6, marginBottom: "10px" }}>
                  {selected.exampleIntro}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  background: "var(--ce-code-header)",
                  border: "1px solid var(--ce-border)",
                  borderRadius: "8px 8px 0 0",
                }}
              >
                <span style={{ fontFamily: "var(--ce-mono)", fontSize: "11px", fontWeight: 600, color: "var(--ce-text-3)" }}>
                  {selected.label}
                </span>
                <button
                  onClick={() => copyExample(selected.example!)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: copied ? "rgba(85,138,66,0.08)" : "var(--ce-code-header)",
                    border: copied ? "0.5px solid rgba(85,138,66,0.2)" : "0.5px solid var(--ce-border)",
                    color: copied ? "#558A42" : "var(--ce-text-3)",
                  }}
                >
                  {copied ? t("directory.copied") : t("directory.copy")}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  background: "var(--ce-code-bg)",
                  color: "#E8E6DC",
                  fontFamily: "var(--ce-mono)",
                  fontSize: "13px",
                  lineHeight: 1.65,
                  borderRadius: "0 0 8px 8px",
                  overflowX: "auto",
                  whiteSpace: "pre",
                }}
              >
                {selected.example}
              </pre>
            </div>
          )}

          {/* Lien doc */}
          {selected.docsLink && (
            <a
              href={`${DOCS}${selected.docsLink}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                padding: "5px 12px",
                borderRadius: "6px",
                background: "var(--ce-accent-bg)",
                border: "1px solid var(--ce-accent-border)",
                color: "var(--ce-accent)",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t("directory.docs")}
            </a>
          )}

          {/* Contenu du dossier */}
          {selected.children && selected.children.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ce-text-4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  marginBottom: "8px",
                }}
              >
                {t("directory.contains")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {selected.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => selectNode(child)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      width: "100%",
                      background: "var(--ce-surface)",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {renderIcon(child.icon, child.color, 13)}
                    <span style={{ fontFamily: "var(--ce-mono)", fontSize: "12px", color: "var(--ce-text-2)" }}>
                      {child.label}
                    </span>
                    {child.oneLiner && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--ce-text-4)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {child.oneLiner}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
