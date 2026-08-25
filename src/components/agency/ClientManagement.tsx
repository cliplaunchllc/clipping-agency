"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, X, Users } from "lucide-react";

interface Client {
  id: string;
  name: string;
  status: string;
  packageInfo: string | null;
  user: { email: string; name: string | null };
  assignments: Array<{ clipper: { id: string; displayName: string | null; user: { name: string | null } } }>;
  subAccounts: Array<{ id: string; platform: string; handle: string }>;
  _count: { subAccounts: number };
}

interface Clipper {
  id: string;
  displayName: string | null;
  user: { name: string | null; email: string };
}

interface Props {
  initialClients: Client[];
  allClippers: Clipper[];
}

export default function ClientManagement({ initialClients, allClippers }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Client | null>(null);

  // Add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [packageInfo, setPackageInfo] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPackage, setEditPackage] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Assign
  const [assignClipperId, setAssignClipperId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    const res = await fetch("/api/agency/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, packageInfo }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Failed to create client");
      setAddLoading(false);
      return;
    }
    const newClient = await res.json();
    setClients((prev) => [{ ...newClient, user: { email, name }, assignments: [], subAccounts: [], _count: { subAccounts: 0 } }, ...prev]);
    setShowAddModal(false);
    setName(""); setEmail(""); setPassword(""); setPackageInfo("");
    setAddLoading(false);
  }

  async function handleDelete(clientId: string) {
    if (!confirm("Delete this client? This action cannot be undone.")) return;
    const res = await fetch(`/api/agency/clients/${clientId}`, { method: "DELETE" });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== clientId));
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setEditLoading(true);
    const res = await fetch(`/api/agency/clients/${editingClient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, status: editStatus, packageInfo: editPackage }),
    });
    if (res.ok) {
      const updated = await res.json();
      setClients((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
      setEditingClient(null);
    }
    setEditLoading(false);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setEditName(client.name);
    setEditStatus(client.status);
    setEditPackage(client.packageInfo ?? "");
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!showAssignModal || !assignClipperId) return;
    setAssignLoading(true);
    setAssignError("");
    const res = await fetch("/api/agency/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipperId: assignClipperId, clientId: showAssignModal.id }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAssignError(data.error || "Failed to assign");
      setAssignLoading(false);
      return;
    }
    const clipper = allClippers.find((c) => c.id === assignClipperId);
    if (clipper) {
      setClients((prev) => prev.map((c) =>
        c.id === showAssignModal.id
          ? { ...c, assignments: [...c.assignments, { clipper }] }
          : c
      ));
    }
    setAssignClipperId("");
    setAssignLoading(false);
    setShowAssignModal(null);
  }

  async function handleRemoveAssignment(clientId: string, clipperId: string) {
    const res = await fetch("/api/agency/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipperId, clientId }),
    });
    if (res.ok) {
      setClients((prev) => prev.map((c) =>
        c.id === clientId
          ? { ...c, assignments: c.assignments.filter((a) => a.clipper.id !== clipperId) }
          : c
      ));
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
  };

  return (
    <div>
      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Add Client</h2>
              <button onClick={() => setShowAddModal(false)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              {[
                { label: "Company Name", value: name, set: setName, type: "text", placeholder: "Acme Corp" },
                { label: "Email", value: email, set: setEmail, type: "email", placeholder: "client@acme.com" },
                { label: "Password", value: password, set: setPassword, type: "password", placeholder: "••••••••" },
                { label: "Package Info", value: packageInfo, set: setPackageInfo, type: "text", placeholder: "Pro Plan — 50 clips/mo" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>{field.label}</label>
                  <input type={field.type} placeholder={field.placeholder} value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
              ))}
              {addError && <p className="text-xs" style={{ color: "#FF4757" }}>{addError}</p>}
              <button type="submit" disabled={addLoading || !name || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(90,200,250,0.15)", border: "1px solid rgba(90,200,250,0.3)", color: "#5AC8FA",
                  opacity: addLoading || !name || !email || !password ? 0.6 : 1,
                }}>
                {addLoading ? "Creating..." : "Create Client"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Edit Client</h2>
              <button onClick={() => setEditingClient(null)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  <option value="active" style={{ background: "#0B0E17" }}>Active</option>
                  <option value="inactive" style={{ background: "#0B0E17" }}>Inactive</option>
                  <option value="paused" style={{ background: "#0B0E17" }}>Paused</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Package Info</label>
                <input type="text" value={editPackage} onChange={(e) => setEditPackage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <button type="submit" disabled={editLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(90,200,250,0.15)", border: "1px solid rgba(90,200,250,0.3)", color: "#5AC8FA" }}>
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Clipper Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Assign Clipper to {showAssignModal.name}
              </h2>
              <button onClick={() => setShowAssignModal(null)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clipper</label>
                <select value={assignClipperId} onChange={(e) => setAssignClipperId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  <option value="" style={{ background: "#0B0E17" }}>Select clipper...</option>
                  {allClippers
                    .filter((c) => !showAssignModal.assignments.some((a) => a.clipper.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>
                        {c.displayName || c.user.name || c.user.email}
                      </option>
                    ))}
                </select>
              </div>
              {/* Existing assignments */}
              {showAssignModal.assignments.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>Currently assigned:</p>
                  <div className="space-y-2">
                    {showAssignModal.assignments.map((a) => (
                      <div key={a.clipper.id} className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-xs" style={{ color: "#F5F6FA" }}>
                          {a.clipper.displayName || a.clipper.user.name}
                        </span>
                        <button type="button"
                          onClick={() => handleRemoveAssignment(showAssignModal.id, a.clipper.id)}>
                          <X size={12} color="#FF4757" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {assignError && <p className="text-xs" style={{ color: "#FF4757" }}>{assignError}</p>}
              <button type="submit" disabled={assignLoading || !assignClipperId}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2",
                  opacity: assignLoading || !assignClipperId ? 0.6 : 1,
                }}>
                {assignLoading ? "Assigning..." : "Assign Clipper"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clients.length} total clients</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(90,200,250,0.1)", border: "1px solid rgba(90,200,250,0.2)", color: "#5AC8FA" }}>
          <Plus size={14} />
          Add Client
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Client", "Email", "Package", "Status", "Sub-Accounts", "Clippers", "Actions"].map((h) => (
                <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(90,200,250,0.1)", color: "#5AC8FA" }}>
                      {client.name[0]}
                    </div>
                    <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{client.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{client.user?.email}</td>
                <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{client.packageInfo || "—"}</td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: client.status === "active" ? "rgba(61,255,162,0.12)" : "rgba(255,71,87,0.12)",
                      color: client.status === "active" ? "#3DFFA2" : "#FF4757",
                    }}>
                    {client.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{client._count.subAccounts}</td>
                <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{client.assignments.length}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowAssignModal(client)} title="Assign clipper"
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
                      <Users size={14} color="#5AC8FA" />
                    </button>
                    <button onClick={() => openEdit(client)} title="Edit client"
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
                      <Edit2 size={14} color="#8A93A6" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} title="Delete client"
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
                      <Trash2 size={14} color="#FF4757" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                  No clients yet. Add your first client above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
