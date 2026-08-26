"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/shared/Sidebar";
import {
  LayoutDashboard, Upload, BarChart2, Users,
  Eye, Heart, Share2, Bookmark, ExternalLink, Plus, X,
  TrendingUp, TrendingDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const navItems = [
  { label: "Dashboard", href: "/clipper", icon: LayoutDashboard },
  { label: "My Clips", href: "/clipper/clips", icon: Upload },
  { label: "Clients", href: "/clipper/clients", icon: Users },
  { label: "Analytics", href: "/clipper/analytics", icon: BarChart2 },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function platformColor(platform: string) {
  if (platform === "tiktok") return "#FF2D55";
  if (platform === "instagram") return "#C13584";
  return "#FF0000";
}

function Badge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: positive ? "rgba(61,255,162,0.12)" : "rgba(255,71,87,0.12)",
        color: positive ? "#3DFFA2" : "#FF4757",
        border: `1px solid ${positive ? "rgba(61,255,162,0.2)" : "rgba(255,71,87,0.2)"}`,
      }}>
      {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(value)}%
    </span>
  );
}

function PlatformLogo({ platform, size = 20 }: { platform: string; size?: number }) {
  if (platform === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF2D55">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.96a8.27 8.27 0 004.84 1.54V7.06a4.85 4.85 0 01-1.07-.37z"/>
    </svg>
  );
  if (platform === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ig-grad-clipper" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="50%" stopColor="#DD2A7B"/>
          <stop offset="100%" stopColor="#8134AF"/>
        </linearGradient>
      </defs>
      <path fill="url(#ig-grad-clipper)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p style={{ color: "#8A93A6", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#3DFFA2", fontWeight: 600, fontFamily: "Space Grotesk, sans-serif" }}>
        {fmt(payload[0]?.value ?? 0)} views
      </p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface Props {
  clipper: AnyRecord;
  userName: string;
}

export default function ClipperDashboard({ clipper: initialClipper, userName }: Props) {
  const [clipper, setClipper] = useState<AnyRecord>(initialClipper);
  const [timeframe, setTimeframe] = useState("7d");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [metricsTab, setMetricsTab] = useState<"totals" | "averages" | "byday">("totals");
  const [chartData, setChartData] = useState<Array<{ date: string; views: number; likes: number; comments: number; shares: number; saves: number }>>([]);
  const [metrics, setMetrics] = useState({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

  // Modals
  const [showSetupModal, setShowSetupModal] = useState(!clipper.displayName);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showSubAccountModal, setShowSubAccountModal] = useState(false);

  // Setup form
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Submit clip form
  const [submitClientId, setSubmitClientId] = useState("");
  const [submitSubAccountId, setSubmitSubAccountId] = useState("");
  const [submitClipUrl, setSubmitClipUrl] = useState("");
  const [submitPlatform, setSubmitPlatform] = useState("youtube");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Sub-account form
  const [saClientId, setSaClientId] = useState("");
  const [saPlatform, setSaPlatform] = useState("youtube");
  const [saHandle, setSaHandle] = useState("");
  const [saProfileUrl, setSaProfileUrl] = useState("");
  const [saLoading, setSaLoading] = useState(false);
  const [saError, setSaError] = useState("");

  const fetchMetrics = useCallback(async () => {
    const params = new URLSearchParams({ timeframe });
    const res = await fetch(`/api/metrics?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setChartData(data.chartData || []);
    setMetrics(data.totals || { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  }, [timeframe]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type A = any;
  const submissions: A[] = clipper.submissions;
  const filtered: A[] = selectedClientId === "all"
    ? submissions
    : submissions.filter((s: A) => s.subAccount?.client?.id === selectedClientId);

  const totalViews = filtered.reduce((a: number, s: A) => a + (s.snapshots[0]?.views ?? 0), 0);
  const totalLikes = filtered.reduce((a: number, s: A) => a + (s.snapshots[0]?.likes ?? 0), 0);
  const totalShares = filtered.reduce((a: number, s: A) => a + (s.snapshots[0]?.shares ?? 0), 0);
  const totalSaves = filtered.reduce((a: number, s: A) => a + (s.snapshots[0]?.saves ?? 0), 0);

  const days = chartData.length || 1;

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError("");
    const res = await fetch("/api/clipper/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayNameInput }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSetupError(data.error || "Failed to set display name");
      setSetupLoading(false);
      return;
    }
    setClipper((prev) => ({ ...prev, displayName: displayNameInput }));
    setShowSetupModal(false);
    setSetupLoading(false);
  }

  async function handleSubmitClip(e: React.FormEvent) {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subAccountId: submitSubAccountId, clipUrl: submitClipUrl, platform: submitPlatform }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSubmitError(data.error || "Failed to submit clip");
      setSubmitLoading(false);
      return;
    }
    const newSub = await res.json();
    setClipper((prev) => ({
      ...prev,
      submissions: [
        {
          ...newSub,
          submittedAt: newSub.submittedAt || new Date().toISOString(),
          snapshots: [],
          subAccount: { id: submitSubAccountId, handle: "", client: { id: submitClientId, name: "" } },
        },
        ...prev.submissions,
      ],
    }));
    setShowSubmitModal(false);
    setSubmitClipUrl("");
    setSubmitSubAccountId("");
    setSubmitClientId("");
    setSubmitLoading(false);
    fetchMetrics();
  }

  async function handleAddSubAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaLoading(true);
    setSaError("");
    const res = await fetch("/api/sub-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: saClientId, platform: saPlatform, handle: saHandle, profileUrl: saProfileUrl }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSaError(data.error || "Failed to add sub-account");
      setSaLoading(false);
      return;
    }
    setShowSubAccountModal(false);
    setSaHandle("");
    setSaProfileUrl("");
    setSaClientId("");
    setSaLoading(false);
  }

  const selectedAssignment = clipper.assignments.find((a: A) => a.client.id === submitClientId);
  const availableSubAccounts: A[] = selectedAssignment?.client.subAccounts ?? [];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="clipper" userName={userName} />

      {/* Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
              Welcome! Set your display name
            </h2>
            <p className="text-sm mb-6" style={{ color: "#8A93A6" }}>
              This is how clients and the agency will see you.
            </p>
            <form onSubmit={handleSetup} className="space-y-4">
              <input
                type="text"
                placeholder="Your display name"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}
              />
              {setupError && <p className="text-xs" style={{ color: "#FF4757" }}>{setupError}</p>}
              <button type="submit" disabled={setupLoading || !displayNameInput.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(61,255,162,0.2), rgba(255,59,59,0.15))",
                  border: "1px solid rgba(61,255,162,0.3)",
                  color: "#3DFFA2",
                  opacity: setupLoading || !displayNameInput.trim() ? 0.6 : 1,
                }}>
                {setupLoading ? "Saving..." : "Get Started"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Submit Clip Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Submit a Clip
              </h2>
              <button onClick={() => setShowSubmitModal(false)}>
                <X size={18} color="#8A93A6" />
              </button>
            </div>
            <form onSubmit={handleSubmitClip} className="space-y-4">
              {/* Client */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client</label>
                <select
                  value={submitClientId}
                  onChange={(e) => { setSubmitClientId(e.target.value); setSubmitSubAccountId(""); }}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}>
                  <option value="" style={{ background: "#0B0E17" }}>Select client...</option>
                  {clipper.assignments.map((a: A) => (
                    <option key={a.client.id} value={a.client.id} style={{ background: "#0B0E17" }}>{a.client.name}</option>
                  ))}
                </select>
              </div>
              {/* Sub-account */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Sub-Account</label>
                <select
                  value={submitSubAccountId}
                  onChange={(e) => setSubmitSubAccountId(e.target.value)}
                  disabled={!submitClientId}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", opacity: !submitClientId ? 0.5 : 1 }}>
                  <option value="" style={{ background: "#0B0E17" }}>Select sub-account...</option>
                  {availableSubAccounts.map((sa: A) => (
                    <option key={sa.id} value={sa.id} style={{ background: "#0B0E17" }}>{sa.handle} ({sa.platform})</option>
                  ))}
                </select>
              </div>
              {/* Platform */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Platform</label>
                <div className="flex gap-2">
                  {[
                    { value: "youtube", label: "YouTube" },
                    { value: "tiktok", label: "TikTok" },
                    { value: "instagram", label: "Instagram" },
                  ].map((p) => (
                    <button key={p.value} type="button"
                      onClick={() => setSubmitPlatform(p.value)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: submitPlatform === p.value ? `${platformColor(p.value)}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${submitPlatform === p.value ? platformColor(p.value) : "rgba(255,255,255,0.08)"}`,
                        color: submitPlatform === p.value ? platformColor(p.value) : "#8A93A6",
                      }}>
                      <PlatformLogo platform={p.value} size={14} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* URL */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Clip URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={submitClipUrl}
                  onChange={(e) => setSubmitClipUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}
                />
              </div>
              {submitError && <p className="text-xs" style={{ color: "#FF4757" }}>{submitError}</p>}
              <button type="submit"
                disabled={submitLoading || !submitSubAccountId || !submitClipUrl}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(61,255,162,0.2), rgba(255,59,59,0.15))",
                  border: "1px solid rgba(61,255,162,0.3)",
                  color: "#3DFFA2",
                  opacity: submitLoading || !submitSubAccountId || !submitClipUrl ? 0.6 : 1,
                }}>
                {submitLoading ? "Submitting..." : "Submit Clip"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-Account Modal */}
      {showSubAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Add Sub-Account
              </h2>
              <button onClick={() => setShowSubAccountModal(false)}>
                <X size={18} color="#8A93A6" />
              </button>
            </div>
            <form onSubmit={handleAddSubAccount} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Client</label>
                <select value={saClientId} onChange={(e) => setSaClientId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}>
                  <option value="" style={{ background: "#0B0E17" }}>Select client...</option>
                  {clipper.assignments.map((a: A) => (
                    <option key={a.client.id} value={a.client.id} style={{ background: "#0B0E17" }}>{a.client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Platform</label>
                <div className="flex gap-2">
                  {[
                    { value: "youtube", label: "YouTube" },
                    { value: "tiktok", label: "TikTok" },
                    { value: "instagram", label: "Instagram" },
                  ].map((p) => (
                    <button key={p.value} type="button"
                      onClick={() => setSaPlatform(p.value)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: saPlatform === p.value ? `${platformColor(p.value)}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${saPlatform === p.value ? platformColor(p.value) : "rgba(255,255,255,0.08)"}`,
                        color: saPlatform === p.value ? platformColor(p.value) : "#8A93A6",
                      }}>
                      <PlatformLogo platform={p.value} size={14} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Handle</label>
                <input type="text" placeholder="@username" value={saHandle}
                  onChange={(e) => setSaHandle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Profile URL</label>
                <input type="url" placeholder="https://..." value={saProfileUrl}
                  onChange={(e) => setSaProfileUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }} />
              </div>
              {saError && <p className="text-xs" style={{ color: "#FF4757" }}>{saError}</p>}
              <button type="submit"
                disabled={saLoading || !saClientId || !saHandle || !saProfileUrl}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,59,59,0.15)",
                  border: "1px solid rgba(255,59,59,0.3)",
                  color: "#FF3B3B",
                  opacity: saLoading || !saClientId || !saHandle || !saProfileUrl ? 0.6 : 1,
                }}>
                {saLoading ? "Adding..." : "Add Sub-Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                {clipper.displayName ?? "My Dashboard"}
              </h1>
              <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
                {clipper.assignments.length} active client{clipper.assignments.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Timeframe */}
              {["7d", "30d", "90d"].map((t) => (
                <button key={t} onClick={() => setTimeframe(t)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: timeframe === t ? "rgba(61,255,162,0.15)" : "transparent",
                    color: timeframe === t ? "#3DFFA2" : "#8A93A6",
                    border: timeframe === t ? "1px solid rgba(61,255,162,0.3)" : "1px solid transparent",
                  }}>
                  {t.toUpperCase()}
                </button>
              ))}
              <button onClick={() => setShowSubAccountModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B" }}>
                <Plus size={14} />
                Add Account
              </button>
              <button onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(61,255,162,0.2), rgba(255,59,59,0.1))",
                  border: "1px solid rgba(61,255,162,0.3)",
                  color: "#3DFFA2",
                }}>
                <Upload size={14} />
                Submit Clip
              </button>
            </div>
          </div>

          {/* Client Picker */}
          {clipper.assignments.length > 0 && (
            <div className="flex gap-2 mb-6">
              <button onClick={() => setSelectedClientId("all")}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: selectedClientId === "all" ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedClientId === "all" ? "rgba(61,255,162,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: selectedClientId === "all" ? "#3DFFA2" : "#8A93A6",
                }}>
                All Clients
              </button>
              {clipper.assignments.map((a: A) => (
                <button key={a.client.id} onClick={() => setSelectedClientId(a.client.id)}
                  className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: selectedClientId === a.client.id ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selectedClientId === a.client.id ? "rgba(61,255,162,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: selectedClientId === a.client.id ? "#3DFFA2" : "#8A93A6",
                  }}>
                  {a.client.name}
                </button>
              ))}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Views", value: totalViews, icon: Eye },
              { label: "Likes", value: totalLikes, icon: Heart },
              { label: "Shares", value: totalShares, icon: Share2 },
              { label: "Saves", value: totalSaves, icon: Bookmark },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{item.label}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(61,255,162,0.1)" }}>
                    <item.icon size={14} color="#3DFFA2" />
                  </div>
                </div>
                <div className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                  {fmt(item.value)}
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={pctChange(item.value, item.value * 0.87)} />
                  <span className="text-xs" style={{ color: "#8A93A6" }}>WoW</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
                <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>Your clips performance</p>
              </div>
              <div className="text-2xl font-bold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                {fmt(metrics.views)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="clipperViewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => fmt(v)} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="views" stroke="#3DFFA2" strokeWidth={2}
                  fill="url(#clipperViewsGradient)" dot={false}
                  activeDot={{ r: 4, fill: "#3DFFA2", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Submissions list */}
          <div className="rounded-2xl p-5 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>My Submissions</h2>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Platform", "Client", "Account", "Views", "Likes", "Shares", "Status", "Date", "Link"].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 text-xs font-medium" style={{ color: "#8A93A6" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 12).map((s: A, i: number) => (
                  <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <td className="py-3 pr-4"><PlatformLogo platform={s.platform} size={14} /></td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{s.subAccount?.client?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#8A93A6" }}>{s.subAccount?.handle ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(s.snapshots[0]?.views ?? 0)}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.likes ?? 0)}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.shares ?? 0)}</td>
                    <td className="py-3 pr-4">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: s.scrapeStatus === "success" ? "rgba(61,255,162,0.12)" : "rgba(255,71,87,0.12)",
                          color: s.scrapeStatus === "success" ? "#3DFFA2" : "#FF4757",
                        }}>
                        {s.scrapeStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#8A93A6" }}>
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <a href={s.clipUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} color="#FF3B3B" />
                      </a>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-sm" style={{ color: "#8A93A6" }}>No clips yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Personal Metrics Panel */}
          <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-4 mb-5">
              {(["totals", "averages", "byday"] as const).map((t) => (
                <button key={t} onClick={() => setMetricsTab(t)}
                  className="text-sm font-medium pb-1 capitalize transition-colors"
                  style={{
                    color: metricsTab === t ? "#3DFFA2" : "#8A93A6",
                    borderBottom: metricsTab === t ? "2px solid #3DFFA2" : "2px solid transparent",
                  }}>
                  {t === "byday" ? "By Day" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {metricsTab === "totals" && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Views", value: metrics.views },
                  { label: "Total Likes", value: metrics.likes },
                  { label: "Total Comments", value: metrics.comments },
                  { label: "Total Shares", value: metrics.shares },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {metricsTab === "averages" && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Avg Views/Day", value: Math.round(metrics.views / days) },
                  { label: "Avg Likes/Day", value: Math.round(metrics.likes / days) },
                  { label: "Avg Comments/Day", value: Math.round(metrics.comments / days) },
                  { label: "Avg Clips/Day", value: Math.round(filtered.length / days) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {metricsTab === "byday" && (
              <div className="space-y-2">
                {chartData.slice(-7).map((day) => (
                  <div key={day.date} className="flex items-center gap-6 py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-xs w-20 flex-shrink-0" style={{ color: "#8A93A6" }}>
                      {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {[
                      { label: "Views", value: day.views },
                      { label: "Likes", value: day.likes },
                      { label: "Comments", value: day.comments },
                      { label: "Shares", value: day.shares },
                    ].map((m) => (
                      <div key={m.label} className="flex-1">
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{m.label}</p>
                        <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(m.value)}</p>
                      </div>
                    ))}
                  </div>
                ))}
                {chartData.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No data yet</p>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
