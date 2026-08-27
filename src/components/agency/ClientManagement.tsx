"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Plus, X, Archive, ArchiveRestore, Edit2, Eye, Camera, UserCheck } from "lucide-react";

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
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F5F6FA",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F5F6FA",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
};

export default function ClientManagement({ initialClients, pendingClientUsers: initialPending = [], allClients: allClientOptions = [] }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [pendingUsers, setPendingUsers] = useState<PendingClientUser[]>(initialPending);
  const [tab, setTab] = useState<"active" | "archived" | "pending">("active");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoTargetId = useRef<string | null>(null);

  // Assignment state for pending users
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignClientId, setAssignClientId] = useState("");

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

  const visible = clients.filter((c) => tab === "active" ? c.status === "active" : tab === "archived" ? c.status === "archived" : false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/agency/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed");
      setLoading(false);
      return;
    }
    const client = await res.json();
    setClients((prev) => [{ ...client, _count: { clips: 0 }, users: [], archivedAt: null, createdAt: new Date().toISOString() }, ...prev]);
    setShowAdd(false);
    setName(""); setEmail(""); setPassword("");
    setLoading(false);
  }

  async function handleArchive(id: string, action: "archive" | "unarchive") {
    const res = await fetch(`/api/agency/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await res.json();
      setClients((prev) => prev.map((c) => c.id === id ? { ...c, status: updated.status, archivedAt: updated.archivedAt } : c));
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
          <div className="rounded-2xl p-8 w-full max-w-md" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Add Client</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Company / Brand Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Corp" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client Login Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="client@acme.com" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
              </div>
              {error && <p className="text-xs" style={{ color: "#FF4757" }}>{error}</p>}
              <button type="submit" disabled={loading || !name || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "#FF3B3B", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Creating..." : "Create Client"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden logo file input */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
            {clients.filter((c) => c.status === "active").length} active
            {pendingUsers.length > 0 && <span style={{ color: "#FFA500" }}> · {pendingUsers.length} pending signup</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B" }}>
          <Plus size={14} /> Add Client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { id: "active", label: `Active (${clients.filter((c) => c.status === "active").length})` },
          { id: "archived", label: `Archived (${clients.filter((c) => c.status === "archived").length})` },
          { id: "pending", label: `Pending Signup (${pendingUsers.length})` },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium relative"
            style={{ color: tab === t.id ? "#F5F6FA" : "#8A93A6" }}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
          </button>
        ))}
      </div>

      {/* PENDING SIGNUP TAB */}
      {tab === "pending" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Client User", "Email", "Status", "Assign to Client", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{u.name || "—"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(255,165,0,0.1)", color: "#FFA500" }}>
                      pending
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {assigningUserId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} style={selectStyle}>
                          <option value="" style={{ background: "#0B0E17" }}>Select a client...</option>
                          {allClientOptions.filter((c) => c.status === "active").map((c) => (
                            <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignUser(u.id, assignClientId || null)}
                          disabled={!assignClientId}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2", opacity: !assignClientId ? 0.5 : 1 }}>
                          Save
                        </button>
                        <button onClick={() => { setAssigningUserId(null); setAssignClientId(""); }} className="text-xs px-2 py-1 rounded" style={{ color: "#8A93A6" }}>Cancel</button>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "#8A93A6" }}>Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {assigningUserId !== u.id && (
                      <button
                        onClick={() => { setAssigningUserId(u.id); setAssignClientId(""); }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)", color: "#FF3B3B" }}>
                        <UserCheck size={12} />
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pendingUsers.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                  No pending client signups
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIVE / ARCHIVED TABLE */}
      {(tab === "active" || tab === "archived") && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Client", "Clippers", "Clips", tab === "archived" ? "Archived" : "Created", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
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
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#F5F6FA" }} />
                        <button onClick={() => handleRename(c.id)} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,59,59,0.15)", color: "#FF3B3B" }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded" style={{ color: "#8A93A6" }}>Cancel</button>
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
                              style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background: c.status === "archived" ? "rgba(255,255,255,0.05)" : "rgba(255,59,59,0.1)", color: c.status === "archived" ? "#8A93A6" : "#FF3B3B" }}>
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
                        <span className="text-sm font-medium" style={{ color: c.status === "archived" ? "#8A93A6" : "#F5F6FA" }}>{c.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{c.users.length}</td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{c._count.clips}</td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>
                    {new Date(c.archivedAt ?? c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {c.status === "active" && (
                        <>
                          <Link href={`/agency/clients/${c.id}`} title="Manage client"
                            className="text-xs px-2.5 py-1 rounded-lg inline-flex items-center"
                            style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)", color: "#FF3B3B" }}>
                            Manage
                          </Link>
                          <Link href={`/agency/preview/client/${c.id}`} title="View as client"
                            className="p-1.5 rounded-lg hover:bg-white/5 inline-flex">
                            <Eye size={13} color="#8A93A6" />
                          </Link>
                          <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} title="Rename"
                            className="p-1.5 rounded-lg hover:bg-white/5"><Edit2 size={13} color="#8A93A6" /></button>
                        </>
                      )}
                      {c.status === "active" ? (
                        <button onClick={() => handleArchive(c.id, "archive")} title="Archive client"
                          className="p-1.5 rounded-lg hover:bg-white/5"><Archive size={13} color="#FF4757" /></button>
                      ) : (
                        <button onClick={() => handleArchive(c.id, "unarchive")} title="Unarchive client"
                          className="p-1.5 rounded-lg hover:bg-white/5"><ArchiveRestore size={13} color="#3DFFA2" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                  {tab === "archived" ? "No archived clients" : "No clients yet — add your first client"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
