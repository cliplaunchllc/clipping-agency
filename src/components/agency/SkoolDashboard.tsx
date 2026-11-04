"use client";

import { useState, useCallback } from "react";
import { Copy, Check, RefreshCw, ExternalLink, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import SkoolResourcesDashboard, { SkoolAssetItem, SkoolCategory } from "./SkoolResourcesDashboard";

interface Props {
  initialItems: SkoolAssetItem[];
  initialCommunityName: string;
  initialPortalToken: string;
  initialCategories: SkoolCategory[];
  initialPortalDescription: string;
  baseUrl: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "6px 10px",
  outline: "none",
};

const btnStyle = (color = "var(--accent)"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 10px", borderRadius: "var(--radius-md)", fontSize: 12, fontWeight: 500,
  background: `color-mix(in srgb, ${color} 12%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  color, cursor: "pointer",
});

export default function SkoolDashboard({
  initialItems, initialCommunityName, initialPortalToken,
  initialCategories, initialPortalDescription, baseUrl,
}: Props) {
  const [communityName, setCommunityName] = useState(initialCommunityName);
  const [savedName, setSavedName] = useState(initialCommunityName);
  const [portalToken, setPortalToken] = useState(initialPortalToken);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [portalDescription, setPortalDescription] = useState(initialPortalDescription);
  const [savedDescription, setSavedDescription] = useState(initialPortalDescription);

  const [categories, setCategories] = useState<SkoolCategory[]>(initialCategories);
  const [newCat, setNewCat] = useState("");

  const portalUrl = `${baseUrl}/skool/${portalToken}`;

  const copyPortalUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [portalUrl]);

  async function saveCommunityName() {
    if (communityName.trim() === savedName) return;
    await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityName: communityName.trim() }),
    });
    setSavedName(communityName.trim());
  }

  async function regenerateToken() {
    if (!confirm("Regenerate the portal link? The old link will stop working immediately.")) return;
    setRegenerating(true);
    const res = await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateToken: true }),
    });
    const data = await res.json();
    setPortalToken(data.portalToken);
    setRegenerating(false);
  }

  async function savePortalDescription() {
    if (portalDescription === savedDescription) return;
    await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalDescription }),
    });
    setSavedDescription(portalDescription);
  }

  async function persistCategories(cats: SkoolCategory[]) {
    await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: cats }),
    });
  }

  function addCategory() {
    const trimmed = newCat.trim();
    if (!trimmed || categories.some((c) => c.name === trimmed)) return;
    const updated = [...categories, { name: trimmed, description: "" }];
    setCategories(updated);
    persistCategories(updated);
    setNewCat("");
  }

  function moveCategory(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const updated = [...categories];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setCategories(updated);
    persistCategories(updated);
  }

  function removeCategory(index: number) {
    const updated = categories.filter((_, i) => i !== index);
    setCategories(updated);
    persistCategories(updated);
  }

  const handleUpdateCategoryDescription = useCallback((name: string, description: string) => {
    const updated = categories.map((c) => c.name === name ? { ...c, description } : c);
    setCategories(updated);
    persistCategories(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  return (
    <div>
      {/* Portal settings banner */}
      <div className="px-8 pt-8 max-w-4xl mx-auto">
        <div className="rounded-xl p-4 mb-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>PORTAL SETTINGS</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            {/* Community name */}
            <div className="flex-1 min-w-48">
              <label className="text-xs mb-1 block" style={{ color: "var(--text-tertiary)" }}>Community name (shown to members)</label>
              <input
                style={{ ...inputStyle, width: "100%" }}
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                onBlur={saveCommunityName}
                placeholder="Member Resources"
              />
            </div>
            {/* Portal link */}
            <div className="flex-[2] min-w-64">
              <label className="text-xs mb-1 block" style={{ color: "var(--text-tertiary)" }}>Member portal link</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-1.5 rounded-md text-xs font-mono truncate"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}>
                  {portalUrl}
                </div>
                <button onClick={copyPortalUrl} style={btnStyle()}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={btnStyle("var(--text-secondary)")}>
                  <ExternalLink size={12} />
                  Open
                </a>
                <button onClick={regenerateToken} disabled={regenerating} style={btnStyle("var(--warning)")}>
                  <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
                  {regenerating ? "…" : "Regenerate"}
                </button>
              </div>
            </div>
          </div>

          {/* Portal description */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14, marginTop: 4 }}>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Portal Description <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(shown at the top of the member portal)</span>
            </label>
            <textarea
              className="w-full resize-none text-sm"
              style={{ ...inputStyle, minHeight: 56, width: "100%" }}
              value={portalDescription}
              onChange={(e) => setPortalDescription(e.target.value)}
              onBlur={savePortalDescription}
              placeholder="A short intro or welcome message for your Skool members…"
              rows={2}
            />
          </div>

          {/* Category management */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14, marginTop: 14 }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>CATEGORIES</p>
            <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
              Order here controls the order members see them. Category descriptions are editable inline below.
            </p>

            {categories.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {categories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="flex flex-col" style={{ gap: 1 }}>
                      <button
                        onClick={() => moveCategory(i, -1)}
                        disabled={i === 0}
                        style={{ ...btnStyle("var(--text-tertiary)"), padding: "2px 5px", opacity: i === 0 ? 0.3 : 1 }}
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        onClick={() => moveCategory(i, 1)}
                        disabled={i === categories.length - 1}
                        style={{ ...btnStyle("var(--text-tertiary)"), padding: "2px 5px", opacity: i === categories.length - 1 ? 0.3 : 1 }}
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                    <span className="flex-1 text-sm px-3 py-1.5 rounded-md"
                      style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                      {cat.name}
                    </span>
                    <button
                      onClick={() => removeCategory(i)}
                      style={{ ...btnStyle("var(--danger)"), padding: "5px 8px" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                placeholder="New category name…"
              />
              <button onClick={addCategory} style={btnStyle()}>
                <Plus size={12} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Flat resources */}
      <SkoolResourcesDashboard
        initialItems={initialItems}
        categories={categories}
        onUpdateCategoryDescription={handleUpdateCategoryDescription}
      />
    </div>
  );
}
