"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { Plus, Trash2, ExternalLink, Trophy, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", twitter: "X / Twitter", other: "Other",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FF2D55", instagram: "#DD2A7B", youtube: "#FF0000", twitter: "#1DA1F2", other: "#8A93A6",
};

function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  if (platform === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF2D55">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.96a8.27 8.27 0 004.84 1.54V7.06a4.85 4.85 0 01-1.07-.37z"/>
    </svg>
  );
  if (platform === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs><linearGradient id={`ig-${size}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529"/><stop offset="50%" stopColor="#DD2A7B"/><stop offset="100%" stopColor="#8134AF"/>
      </linearGradient></defs>
      <path fill={`url(#ig-${size})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
  if (platform === "youtube") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  if (platform === "twitter") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DA1F2">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
  return <span style={{ fontSize: size * 0.8, color: "#8A93A6" }}>◆</span>;
}

function detectPlatform(url: string): string {
  if (!url) return "other";
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "twitter";
  return "other";
}

interface Props {
  userName: string;
  clientName: string;
  subAccounts: AnyRecord[];
  clips: AnyRecord[];
  leaderboard: AnyRecord[]; // all clippers on this client
  previewMode?: boolean;
}

export default function ClipperDashboard({ userName, clientName, subAccounts: initialSubs, clips: initialClips, leaderboard, previewMode }: Props) {
  const [subAccounts, setSubAccounts] = useState<AnyRecord[]>(initialSubs);
  const [clips, setClips] = useState<AnyRecord[]>(initialClips);

  // Add subaccount state
  const [showAddSub, setShowAddSub] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [handle, setHandle] = useState("");
  const [addSubLoading, setAddSubLoading] = useState(false);

  // Submit clip state
  const [clipUrl, setClipUrl] = useState("");
  const [subAccountId, setSubAccountId] = useState(initialSubs[0]?.id ?? "");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  function handleUrlChange(url: string) {
    setProfileUrl(url);
    const detected = detectPlatform(url);
    setPlatform(detected);
    // Try to extract handle
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length > 0) setHandle(parts[parts.length - 1].replace("@", ""));
    } catch { /* ignore */ }
  }

  async function handleAddSubAccount(e: React.FormEvent) {
    e.preventDefault();
    setAddSubLoading(true);
    const res = await fetch("/api/subaccounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, handle, profileUrl }),
    });
    if (res.ok) {
      const sub = await res.json();
      setSubAccounts((prev) => [...prev, sub]);
      if (!subAccountId) setSubAccountId(sub.id);
      setShowAddSub(false);
      setProfileUrl(""); setHandle(""); setPlatform("tiktok");
    }
    setAddSubLoading(false);
  }

  async function handleDeleteSub(id: string) {
    if (!confirm("Remove this account?")) return;
    const res = await fetch(`/api/subaccounts/${id}`, { method: "DELETE" });
    if (res.ok) setSubAccounts((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSubmitClip(e: React.FormEvent) {
    e.preventDefault();
    setSubmitLoading(true); setSubmitError(""); setSubmitSuccess(false);
    const res = await fetch("/api/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: clipUrl, subAccountId }),
    });
    if (!res.ok) {
      const d = await res.json();
      setSubmitError(d.error || "Failed to submit");
      setSubmitLoading(false);
      return;
    }
    const clip = await res.json();
    setClips((prev) => [clip, ...prev]);
    setClipUrl("");
    setSubmitSuccess(true);
    setSubmitLoading(false);
    setTimeout(() => setSubmitSuccess(false), 3000);
  }

  const totalViews = clips.reduce((acc, c) => acc + (c.views ?? 0), 0);
  const totalLikes = clips.reduce((acc, c) => acc + (c.likes ?? 0), 0);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      {previewMode ? (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2"
          style={{ background: "rgba(11,14,23,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(8px)" }}>
          <a href="/agency" className="flex items-center gap-1.5 text-xs" style={{ color: "#8A93A6" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back to Agency
          </a>
          <span className="text-xs" style={{ color: "#8A93A6" }}>
            Viewing as <span style={{ color: "#F5F6FA" }}>{userName}</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B", border: "1px solid rgba(255,59,59,0.2)" }}>
            Preview
          </span>
        </div>
      ) : (
        <Sidebar role="clipper" userName={userName} />
      )}
      <main className={`flex-1 overflow-y-auto ${previewMode ? "" : "ml-60"}`}>
        <div className={`max-w-5xl mx-auto px-8 py-8 ${previewMode ? "pt-14" : ""}`}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
              Welcome, {userName.split(" ")[0]}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>Campaign: {clientName}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "My Clips", value: clips.length.toString() },
              { label: "Total Views", value: fmt(totalViews) },
              { label: "Total Likes", value: fmt(totalLikes) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8A93A6" }}>{s.label}</p>
                <p className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* 1. My Accounts */}
            <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>My Accounts</h2>
                {!previewMode && (
                  <button onClick={() => setShowAddSub(true)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DFFA2" }}>
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>

              {showAddSub && (
                <form onSubmit={handleAddSubAccount} className="mb-4 p-4 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium" style={{ color: "#F5F6FA" }}>Add Account</p>
                    <button type="button" onClick={() => setShowAddSub(false)}><X size={13} color="#8A93A6" /></button>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#8A93A6" }}>Profile URL</label>
                    <input type="url" value={profileUrl} onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://tiktok.com/@yourhandle" style={inputStyle} />
                    {profileUrl && <p className="text-xs mt-1" style={{ color: "#3DFFA2" }}>Detected: {PLATFORM_LABELS[platform]}</p>}
                  </div>
                  {!profileUrl && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "#8A93A6" }}>Platform</label>
                      <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
                        {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k} style={{ background: "#0B0E17" }}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#8A93A6" }}>Handle</label>
                    <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} required
                      placeholder="yourhandle" style={inputStyle} />
                  </div>
                  <button type="submit" disabled={addSubLoading || !handle}
                    className="w-full py-2 rounded-lg text-xs font-medium"
                    style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2" }}>
                    {addSubLoading ? "Adding..." : "Add Account"}
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {subAccounts.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <PlatformIcon platform={s.platform} size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>@{s.handle}</p>
                      <p className="text-xs" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>{PLATFORM_LABELS[s.platform]}</p>
                    </div>
                    <button onClick={() => handleDeleteSub(s.id)} className="flex-shrink-0 p-1 rounded hover:bg-white/5">
                      <Trash2 size={12} color="#FF4757" />
                    </button>
                  </div>
                ))}
                {subAccounts.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: "#8A93A6" }}>No accounts yet — add one above</p>
                )}
              </div>
            </div>

            {/* 2. Submit a Clip */}
            <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Submit a Clip</h2>
              {previewMode ? (
                <p className="text-xs" style={{ color: "#8A93A6" }}>Clip submission is only available when logged in as the clipper.</p>
              ) : subAccounts.length === 0 ? (
                <p className="text-xs" style={{ color: "#8A93A6" }}>Add a social account first, then submit clips.</p>
              ) : (
                <form onSubmit={handleSubmitClip} className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Account</label>
                    <select value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)} style={inputStyle}>
                      {subAccounts.map((s) => (
                        <option key={s.id} value={s.id} style={{ background: "#0B0E17" }}>
                          {PLATFORM_LABELS[s.platform]} — @{s.handle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clip URL</label>
                    <input type="url" value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} required
                      placeholder="https://tiktok.com/@you/video/..." style={inputStyle} />
                  </div>
                  {submitError && <p className="text-xs" style={{ color: "#FF4757" }}>{submitError}</p>}
                  {submitSuccess && <p className="text-xs" style={{ color: "#3DFFA2" }}>✓ Clip submitted!</p>}
                  <button type="submit" disabled={submitLoading || !clipUrl}
                    className="w-full py-3 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(61,255,162,0.15)", border: "1px solid rgba(61,255,162,0.3)", color: "#3DFFA2", opacity: submitLoading ? 0.6 : 1 }}>
                    {submitLoading ? "Submitting..." : "Submit Clip"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* 3. My Results + Leaderboard */}
          <div className="grid grid-cols-2 gap-6">
            {/* My recent clips */}
            <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>My Clips</h2>
              <div className="space-y-2">
                {clips.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <PlatformIcon platform={c.subAccount?.platform ?? "other"} size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "#8A93A6" }}>@{c.subAccount?.handle}</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(c.views ?? 0)}</span>
                    <a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} color="#8A93A6" /></a>
                  </div>
                ))}
                {clips.length === 0 && <p className="text-xs" style={{ color: "#8A93A6" }}>No clips yet</p>}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={14} color="#FFA500" />
                <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Leaderboard</h2>
              </div>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.name === userName;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="text-xs w-5 text-right flex-shrink-0" style={{ color: i === 0 ? "#FFA500" : "#8A93A6" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: isMe ? "rgba(61,255,162,0.2)" : "rgba(255,255,255,0.06)", color: isMe ? "#3DFFA2" : "#F5F6FA" }}>
                        {(entry.name || "?")[0]}
                      </div>
                      <span className="text-sm flex-1 font-medium" style={{ color: isMe ? "#3DFFA2" : "#F5F6FA" }}>
                        {entry.name}{isMe ? " (you)" : ""}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                        {fmt(entry.totalViews)}
                      </span>
                    </div>
                  );
                })}
                {leaderboard.length === 0 && <p className="text-xs" style={{ color: "#8A93A6" }}>No data yet</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
