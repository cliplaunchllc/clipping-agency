"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Link2, FileBox, Copy, Check, ExternalLink } from "lucide-react";

export interface FreebieLink { id: string; label: string; url: string; order: number; }
export interface FreebieAsset { id: string; label: string; url: string; order: number; }
export interface FreebieItem {
  id: string; name: string; description: string | null; type: string;
  shareToken: string; order: number; links: FreebieLink[]; assets: FreebieAsset[];
  createdAt: string;
}

interface Props {
  initialFreebies: FreebieItem[];
  type: "freebie" | "skool";
  baseUrl: string;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);
  return { copied, copy };
}

const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: "1.25rem",
};

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

export default function FreebiesDashboard({ initialFreebies, type, baseUrl }: Props) {
  const [freebies, setFreebies] = useState<FreebieItem[]>(initialFreebies);
  const [creating, setCreating] = useState(false);
  const { copied, copy } = useCopy();

  const itemLabel = type === "skool" ? "Resource" : "Lead Magnet";
  const shareBase = `${baseUrl}/freebie`;

  async function createFreebie() {
    setCreating(true);
    const res = await fetch("/api/agency/freebies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name: `New ${itemLabel}` }),
    });
    const data = await res.json();
    setFreebies((prev) => [...prev, data]);
    setCreating(false);
  }

  async function deleteFreebie(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await fetch(`/api/agency/freebies/${id}`, { method: "DELETE" });
    setFreebies((prev) => prev.filter((f) => f.id !== id));
  }

  async function updateFreebie(id: string, patch: Partial<Pick<FreebieItem, "name" | "description">>) {
    const res = await fetch(`/api/agency/freebies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setFreebies((prev) => prev.map((f) => (f.id === id ? data : f)));
  }

  async function addLink(freebieId: string, label: string, url: string) {
    const res = await fetch(`/api/agency/freebies/${freebieId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, url }),
    });
    const link = await res.json();
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, links: [...f.links, link] } : f
    ));
  }

  async function removeLink(freebieId: string, linkId: string) {
    await fetch(`/api/agency/freebies/${freebieId}/links?linkId=${linkId}`, { method: "DELETE" });
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, links: f.links.filter((l) => l.id !== linkId) } : f
    ));
  }

  async function updateLink(freebieId: string, linkId: string, patch: { label?: string; url?: string }) {
    const res = await fetch(`/api/agency/freebies/${freebieId}/links`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: linkId, ...patch }),
    });
    const updated = await res.json();
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, links: f.links.map((l) => l.id === linkId ? updated : l) } : f
    ));
  }

  async function addAsset(freebieId: string, label: string, url: string) {
    const res = await fetch(`/api/agency/freebies/${freebieId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, url }),
    });
    const asset = await res.json();
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, assets: [...f.assets, asset] } : f
    ));
  }

  async function removeAsset(freebieId: string, assetId: string) {
    await fetch(`/api/agency/freebies/${freebieId}/assets?assetId=${assetId}`, { method: "DELETE" });
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, assets: f.assets.filter((a) => a.id !== assetId) } : f
    ));
  }

  async function updateAsset(freebieId: string, assetId: string, patch: { label?: string; url?: string }) {
    const res = await fetch(`/api/agency/freebies/${freebieId}/assets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assetId, ...patch }),
    });
    const updated = await res.json();
    setFreebies((prev) => prev.map((f) =>
      f.id === freebieId ? { ...f, assets: f.assets.map((a) => a.id === assetId ? updated : a) } : f
    ));
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {type === "skool" ? "Skool Resources" : "Lead Magnets"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {type === "skool"
              ? "Resources shared with your Skool community members"
              : "Shareable lead magnets — each gets its own public link"}
          </p>
        </div>
        <button onClick={createFreebie} disabled={creating} style={btnStyle()} className="transition-opacity">
          <Plus size={13} />
          {creating ? "Creating…" : `+ New ${itemLabel}`}
        </button>
      </div>

      {/* List */}
      {freebies.length === 0 ? (
        <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--border-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No {itemLabel.toLowerCase()}s yet</p>
          <button onClick={createFreebie} className="mt-3 text-xs" style={{ color: "var(--accent)" }}>
            + Create your first {itemLabel.toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {freebies.map((f) => (
            <FreebieCard
              key={f.id}
              freebie={f}
              shareUrl={`${shareBase}/${f.shareToken}`}
              copied={copied}
              onCopy={copy}
              onDelete={() => deleteFreebie(f.id)}
              onUpdateName={(name) => updateFreebie(f.id, { name })}
              onUpdateDescription={(description) => updateFreebie(f.id, { description })}
              onAddLink={(label, url) => addLink(f.id, label, url)}
              onRemoveLink={(linkId) => removeLink(f.id, linkId)}
              onUpdateLink={(linkId, patch) => updateLink(f.id, linkId, patch)}
              onAddAsset={(label, url) => addAsset(f.id, label, url)}
              onRemoveAsset={(assetId) => removeAsset(f.id, assetId)}
              onUpdateAsset={(assetId, patch) => updateAsset(f.id, assetId, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FreebieCard({
  freebie, shareUrl, copied, onCopy,
  onDelete, onUpdateName, onUpdateDescription,
  onAddLink, onRemoveLink, onUpdateLink,
  onAddAsset, onRemoveAsset, onUpdateAsset,
}: {
  freebie: FreebieItem;
  shareUrl: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  onUpdateDescription: (desc: string) => void;
  onAddLink: (label: string, url: string) => void;
  onRemoveLink: (id: string) => void;
  onUpdateLink: (id: string, patch: { label?: string; url?: string }) => void;
  onAddAsset: (label: string, url: string) => void;
  onRemoveAsset: (id: string) => void;
  onUpdateAsset: (id: string, patch: { label?: string; url?: string }) => void;
}) {
  const [name, setName] = useState(freebie.name);
  const [description, setDescription] = useState(freebie.description ?? "");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newAssetLabel, setNewAssetLabel] = useState("");
  const [newAssetUrl, setNewAssetUrl] = useState("");

  return (
    <div style={card}>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <input
          className="flex-1 text-base font-semibold bg-transparent border-none outline-none"
          style={{ color: "var(--text-primary)" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== freebie.name && onUpdateName(name.trim())}
          placeholder="Lead magnet name"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onCopy(shareUrl, freebie.id)}
            style={btnStyle("var(--accent)")}
            title="Copy share link"
          >
            {copied === freebie.id ? <Check size={12} /> : <Copy size={12} />}
            {copied === freebie.id ? "Copied!" : "Copy link"}
          </button>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={btnStyle("var(--text-secondary)")} title="Preview">
            <ExternalLink size={12} />
          </a>
          <button onClick={onDelete} style={btnStyle("var(--danger)")} title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Share link display */}
      <div className="mb-4 px-3 py-2 rounded-md text-xs font-mono truncate"
        style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}>
        {shareUrl}
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Description</label>
        <textarea
          className="w-full resize-none text-sm"
          style={{ ...inputStyle, minHeight: 72 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (freebie.description ?? "") && onUpdateDescription(description)}
          placeholder="Describe what's included in this lead magnet…"
          rows={3}
        />
      </div>

      {/* Links */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={13} style={{ color: "var(--text-secondary)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Links</span>
        </div>
        <div className="space-y-2 mb-2">
          {freebie.links.map((link) => (
            <LinkRow
              key={link.id}
              label={link.label}
              url={link.url}
              onUpdate={(patch) => onUpdateLink(link.id, patch)}
              onRemove={() => onRemoveLink(link.id)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Label" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} />
          <input style={{ ...inputStyle, flex: 2 }} placeholder="URL" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} />
          <button
            onClick={() => { if (newLinkLabel && newLinkUrl) { onAddLink(newLinkLabel, newLinkUrl); setNewLinkLabel(""); setNewLinkUrl(""); } }}
            style={btnStyle()}
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Assets */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileBox size={13} style={{ color: "var(--text-secondary)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Assets</span>
        </div>
        <div className="space-y-2 mb-2">
          {freebie.assets.map((asset) => (
            <LinkRow
              key={asset.id}
              label={asset.label}
              url={asset.url}
              onUpdate={(patch) => onUpdateAsset(asset.id, patch)}
              onRemove={() => onRemoveAsset(asset.id)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Label" value={newAssetLabel} onChange={(e) => setNewAssetLabel(e.target.value)} />
          <input style={{ ...inputStyle, flex: 2 }} placeholder="URL" value={newAssetUrl} onChange={(e) => setNewAssetUrl(e.target.value)} />
          <button
            onClick={() => { if (newAssetLabel && newAssetUrl) { onAddAsset(newAssetLabel, newAssetUrl); setNewAssetLabel(""); setNewAssetUrl(""); } }}
            style={btnStyle()}
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkRow({ label, url, onUpdate, onRemove }: {
  label: string; url: string;
  onUpdate: (patch: { label?: string; url?: string }) => void;
  onRemove: () => void;
}) {
  const [l, setL] = useState(label);
  const [u, setU] = useState(url);
  return (
    <div className="flex gap-2 items-center">
      <input style={{ ...inputStyle, flex: 1 }} value={l} onChange={(e) => setL(e.target.value)}
        onBlur={() => l !== label && onUpdate({ label: l })} placeholder="Label" />
      <input style={{ ...inputStyle, flex: 2 }} value={u} onChange={(e) => setU(e.target.value)}
        onBlur={() => u !== url && onUpdate({ url: u })} placeholder="URL" />
      <button onClick={onRemove} style={{ ...btnStyle("var(--danger)"), padding: "5px 8px" }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}
