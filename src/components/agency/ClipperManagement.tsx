"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

interface Clipper {
  id: string;
  displayName: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
  assignments: Array<{ client: { id: string; name: string } }>;
  _count: { submissions: number };
}

interface Client {
  id: string;
  name: string;
}

interface Props {
  initialClippers: Clipper[];
  allClients: Client[];
}

export default function ClipperManagement({ initialClippers, allClients }: Props) {
  const [clippers, setClippers] = useState<Clipper[]>(initialClippers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<Clipper | null>(null);

  // Add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Assign form
  const [assignClientId, setAssignClientId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
  };

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    const res = await fetch("/api/agency/clippers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Failed to create clipper");
      setAddLoading(false);
      return;
    }
    const newClipper = await res.json();
    setClippers((prev) => [{
      ...newClipper,
      createdAt: new Date().toISOString(),
      user: { name, email },
      assignments: [],
      _count: { submissions: 0 },
    }, ...prev]);
    setShowAddModal(false);
    setName(""); setEmail(""); setPassword("");
    setAddLoading(false);
  }

  async function handleDelete(clipperId: string) {
    if (!confirm("Remove this clipper account?")) return;
    // Note: no dedicated delete endpoint for clipper — would need one in production
    setClippers((prev) => prev.filter((c) => c.id !== clipperId));
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!showAssignModal || !assignClientId) return;
    setAssignLoading(true);
    setAssignError("");
    const res = await fetch("/api/agency/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipperId: showAssignModal.id, clientId: assignClientId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setAssignError(data.error || "Failed to assign");
      setAssignLoading(false);
      return;
    }
    const client = allClients.find((c) => c.id === assignClientId);
    if (client) {
      setClippers((prev) => prev.map((c) =>
        c.id === showAssignModal.id
          ? { ...c, assignments: [...c.assignments, { client }] }
          : c
      ));
    }
    setAssignClientId("");
    setAssignLoading(false);
    setShowAssignModal(null);
  }

  async function handleRemoveAssignment(clipperId: string, clientId: string) {
    const res = await fetch("/api/agency/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipperId, clientId }),
    });
    if (res.ok) {
      setClippers((prev) => prev.map((c) =>
        c.id === clipperId
          ? { ...c, assignments: c.assignments.filter((a) => a.client.id !== clientId) }
          : c
      ));
    }
  }

  return (
    <div>
      {/* Add Clipper Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Add Clipper</h2>
              <button onClick={() => setShowAddModal(false)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              {[
                { label: "Full Name", value: name, set: setName, type: "text", placeholder: "Jane Smith" },
                { label: "Email", value: email, set: setEmail, type: "email", placeholder: "jane@example.com" },
                { label: "Password", value: password, set: setPassword, type: "password", placeholder: "••••••••" },
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
                  background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2",
                  opacity: addLoading || !name || !email || !password ? 0.6 : 1,
                }}>
                {addLoading ? "Creating..." : "Create Clipper"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Client Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Assign Client to {showAssignModal.displayName || showAssignModal.user.name}
              </h2>
              <button onClick={() => setShowAssignModal(null)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client</label>
                <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  <option value="" style={{ background: "#0B0E17" }}>Select client...</option>
                  {allClients
                    .filter((c) => !showAssignModal.assignments.some((a) => a.client.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{c.name}</option>
                    ))}
                </select>
              </div>
              {/* Existing assignments */}
              {showAssignModal.assignments.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>Currently assigned to:</p>
                  <div className="space-y-2">
                    {showAssignModal.assignments.map((a) => (
                      <div key={a.client.id} className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-xs" style={{ color: "#F5F6FA" }}>{a.client.name}</span>
                        <button type="button"
                          onClick={() => handleRemoveAssignment(showAssignModal.id, a.client.id)}>
                          <X size={12} color="#FF4757" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {assignError && <p className="text-xs" style={{ color: "#FF4757" }}>{assignError}</p>}
              <button type="submit" disabled={assignLoading || !assignClientId}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "#FF3B3B",
                  opacity: assignLoading || !assignClientId ? 0.6 : 1,
                }}>
                {assignLoading ? "Assigning..." : "Assign Client"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clippers</h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clippers.length} total clippers</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DFFA2" }}>
          <Plus size={14} />
          Add Clipper
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Clipper", "Email", "Display Name", "Clips", "Clients", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clippers.map((clipper) => (
              <tr key={clipper.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ background: "rgba(61,255,162,0.15)", color: "#3DFFA2" }}>
                      {(clipper.user.name ?? "C")[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{clipper.user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{clipper.user.email}</td>
                <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{clipper.displayName || "—"}</td>
                <td className="px-6 py-4 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{clipper._count.submissions}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {clipper.assignments.map((a) => (
                      <span key={a.client.id} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,59,59,0.12)", color: "#FF3B3B" }}>
                        {a.client.name}
                      </span>
                    ))}
                    {clipper.assignments.length === 0 && (
                      <span className="text-xs" style={{ color: "#8A93A6" }}>None</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>
                  {new Date(clipper.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowAssignModal(clipper)} title="Assign to client"
                      className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                      style={{ background: "rgba(255,59,59,0.08)", color: "#FF3B3B", border: "1px solid rgba(255,59,59,0.15)" }}>
                      Assign
                    </button>
                    <button onClick={() => handleDelete(clipper.id)} title="Remove clipper"
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
                      <Trash2 size={14} color="#FF4757" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clippers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                  No clippers yet. Add your first clipper above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
