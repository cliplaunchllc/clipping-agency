"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Link2 } from "lucide-react";

function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return "https://" + t;
}

export interface SkoolAssetItem {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  assetId: string | null;
}

export interface SkoolCategory {
  name: string;
  description: string;
}

interface Props {
  initialItems: SkoolAssetItem[];
  categories: SkoolCategory[];
  onUpdateCategoryDescription: (name: string, description: string) => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "6px 10px",
  outline: "none",
  width: "100%",
};

const btnStyle = (color = "var(--accent)"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 10px", borderRadius: "var(--radius-md)", fontSize: 12, fontWeight: 500,
  background: `color-mix(in srgb, ${color} 12%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  color, cursor: "pointer",
});

export default function SkoolResourcesDashboard({ initialItems, categories, onUpdateCategoryDescription }: Props) {
  const [items, setItems] = useState<SkoolAssetItem[]>(initialItems);
  const [adding, setAdding] = useState<string | null>(null); // category name being added to

  async function addAsset(categoryName: string) {
    setAdding(categoryName);
    const res = await fetch("/api/agency/freebies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "skool", name: "", category: categoryName }),
    });
    const data = await res.json();
    const item: SkoolAssetItem = {
      id: data.id,
      name: data.name,
      description: data.description ?? "",
      category: data.category ?? "",
      url: data.assets?.[0]?.url ?? "",
      assetId: data.assets?.[0]?.id ?? null,
    };
    setItems((prev) => [...prev, item]);
    setAdding(null);
  }

  async function deleteAsset(id: string) {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    await fetch(`/api/agency/freebies/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const updateItem = useCallback((id: string, patch: Partial<SkoolAssetItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }, []);

  async function saveName(item: SkoolAssetItem, name: string) {
    if (name === item.name) return;
    await fetch(`/api/agency/freebies/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    updateItem(item.id, { name });
  }

  async function saveDescription(item: SkoolAssetItem, description: string) {
    if (description === item.description) return;
    await fetch(`/api/agency/freebies/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    updateItem(item.id, { description });
  }

  async function saveUrl(item: SkoolAssetItem, rawUrl: string) {
    const url = normalizeUrl(rawUrl);
    if (url === item.url) return;
    if (item.assetId) {
      await fetch(`/api/agency/freebies/${item.id}/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.assetId, url, label: item.name }),
      });
    } else {
      const res = await fetch(`/api/agency/freebies/${item.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: item.name, url }),
      });
      const asset = await res.json();
      updateItem(item.id, { url, assetId: asset.id });
      return;
    }
    updateItem(item.id, { url });
  }

  // Group items by category; use managed order; uncategorized last
  const categoryNames = categories.map((c) => c.name);
  const grouped: Record<string, SkoolAssetItem[]> = {};
  for (const cat of categoryNames) grouped[cat] = [];
  for (const item of items) {
    const key = item.category && categoryNames.includes(item.category) ? item.category : "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const hasUncategorized = (grouped[""] ?? []).length > 0;

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto space-y-10">
      {categories.map((cat) => (
        <CategorySection
          key={cat.name}
          category={cat}
          items={grouped[cat.name] ?? []}
          adding={adding === cat.name}
          onAdd={() => addAsset(cat.name)}
          onDelete={deleteAsset}
          onSaveName={saveName}
          onSaveDescription={saveDescription}
          onSaveUrl={saveUrl}
          onUpdateCategoryDescription={onUpdateCategoryDescription}
        />
      ))}

      {hasUncategorized && (
        <CategorySection
          key=""
          category={{ name: "", description: "" }}
          items={grouped[""] ?? []}
          adding={adding === ""}
          onAdd={() => addAsset("")}
          onDelete={deleteAsset}
          onSaveName={saveName}
          onSaveDescription={saveDescription}
          onSaveUrl={saveUrl}
          onUpdateCategoryDescription={() => {}}
          isUncategorized
        />
      )}

      {categories.length === 0 && items.length === 0 && (
        <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--border-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Add categories above to get started</p>
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category, items, adding, onAdd, onDelete,
  onSaveName, onSaveDescription, onSaveUrl,
  onUpdateCategoryDescription, isUncategorized,
}: {
  category: SkoolCategory;
  items: SkoolAssetItem[];
  adding: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onSaveName: (item: SkoolAssetItem, name: string) => void;
  onSaveDescription: (item: SkoolAssetItem, description: string) => void;
  onSaveUrl: (item: SkoolAssetItem, url: string) => void;
  onUpdateCategoryDescription: (name: string, description: string) => void;
  isUncategorized?: boolean;
}) {
  const [catDesc, setCatDesc] = useState(category.description);

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {isUncategorized ? "Uncategorized" : category.name}
        </h2>
        <button
          onClick={onAdd}
          disabled={adding}
          style={btnStyle()}
        >
          <Plus size={12} />
          {adding ? "Adding…" : "Add Asset"}
        </button>
      </div>

      {/* Category description — editable inline */}
      {!isUncategorized && (
        <textarea
          className="w-full resize-none text-sm mb-4"
          style={{ ...inputStyle, minHeight: 40, color: catDesc ? "var(--text-secondary)" : undefined }}
          value={catDesc}
          onChange={(e) => setCatDesc(e.target.value)}
          onBlur={() => onUpdateCategoryDescription(category.name, catDesc)}
          placeholder="Category description (shown on the portal)…"
          rows={2}
        />
      )}

      {/* Asset rows */}
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              onDelete={() => onDelete(item.id)}
              onSaveName={(name) => onSaveName(item, name)}
              onSaveDescription={(desc) => onSaveDescription(item, desc)}
              onSaveUrl={(url) => onSaveUrl(item, url)}
            />
          ))}
        </div>
      ) : !adding && (
        <p className="text-xs py-3 pl-1" style={{ color: "var(--text-tertiary)" }}>No assets yet — click Add Asset</p>
      )}
    </div>
  );
}

function AssetRow({
  item, onDelete, onSaveName, onSaveDescription, onSaveUrl,
}: {
  item: SkoolAssetItem;
  onDelete: () => void;
  onSaveName: (name: string) => void;
  onSaveDescription: (desc: string) => void;
  onSaveUrl: (url: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [url, setUrl] = useState(item.url);
  const [desc, setDesc] = useState(item.description);

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "10px 12px",
    }}>
      <div className="flex gap-2 items-center mb-2">
        <input
          style={{ ...inputStyle, flex: 1, fontWeight: 500 }}
          placeholder="Asset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onSaveName(name.trim())}
        />
        <button onClick={onDelete} style={{ ...btnStyle("var(--danger)"), padding: "5px 8px", flexShrink: 0 }}>
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex gap-2 items-center mb-2">
        <Link2 size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
        <input
          style={{ ...inputStyle, fontSize: 12, color: "var(--text-secondary)" }}
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => onSaveUrl(url)}
        />
      </div>
      <textarea
        className="w-full resize-none"
        style={{ ...inputStyle, fontSize: 12, minHeight: 32, color: "var(--text-secondary)" }}
        placeholder="Description (optional)…"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => onSaveDescription(desc)}
        rows={1}
      />
    </div>
  );
}
