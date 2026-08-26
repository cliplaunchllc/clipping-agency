"use client";

import { useState } from "react";
import { AlertTriangle, UserCheck } from "lucide-react";

interface ClipperUser {
  id: string;
  name: string | null;
  email: string;
  status: string;
  clientId: string | null;
  client: { id: string; name: string; status: string } | null;
  clipperProfile: { _count: { clips: number } } | null;
}

interface Client {
  id: string;
  name: string;
  status: string;
}

interface Props {
  initialClippers: ClipperUser[];
  allClients: Client[];
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F5F6FA",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
};

export default function ClipperManagement({ initialClippers, allClients }: Props) {
  const [clippers, setClippers] = useState<ClipperUser[]>(initialClippers);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");

  const visible = tab === "pending" ? clippers.filter((c) => c.status === "pending") : clippers;

  async function handleAssign(clipperId: string, clientId: string | null) {
    const res = await fetch("/api/agency/clippers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clipperId, clientId }),
    });
    if (res.ok) {
      const client = allClients.find((c) => c.id === clientId) ?? null;
      setClippers((prev) => prev.map((c) =>
        c.id === clipperId
          ? { ...c, clientId, status: clientId ? "active" : "pending", client: client ? { id: client.id, name: client.name, status: client.status } : null }
          : c
      ));
      setAssigning(null);
      setSelectedClientId("");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clippers</h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
            {clippers.filter((c) => c.status === "pending").length} pending assignment
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { id: "all", label: `All (${clippers.length})` },
          { id: "pending", label: `Pending (${clippers.filter((c) => c.status === "pending").length})` },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium relative"
            style={{ color: tab === t.id ? "#F5F6FA" : "#8A93A6" }}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Clipper", "Email", "Status", "Assigned Client", "Clips", "Actions"].map((h) => (
                <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const clientArchived = c.client?.status === "archived";
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#8A93A6" }}>{c.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: c.status === "active" ? "rgba(61,255,162,0.1)" : "rgba(255,165,0,0.1)",
                        color: c.status === "active" ? "#3DFFA2" : "#FFA500",
                      }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {assigning === c.id ? (
                      <div className="flex items-center gap-2">
                        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} style={inputStyle}>
                          <option value="" style={{ background: "#0B0E17" }}>Unassigned</option>
                          {allClients.filter((cl) => cl.status === "active").map((cl) => (
                            <option key={cl.id} value={cl.id} style={{ background: "#0B0E17" }}>{cl.name}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAssign(c.id, selectedClientId || null)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2" }}>
                          Save
                        </button>
                        <button onClick={() => setAssigning(null)} className="text-xs px-2 py-1 rounded" style={{ color: "#8A93A6" }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {clientArchived && (
                          <span title="Client is archived">
                            <AlertTriangle size={13} color="#FFA500" />
                          </span>
                        )}
                        <span className="text-xs" style={{ color: clientArchived ? "#FFA500" : "#F5F6FA" }}>
                          {c.client?.name ?? <span style={{ color: "#8A93A6" }}>Unassigned</span>}
                        </span>
                        {clientArchived && (
                          <span className="text-xs" style={{ color: "#8A93A6" }}>(archived)</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{c.clipperProfile?._count?.clips ?? 0}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setAssigning(c.id); setSelectedClientId(c.clientId ?? ""); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)", color: "#FF3B3B" }}>
                      <UserCheck size={12} />
                      {c.status === "pending" ? "Assign" : "Reassign"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                {tab === "pending" ? "No pending clippers" : "No clippers yet"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
