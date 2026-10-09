"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Plus, X, Archive, ArchiveRestore, Edit2, Eye, Camera, UserCheck, Link2, Check, Trash2 } from "lucide-react";

interface Client {
  id: string;
  name: string;
  status: string;
  logoUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
  _count: { clips: number };
  users: { id: string }[];
}

interface PendingClientUser {
  id: string;
  name: string | null;
  email: string;
  status: string;
  clientId: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  status: string;
}

interface Props {
  initialClients: Client[];
  pendingClientUsers?: PendingClientUser[];
  allClients?: ClientOption[];
}

const inputStyle: React.CSSProperties = {
  background: "var(--border-subtle)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  background: "var(--border-subtle)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
};

export default function ClientManagement({ initialClients, pendingClientUsers: initialPending = [], allClients: allClientOptions = [] }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [pendingUsers, setPendingUsers] = useState<PendingClientUser[]>(initialPending);
  const [tab, setTab] = useState<"active" | "justlaunched" | "prelaunch" | "archived" | "pending">("active");
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"connect" | "create">("connect");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetId = useRef<string | null>(null);

  // Assignment state for pending users
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleCopyLink(clientId: string) {
    const res = await fetch(`/api/agency/clients/${clientId}/share-token`, { method: "POST" });
    if (!res.ok) return;
    const { token } = await res.json();
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleLogoClick(clientId: string) {
    logoTargetId.current = clientId;
    logoInputRef.current?.click();
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = logoTargetId.current;
    if (!file || !id) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const MAX = 200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL("image/webp", 0.85);

        setUploadingLogoId(id);
        const res = await fetch(`/api/agency/clients/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: resized }),
        });
        if (res.ok) {
          setClients((prev) => prev.map((c) => c.id === id ? { ...c, logoUrl: resized } : c));
        }
        setUploadingLogoId(null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const visible = clients.filter((c) =>
    tab === "active" ? c.status === "active" :
    tab === "justlaunched" ? c.status === "justlaunched" :
    tab === "prelaunch" ? c.status === "prelaunch" :
    tab === "archived" ? c.status === "archived" : false
  );

  function resetAddForm() {
    setName(""); setEmail(""); setPassword(""); setSelectedUserId(""); setError(""); setCampaignBudget("");
    setAddMode("connect");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const body = addMode === "connect"
      ? { name, existingUserId: selectedUserId }
      : { name, email, password };

    const res = await fetch("/api/agency/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed");
      setLoading(false);
      return;
    }
    const client = await res.json();
    // Create initial campaign if budget provided
    if (campaignBudget && parseFloat(campaignBudget) > 0) {
      await fetch(`/api/agency/clients/${client.id}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Campaign 1", totalBudget: parseFloat(campaignBudget), order: 1 }),
      });
    }
    setClients((prev) => [{ ...client, _count: { clips: 0 }, users: [], archivedAt: null, createdAt: new Date().toISOString() }, ...prev]);
    // Remove the connected user from pending list
    if (addMode === "connect" && selectedUserId) {
      setPendingUsers((prev) => prev.filter((u) => u.id !== selectedUserId));
    }
    setShowAdd(false);
    resetAddForm();
    setLoading(false);
  }

  async function handleSetStatus(id: string, action: "archive" | "unarchive" | "prelaunch" | "activate" | "justlaunched") {
    const res = await fetch(`/api/agency/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await res.json();
      setClients((prev) => prev.map((c) => c.id === id ? { ...c, status: updated.status, archivedAt: updated.archivedAt ?? null } : c));
    }
  }

  async function handleRename(id: string) {
    const res = await fetch(`/api/agency/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) {
      setClients((prev) => prev.map((c) => c.id === id ? { ...c, name: editName } : c));
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/agency/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      setDeleteTarget(null);
      setDeleteConfirmName("");
    }
    setDeleting(false);
  }

  async function handleAssignUser(userId: string, clientId: string | null) {
    const res = await fetch("/api/agency/clients/assign-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, clientId }),
    });
    if (res.ok) {
      // Remove from pending list (they're now assigned)
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      setAssigningUserId(null);
      setAssignClientId("");
    }
  }

  return (
    <div>
      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-xl p-8 w-full max-w-md" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Add Client</h2>
              <button onClick={() => { setShowAdd(false); resetAddForm(); }}><X size={18} color="#8A93A6" /></button>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--border-default)" }}>
              {([
                { id: "connect", label: "Connect existing account" },
                { id: "create", label: "Create new credentials" },
              ] as const).map((m) => (
                <button key={m.id} type="button" onClick={() => { setAddMode(m.id); setError(""); }}
                  className="flex-1 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    background: addMode === m.id ? "rgba(255,59,59,0.12)" : "transparent",
                    color: addMode === m.id ? "var(--accent)" : "var(--text-tertiary)",
                    borderRight: m.id === "connect" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}>
                  {m.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Campaign / Brand Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Corp" style={inputStyle} />
              </div>

              {addMode === "connect" ? (
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Client Account
                    {pendingUsers.length === 0 && <span style={{ color: "var(--warning)" }}> — no pending signups yet</span>}
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                    style={{ ...inputStyle, appearance: "none" as const }}
                  >
                    <option value="" style={{ background: "var(--bg-surface)" }}>Select a client account...</option>
                    {pendingUsers.map((u) => (
                      <option key={u.id} value={u.id} style={{ background: "var(--bg-surface)" }}>
                        {u.name ? `${u.name} — ` : ""}{u.email}
                      </option>
                    ))}
                  </select>
                  {pendingUsers.length === 0 && (
                    <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                      Ask your client to sign up at <span style={{ color: "var(--accent)" }}>/signup?role=client</span>, then come back here to connect their account.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Client Login Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="client@acme.com" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Client Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Campaign 1 Budget ($) <span style={{ color: "var(--text-tertiary)" }}>(optional)</span></label>
                <input type="number" min={0} step="0.01" value={campaignBudget} onChange={(e) => setCampaignBudget(e.target.value)} placeholder="e.g. 5000" style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Sets the total budget for this client&apos;s first campaign. You can add more campaigns later in client settings.</p>
              </div>

              {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !name || (addMode === "connect" ? !selectedUserId : (!email || !password))}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: "rgba(255,59,59,0.15)",
                  border: "1px solid rgba(255,59,59,0.3)",
                  color: "var(--accent)",
                  opacity: loading || !name || (addMode === "connect" ? !selectedUserId : (!email || !password)) ? 0.5 : 1,
                }}>
                {loading ? "Creating..." : addMode === "connect" ? "Create & Connect Account" : "Create Client"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-xl p-7 w-full max-w-sm" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,59,59,0.3)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)" }}>
              <Trash2 size={18} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Delete {deleteTarget.name}?
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              This permanently deletes the client and all their data — clips, reports, links, and onboarding steps. This cannot be undone.
            </p>
            <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
              Type <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{deleteTarget.name}</span> to confirm
            </p>
            <input
              autoFocus
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmName === deleteTarget.name) handleDelete(deleteTarget.id); }}
              placeholder={deleteTarget.name}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none mb-4"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={deleteConfirmName !== deleteTarget.name || deleting}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                style={{
                  background: "rgba(255,59,59,0.18)",
                  border: "1px solid rgba(255,59,59,0.35)",
                  color: "var(--accent)",
                  opacity: deleteConfirmName !== deleteTarget.name || deleting ? 0.4 : 1,
                }}>
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden logo file input */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {clients.filter((c) => c.status === "active").length} active
            {pendingUsers.length > 0 && <span style={{ color: "var(--warning)" }}> · {pendingUsers.length} pending signup</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "var(--accent-muted)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)" }}>
          <Plus size={14} /> Add Client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { id: "active",        label: `Active (${clients.filter((c) => c.status === "active").length})` },
          { id: "justlaunched",  label: `Just Launched (${clients.filter((c) => c.status === "justlaunched").length})` },
          { id: "prelaunch",     label: `Pre-launch (${clients.filter((c) => c.status === "prelaunch").length})` },
          { id: "archived",      label: `Archived (${clients.filter((c) => c.status === "archived").length})` },
          { id: "pending",       label: `Pending Signup (${pendingUsers.length})` },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium relative"
            style={{ color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {/* PENDING SIGNUP TAB */}
      {tab === "pending" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Client User", "Email", "Status", "Assign to Client", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left label-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{u.name || "—"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,165,0,0.1)", color: "var(--warning)" }}>
                      pending
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {assigningUserId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} style={selectStyle}>
                          <option value="" style={{ background: "var(--bg-surface)" }}>Select a client...</option>
                          {allClientOptions.filter((c) => c.status === "active").map((c) => (
                            <option key={c.id} value={c.id} style={{ background: "var(--bg-surface)" }}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignUser(u.id, assignClientId || null)}
                          disabled={!assignClientId}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "var(--success)", opacity: !assignClientId ? 0.5 : 1 }}>
                          Save
                        </button>
                        <button onClick={() => { setAssigningUserId(null); setAssignClientId(""); }} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {assigningUserId !== u.id && (
                      <button
                        onClick={() => { setAssigningUserId(u.id); setAssignClientId(""); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)", color: "var(--accent)" }}>
                        <UserCheck size={12} />
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pendingUsers.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  No pending client signups
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIVE / JUST LAUNCHED / PRE-LAUNCH / ARCHIVED TABLE */}
      {(tab === "active" || tab === "justlaunched" || tab === "prelaunch" || tab === "archived") && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Client", tab === "archived" ? "Archived" : "Created", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left label-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-6 py-4">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="text-sm px-3 py-1.5 rounded-lg outline-none"
                          style={{ background: "var(--border-subtle)", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-primary)" }} />
                        <button onClick={() => handleRename(c.id)} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,59,59,0.15)", color: "var(--accent)" }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => c.status === "active" && handleLogoClick(c.id)}
                          title={c.status === "active" ? "Upload logo" : undefined}
                          className="relative group flex-shrink-0"
                          style={{ cursor: c.status === "active" ? "pointer" : "default" }}>
                          {c.logoUrl ? (
                            <img src={c.logoUrl} alt={c.name}
                              className="w-8 h-8 rounded-lg object-cover"
                              style={{ border: "1px solid var(--border-default)" }} />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background: c.status === "archived" ? "var(--border-subtle)" : "var(--accent-muted)", color: c.status === "archived" ? "var(--text-tertiary)" : "var(--accent)" }}>
                              {uploadingLogoId === c.id ? "..." : c.name[0]}
                            </div>
                          )}
                          {c.status === "active" && (
                            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ background: "rgba(0,0,0,0.55)" }}>
                              <Camera size={11} color="#F5F6FA" />
                            </div>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: c.status === "archived" ? "var(--text-tertiary)" : "var(--text-primary)" }}>{c.name}</span>
                          {c.status === "active" && (
                            <span className="relative flex h-2 w-2 flex-shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--success)" }} />
                              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--success)" }} />
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {new Date(c.archivedAt ?? c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {(c.status === "active" || c.status === "justlaunched" || c.status === "prelaunch") && (
                        <Link href={`/agency/clients/${c.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center"
                          style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                          Edit
                        </Link>
                      )}
                      {c.status === "active" && (
                        <button onClick={() => handleSetStatus(c.id, "justlaunched")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
                          Just Launched
                        </button>
                      )}
                      {c.status === "justlaunched" && (
                        <button onClick={() => handleSetStatus(c.id, "activate")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.15)", color: "var(--success)" }}>
                          Set Active
                        </button>
                      )}
                      {(c.status === "active" || c.status === "justlaunched") && (
                        <button onClick={() => handleSetStatus(c.id, "prelaunch")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(245,185,74,0.08)", border: "1px solid rgba(245,185,74,0.2)", color: "var(--warning)" }}>
                          Pre-launch
                        </button>
                      )}
                      {c.status === "prelaunch" && (
                        <button onClick={() => handleSetStatus(c.id, "activate")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.15)", color: "var(--success)" }}>
                          Set Active
                        </button>
                      )}
                      {(c.status === "active" || c.status === "justlaunched" || c.status === "prelaunch") && (
                        <button onClick={() => handleSetStatus(c.id, "archive")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "var(--bg-hover)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}>
                          Archive
                        </button>
                      )}
                      {c.status === "archived" && (
                        <button onClick={() => handleSetStatus(c.id, "activate")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.15)", color: "var(--success)" }}>
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => { setDeleteTarget(c); setDeleteConfirmName(""); }}
                        className="p-1.5 rounded-lg transition-opacity"
                        title="Delete client"
                        style={{ background: "transparent", border: "1px solid transparent", color: "var(--text-tertiary)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,59,59,0.1)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,59,59,0.25)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  {tab === "archived" ? "No archived clients" : tab === "prelaunch" ? "No pre-launch clients" : tab === "justlaunched" ? "No just launched clients" : "No clients yet — add your first client"}
                </td></tr>

              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
