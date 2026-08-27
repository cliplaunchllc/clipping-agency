"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, UserCheck, Eye, ChevronDown } from "lucide-react";
import { PlatformIcon, PLATFORM_COLORS, PLATFORM_LABELS } from "@/components/shared/PlatformIcon";

interface SubAccount {
  id: string;
  platform: string;
  handle: string;
  profileUrl: string | null;
}

interface ClipperUser {
  id: string;
  name: string | null;
  email: string;
  status: string;
  clientId: string | null;
  client: { id: string; name: string; status: string } | null;
  clipperProfile: {
    _count: { clips: number };
    subAccounts: SubAccount[];
  } | null;
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
  const [tab, setTab] = useState<"all" | "pending" | "accounts">("all");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [accountsClientId, setAccountsClientId] = useState(allClients.find((c) => c.status === "active")?.id ?? "");

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

  // All Accounts data for selected client
  const accountsClient = allClients.find((c) => c.id === accountsClientId);
  const clippersForClient = clippers.filter((c) => c.clientId === accountsClientId && c.status === "active");

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
          { id: "accounts", label: "All Accounts" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium relative tab-btn"
            style={{ color: tab === t.id ? "#F5F6FA" : "#8A93A6" }}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
          </button>
        ))}
      </div>

      {/* ALL / PENDING TABLE */}
      {(tab === "all" || tab === "pending") && (
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
                  <tr key={c.id} className="table-row-hover" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                          {(c.name || c.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.name || "—"}</p>
                          {(c.clipperProfile?.subAccounts ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(c.clipperProfile?.subAccounts ?? []).map((s) => (
                                s.profileUrl ? (
                                  <a key={s.id} href={s.profileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg transition-opacity hover:opacity-75"
                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none" }}>
                                    <PlatformIcon platform={s.platform} size={11} />
                                    <span className="text-xs" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>@{s.handle}</span>
                                  </a>
                                ) : (
                                  <div key={s.id} className="flex items-center gap-1 px-2 py-0.5 rounded-lg"
                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                    <PlatformIcon platform={s.platform} size={11} />
                                    <span className="text-xs" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>@{s.handle}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>
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
                            <span title="Client is archived"><AlertTriangle size={13} color="#FFA500" /></span>
                          )}
                          <span className="text-xs" style={{ color: clientArchived ? "#FFA500" : "#F5F6FA" }}>
                            {c.client?.name ?? <span style={{ color: "#8A93A6" }}>Unassigned</span>}
                          </span>
                          {clientArchived && <span className="text-xs" style={{ color: "#8A93A6" }}>(archived)</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: "#F5F6FA" }}>{c.clipperProfile?._count?.clips ?? 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.status === "active" && (
                          <Link href={`/agency/preview/clipper/${c.id}`} title="View as clipper"
                            className="p-1.5 rounded-lg hover:bg-white/5 inline-flex">
                            <Eye size={13} color="#8A93A6" />
                          </Link>
                        )}
                        <button onClick={() => { setAssigning(c.id); setSelectedClientId(c.clientId ?? ""); }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)", color: "#FF3B3B" }}>
                          <UserCheck size={12} />
                          {c.status === "pending" ? "Assign" : "Reassign"}
                        </button>
                      </div>
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
      )}

      {/* ALL ACCOUNTS TAB */}
      {tab === "accounts" && (
        <div className="space-y-6">
          {/* Client selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "#8A93A6" }}>Client</span>
            <div className="relative">
              <select
                value={accountsClientId}
                onChange={(e) => setAccountsClientId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 text-sm font-medium rounded-xl cursor-pointer outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", minWidth: 200 }}>
                <option value="" style={{ background: "#0B0E17" }}>— Select a client —</option>
                {allClients.map((cl) => (
                  <option key={cl.id} value={cl.id} style={{ background: "#0B0E17" }}>
                    {cl.name}{cl.status === "archived" ? " (archived)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} color="#8A93A6" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {accountsClient && (
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: accountsClient.status === "active" ? "rgba(61,255,162,0.1)" : "rgba(255,255,255,0.05)",
                  color: accountsClient.status === "active" ? "#3DFFA2" : "#8A93A6",
                }}>
                {accountsClient.status}
              </span>
            )}
          </div>

          {/* Clippers + their accounts for selected client */}
          {!accountsClientId ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-sm" style={{ color: "#8A93A6" }}>Select a client to view accounts</p>
            </div>
          ) : clippersForClient.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-sm" style={{ color: "#8A93A6" }}>No active clippers assigned to this client</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clippersForClient.map((clipper) => {
                const subs = clipper.clipperProfile?.subAccounts ?? [];
                return (
                  <div key={clipper.id} className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Clipper header */}
                    <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: subs.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                        {(clipper.name || clipper.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{clipper.name || "—"}</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{clipper.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "#8A93A6" }}>
                          {subs.length} page{subs.length !== 1 ? "s" : ""} · {clipper.clipperProfile?._count.clips ?? 0} clips
                        </span>
                        <Link href={`/agency/preview/clipper/${clipper.id}`}
                          className="p-1.5 rounded-lg hover:bg-white/5 inline-flex" title="Preview as clipper">
                          <Eye size={13} color="#8A93A6" />
                        </Link>
                      </div>
                    </div>

                    {/* Sub-accounts */}
                    {subs.length > 0 ? (
                      <div className="px-5 py-3">
                        <div className="grid grid-cols-2 gap-2">
                          {subs.map((s) => {
                            const inner = (
                              <>
                                <PlatformIcon platform={s.platform} size={15} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>@{s.handle}</p>
                                  <p className="text-xs" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>{PLATFORM_LABELS[s.platform] ?? s.platform}</p>
                                </div>
                              </>
                            );
                            return s.profileUrl ? (
                              <a key={s.id} href={s.profileUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-opacity hover:opacity-75"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", textDecoration: "none" }}>
                                {inner}
                              </a>
                            ) : (
                              <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                {inner}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4">
                        <p className="text-xs" style={{ color: "#8A93A6" }}>No pages added yet</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
