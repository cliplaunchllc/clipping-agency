"use client";

import { useState } from "react";
import { Plus, ExternalLink, X } from "lucide-react";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FF2D55",
  instagram: "#DD2A7B",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  other: "#8A93A6",
};

interface Clip {
  id: string;
  platform: string;
  url: string;
  submittedAt: string;
  clientName: string;
  handle: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface SubAccount {
  id: string;
  platform: string;
  handle: string;
}

interface Props {
  clips: Clip[];
  subAccounts: SubAccount[];
}

export default function ClipperSubmissions({ clips: initial, subAccounts }: Props) {
  const [clips, setClips] = useState<Clip[]>(initial);
  const [showModal, setShowModal] = useState(false);
  const [clipUrl, setClipUrl] = useState("");
  const [subAccountId, setSubAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: clipUrl, subAccountId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to submit");
      setLoading(false);
      return;
    }
    const newClip = await res.json();
    const sa = subAccounts.find((s) => s.id === subAccountId);
    setClips((prev) => [{
      id: newClip.id,
      platform: sa?.platform ?? "other",
      url: newClip.url,
      submittedAt: newClip.submittedAt,
      clientName: "",
      handle: sa?.handle ?? "",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    }, ...prev]);
    setShowModal(false);
    setClipUrl("");
    setSubAccountId("");
    setLoading(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Submit Clip
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} color="#8A93A6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clip URL</label>
                <input type="url" value={clipUrl} onChange={(e) => setClipUrl(e.target.value)}
                  placeholder="https://..." required style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Your Account</label>
                <select value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)}
                  required style={{ ...inputStyle, appearance: "none" }}>
                  <option value="" style={{ background: "#0B0E17" }}>Select account...</option>
                  {subAccounts.map((sa) => (
                    <option key={sa.id} value={sa.id} style={{ background: "#0B0E17" }}>
                      @{sa.handle} ({sa.platform})
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs" style={{ color: "#FF4757" }}>{error}</p>}
              <button type="submit" disabled={loading || !clipUrl || !subAccountId}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: "rgba(61,255,162,0.15)",
                  border: "1px solid rgba(61,255,162,0.3)",
                  color: "#3DFFA2",
                  opacity: loading ? 0.6 : 1,
                }}>
                {loading ? "Submitting..." : "Submit Clip"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            Submissions
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clips.length} clips submitted</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DFFA2" }}>
          <Plus size={14} /> Submit Clip
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Platform", "Account", "Client", "Views", "Likes", "Comments", "Shares", "Date", "Link"].map((h) => (
                <th key={h} className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clips.map((clip, i) => (
              <tr key={clip.id}
                style={{ borderBottom: i < clips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td className="px-5 py-3">
                  <span className="text-xs font-semibold capitalize"
                    style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                    {clip.platform}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>@{clip.handle}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{clip.clientName || "—"}</td>
                <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(clip.views)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.likes)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.comments)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.shares)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>
                  {new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-5 py-3">
                  <a href={clip.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} color="#3DFFA2" />
                  </a>
                </td>
              </tr>
            ))}
            {clips.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                  No submissions yet. Submit your first clip above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
