"use client";

import { useState } from "react";
import { Plus, ExternalLink, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const PLATFORM_COLORS: Record<string, string> = { tiktok: "#FF2D55", instagram: "#DD2A7B", youtube: "#FF0000" };

interface Props {
  submissions: AnyRecord[];
  clients: AnyRecord[];
  clipperId: string;
}

export default function ClipperSubmissions({ submissions: initial, clients, clipperId }: Props) {
  const [submissions, setSubmissions] = useState<AnyRecord[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState("tiktok");
  const [clipUrl, setClipUrl] = useState("");
  const [subAccountId, setSubAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allSubAccounts = clients.flatMap((c) => c.subAccounts.map((sa: AnyRecord) => ({ ...sa, clientName: c.name })));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, clipUrl, subAccountId, clipperId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to submit");
      setLoading(false);
      return;
    }
    const newSub = await res.json();
    setSubmissions((prev) => [{ ...newSub, snapshots: [], subAccount: { client: { name: allSubAccounts.find((sa) => sa.id === subAccountId)?.clientName ?? "" } } }, ...prev]);
    setShowModal(false);
    setClipUrl(""); setSubAccountId(""); setPlatform("tiktok");
    setLoading(false);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Submit Clip</h2>
              <button onClick={() => setShowModal(false)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
                  <option value="tiktok" style={{ background: "#0B0E17" }}>TikTok</option>
                  <option value="instagram" style={{ background: "#0B0E17" }}>Instagram</option>
                  <option value="youtube" style={{ background: "#0B0E17" }}>YouTube</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clip URL</label>
                <input type="url" value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="https://..." required style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client Account</label>
                <select value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)} required style={inputStyle}>
                  <option value="" style={{ background: "#0B0E17" }}>Select account...</option>
                  {allSubAccounts.map((sa) => (
                    <option key={sa.id} value={sa.id} style={{ background: "#0B0E17" }}>
                      {sa.clientName} — @{sa.handle} ({sa.platform})
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs" style={{ color: "#FF4757" }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2" }}>
                {loading ? "Submitting..." : "Submit Clip"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Submissions</h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{submissions.length} clips submitted</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DFFA2" }}>
          <Plus size={14} />
          Submit Clip
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Platform", "Client", "Views", "Likes", "Comments", "Shares", "Date", "Link"].map((h) => (
                <th key={h} className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < submissions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td className="px-5 py-3">
                  <span className="text-xs font-semibold capitalize" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>{s.platform}</span>
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{s.subAccount?.client?.name ?? "—"}</td>
                <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(s.snapshots[0]?.views ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.likes ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.comments ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.shares ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>
                  {new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-5 py-3">
                  <a href={s.clipUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} color="#3DFFA2" />
                  </a>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No submissions yet. Submit your first clip above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
