"use client";

import { useState } from "react";
import { Plus, Trash2, ExternalLink, BookOpen, X, Users2, Star, Briefcase, Headphones, Zap, Globe, Lock } from "lucide-react";

interface Sop {
  id: string;
  title: string;
  url: string;
  category: string;
  order: number;
  createdAt: string;
}

interface Props {
  initialSops: Sop[];
  canEdit: boolean;
  /** If set, only show this role's SOPs + General (team member view) */
  teamRole?: string | null;
}

const RED = "#FF3B3B";
const RED_BG = "rgba(255,59,59,0.08)";
const RED_BORDER = "rgba(255,59,59,0.25)";

// Role-based SOP categories — map 1:1 with team payment roles
const ROLE_CATEGORIES = [
  { id: "internal",         label: "Internal SOPs & Processes",      description: "Agency admin only — not visible to team members", icon: Lock,      color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "general",          label: "General",                        description: "Applies to all team members",                    icon: Globe,     color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "head_campaign",    label: "Head of Campaign Management",    description: "",                                               icon: Star,      color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "campaign_manager", label: "Campaign Managers",              description: "",                                               icon: Briefcase, color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "va",               label: "VAs",                            description: "",                                               icon: Headphones,color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "discord_mod",      label: "Discord Moderators",             description: "",                                               icon: Users2,    color: RED, bg: RED_BG, border: RED_BORDER },
  { id: "freelance",        label: "Freelance Work",                 description: "",                                               icon: Zap,       color: RED, bg: RED_BG, border: RED_BORDER },
];

const ROLE_LABELS: Record<string, string> = {
  head_campaign:    "Head of Campaign Management",
  campaign_manager: "Campaign Manager",
  va:               "VA",
  discord_mod:      "Discord Moderator",
  freelance:        "Freelance",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  outline: "none",
};

export default function SopsDashboard({ initialSops, canEdit, teamRole }: Props) {
  const [sops, setSops] = useState<Sop[]>(initialSops);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ title: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", url: "" });

  // Team member: only their role + general. head_campaign also sees campaign_manager. Admin: all.
  const visibleCategories = teamRole
    ? ROLE_CATEGORIES.filter((c) =>
        c.id === "general" ||
        c.id === teamRole ||
        (teamRole === "head_campaign" && c.id === "campaign_manager")
      )
    : ROLE_CATEGORIES;

  function openAdd(categoryId: string) {
    setAddingCategory(categoryId);
    setAddForm({ title: "", url: "" });
    setEditingId(null);
  }

  function closeAdd() {
    setAddingCategory(null);
  }

  async function handleAdd(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    if (!addForm.title.trim() || !addForm.url.trim()) return;
    setSaving(true);
    const res = await fetch("/api/agency/sops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: addForm.title, url: addForm.url, category: categoryId }),
    });
    if (res.ok) {
      const sop = await res.json();
      setSops((prev) => [...prev, sop]);
      closeAdd();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/agency/sops/${id}`, { method: "DELETE" });
    if (res.ok) setSops((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  function startEdit(sop: Sop) {
    setEditingId(sop.id);
    setEditForm({ title: sop.title, url: sop.url });
    setAddingCategory(null);
  }

  async function handleEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/agency/sops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditingId(null);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen size={20} style={{ color: "var(--accent)" }} />
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            SOPs
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {teamRole
            ? `Showing SOPs for ${ROLE_LABELS[teamRole] ?? teamRole} and General.`
            : "Standard operating procedures organized by team role."}
        </p>
      </div>

      {/* No role set — team member prompt */}
      {!canEdit && !teamRole && (
        <div className="rounded-xl px-5 py-4 mb-8"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#f59e0b" }}>Role not set</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Go to <strong>Settings → Security</strong> and select your role to see your relevant SOPs.
          </p>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-8">
        {visibleCategories.map((cat) => {
          const catSops = sops.filter((s) => s.category === cat.id);
          const isAdding = addingCategory === cat.id;
          const Icon = cat.icon;
          const hasDivider = catSops.length > 0 || isAdding;
          const isMyRole = teamRole && cat.id === teamRole;

          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${isMyRole ? "rgba(250,204,21,0.35)" : "var(--border-default)"}`, background: "var(--bg-surface)" }}>

              {/* Category header */}
              <div className="px-6 py-5 flex items-start justify-between gap-4"
                style={{ borderBottom: hasDivider ? "1px solid var(--border-subtle)" : undefined }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: cat.bg, border: `1px solid ${cat.border}` }}>
                    <Icon size={15} style={{ color: cat.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                        {cat.label}
                      </h2>
                      {isMyRole && (
                        <Star
                          size={13}
                          style={{
                            color: "#facc15",
                            fill: "#facc15",
                            filter: "drop-shadow(0 0 5px rgba(250,204,21,0.8)) drop-shadow(0 0 10px rgba(250,204,21,0.4))",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{cat.description}</p>
                    )}
                  </div>
                  {catSops.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full ml-1"
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
                      {catSops.length}
                    </span>
                  )}
                </div>
                {canEdit && !isAdding && (
                  <button onClick={() => openAdd(cat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 mt-1 transition-opacity hover:opacity-80"
                    style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color }}>
                    <Plus size={11} /> Add SOP
                  </button>
                )}
              </div>

              {/* Inline add form */}
              {canEdit && isAdding && (
                <form onSubmit={(e) => handleAdd(e, cat.id)}
                  className="px-6 py-4 flex items-center gap-2"
                  style={{ borderBottom: catSops.length > 0 ? "1px solid var(--border-subtle)" : undefined, background: "rgba(255,255,255,0.015)" }}>
                  <input autoFocus value={addForm.title}
                    onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="SOP title"
                    style={{ ...inputStyle, flex: "1 1 0" }} required />
                  <input type="url" value={addForm.url}
                    onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://notion.so/..."
                    style={{ ...inputStyle, flex: "1.5 1 0" }} required />
                  <button type="submit" disabled={saving}
                    className="px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{ background: cat.color === "var(--accent)" ? "var(--accent)" : cat.color, color: "#fff", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "…" : "Save"}
                  </button>
                  <button type="button" onClick={closeAdd}
                    className="p-2 rounded-lg flex-shrink-0 transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-tertiary)" }}>
                    <X size={13} />
                  </button>
                </form>
              )}

              {/* SOP list */}
              {catSops.length > 0 && (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {catSops.map((sop) => (
                    <div key={sop.id} className="px-6 py-3.5 flex items-center gap-3">
                      {editingId === sop.id ? (
                        <>
                          <input autoFocus value={editForm.title}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                            style={{ ...inputStyle, flex: "1 1 0" }} />
                          <input type="url" value={editForm.url}
                            onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="https://..."
                            style={{ ...inputStyle, flex: "1.5 1 0" }} />
                          <button onClick={() => handleEdit(sop.id)} disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                            style={{ background: "var(--accent)", color: "var(--text-on-accent)" }}>
                            {saving ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-2 rounded-lg flex-shrink-0 transition-colors hover:bg-white/5"
                            style={{ color: "var(--text-tertiary)" }}>
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                          <p className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{sop.title}</p>
                          <a href={sop.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-80"
                            style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color }}>
                            <ExternalLink size={11} /> Open
                          </a>
                          {canEdit && (
                            <>
                              <button onClick={() => startEdit(sop)}
                                className="p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-white/5"
                                style={{ color: "var(--text-tertiary)" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button onClick={() => handleDelete(sop.id)} disabled={deletingId === sop.id}
                                className="p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-white/5"
                                style={{ color: "var(--danger)", opacity: deletingId === sop.id ? 0.5 : 1 }}>
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {catSops.length === 0 && !isAdding && (
                <div className="px-6 py-4">
                  <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>
                    {canEdit ? "No SOPs added yet — click Add SOP to get started." : "No SOPs added yet."}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
