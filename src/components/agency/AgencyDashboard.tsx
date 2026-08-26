"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/shared/Sidebar";
import {
  LayoutDashboard, Users, Scissors, BarChart2, Settings,
  Eye, Heart, Share2, MessageCircle, Bookmark, RefreshCw,
  TrendingUp, TrendingDown, ExternalLink, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface AgencyDashboardProps {
  clients: AnyRecord[];
  clippers: AnyRecord[];
  submissions: AnyRecord[];
  totalViews: number;
  userName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  if (platform === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF2D55">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.96a8.27 8.27 0 004.84 1.54V7.06a4.85 4.85 0 01-1.07-.37z"/>
    </svg>
  );
  if (platform === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ig-grad-agency" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="50%" stopColor="#DD2A7B"/>
          <stop offset="100%" stopColor="#8134AF"/>
        </linearGradient>
      </defs>
      <path fill="url(#ig-grad-agency)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
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

function KpiCard({ label, value, icon: Icon, wow, dod }: {
  label: string; value: number; icon: React.ElementType; wow: number; dod: number;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,59,59,0.1)" }}>
          <Icon size={14} color="#FF3B3B" />
        </div>
      </div>
      <div className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
        {fmt(value)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge value={wow} />
        <span className="text-xs" style={{ color: "#8A93A6" }}>WoW</span>
        <Badge value={dod} />
        <span className="text-xs" style={{ color: "#8A93A6" }}>DoD</span>
      </div>
    </div>
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

const navItems = [
  { label: "Overview", href: "/agency", icon: LayoutDashboard },
  { label: "Clients", href: "/agency/clients", icon: Users },
  { label: "Clippers", href: "/agency/clippers", icon: Scissors },
  { label: "Analytics", href: "/agency/analytics", icon: BarChart2 },
  { label: "Settings", href: "/agency/settings", icon: Settings },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AgencyDashboard({ clients, clippers, submissions, totalViews: _totalViews, userName }: AgencyDashboardProps) {
  const [activeSection, setActiveSection] = useState<"overview" | "clients" | "clippers">("overview");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [timeframe, setTimeframe] = useState("7d");
  const [activeTab, setActiveTab] = useState<"averages" | "byday" | "totals">("totals");
  const [chartData, setChartData] = useState<Array<{ date: string; views: number; likes: number; comments: number; shares: number; saves: number }>>([]);
  const [metrics, setMetrics] = useState({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  const fetchMetrics = useCallback(async () => {
    const params = new URLSearchParams({ timeframe });
    if (selectedClientId !== "all") params.set("clientId", selectedClientId);
    const res = await fetch(`/api/metrics?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setChartData(data.chartData || []);
    setMetrics(data.totals || { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  }, [selectedClientId, timeframe]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useEffect(() => {
    const id = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetch("/api/scrape", { method: "POST" });
    setTimeout(() => { fetchMetrics(); setIsRefreshing(false); }, 3000);
  }

  // Derive filtered submissions
  const filtered = selectedClientId === "all"
    ? submissions
    : submissions.filter((s) => s.subAccount?.client?.id === selectedClientId);

  const topSubmissions = [...filtered]
    .sort((a, b) => (b.snapshots[0]?.views ?? 0) - (a.snapshots[0]?.views ?? 0))
    .slice(0, 10);

  const clipperStats: AnyRecord[] = clippers.map((c) => {
    const clipperSubs = filtered.filter(
      (s) => s.clipper?.user?.name === c.user.name || s.clipper?.displayName === c.displayName
    );
    const views = clipperSubs.reduce((acc: number, s: AnyRecord) => acc + (s.snapshots[0]?.views ?? 0), 0);
    return { ...c, totalViews: views, videoCount: clipperSubs.length } as AnyRecord;
  }).sort((a: AnyRecord, b: AnyRecord) => b.totalViews - a.totalViews);

  const clientStats: AnyRecord[] = clients.map((c) => {
    const clientSubs = submissions.filter((s) => s.subAccount?.client?.id === c.id);
    const views = clientSubs.reduce((acc: number, s: AnyRecord) => acc + (s.snapshots[0]?.views ?? 0), 0);
    return { ...c, totalViews: views } as AnyRecord;
  }).sort((a: AnyRecord, b: AnyRecord) => b.totalViews - a.totalViews);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const prevPeriodMultiplier = 0.85;
  const wow = pctChange(metrics.views, metrics.views * prevPeriodMultiplier);
  const dod = pctChange(metrics.views, metrics.views * 0.97);

  const days = chartData.length || 1;
  const avgViews = Math.round(metrics.views / days);
  const avgLikes = Math.round(metrics.likes / days);
  const avgComments = Math.round(metrics.comments / days);
  const avgShares = Math.round(metrics.shares / days);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={userName} navItems={navItems} />

      <main className="flex-1 overflow-y-auto ml-60">
        {/* Top navigation tabs */}
        <div className="sticky top-0 z-30 px-8 pt-6 pb-0" style={{ background: "#05070D" }}>
          <div className="flex items-center gap-1 mb-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "clients", label: "Clients" },
              { id: "clippers", label: "Clippers" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-all relative"
                style={{ color: activeSection === tab.id ? "#F5F6FA" : "#8A93A6" }}
              >
                {tab.label}
                {activeSection === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header — only shown on overview */}
          {activeSection === "overview" && <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Overview
              </h1>
              <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
                {selectedClientId === "all" ? "All Clients" : selectedClient?.name ?? ""}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Client selector */}
              <div className="relative">
                <button
                  onClick={() => setShowClientPicker(!showClientPicker)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F6FA" }}>
                  {selectedClientId === "all" ? "All Clients" : selectedClient?.name}
                  <ChevronDown size={14} color="#8A93A6" />
                </button>
                {showClientPicker && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl py-1 z-50"
                    style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <button
                      onClick={() => { setSelectedClientId("all"); setShowClientPicker(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                      style={{ color: selectedClientId === "all" ? "#FF3B3B" : "#F5F6FA" }}>
                      All Clients
                    </button>
                    {clients.map((c) => (
                      <button key={c.id}
                        onClick={() => { setSelectedClientId(c.id); setShowClientPicker(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                        style={{ color: selectedClientId === c.id ? "#FF3B3B" : "#F5F6FA" }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeframe */}
              {["1d", "7d", "30d", "90d"].map((t) => (
                <button key={t}
                  onClick={() => setTimeframe(t)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: timeframe === t ? "rgba(255,59,59,0.15)" : "transparent",
                    color: timeframe === t ? "#FF3B3B" : "#8A93A6",
                    border: timeframe === t ? "1px solid rgba(255,59,59,0.3)" : "1px solid transparent",
                  }}>
                  {t.toUpperCase()}
                </button>
              ))}

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "rgba(255,59,59,0.1)",
                  border: "1px solid rgba(255,59,59,0.2)",
                  color: "#FF3B3B",
                  opacity: isRefreshing ? 0.6 : 1,
                }}>
                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                {isRefreshing ? "Syncing..." : "Refresh"}
              </button>
            </div>
          </div>}

          {/* Clients section */}
          {activeSection === "clients" && (
            <div>
              <h1 className="text-2xl font-semibold mb-6" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clients</h1>
              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Client", "Status", "Package", "Clippers", "Sub-accounts"].map((h) => (
                        <th key={h} className="text-left pb-3 pr-6 text-xs font-medium" style={{ color: "#8A93A6" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: i < clients.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B" }}>{c.name[0]}</div>
                            <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-6">
                          <span className="text-xs px-2 py-1 rounded-full"
                            style={{ background: c.status === "active" ? "rgba(61,255,162,0.1)" : "rgba(255,255,255,0.05)", color: c.status === "active" ? "#3DFFA2" : "#8A93A6" }}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 pr-6 text-xs" style={{ color: "#8A93A6" }}>{c.packageInfo || "—"}</td>
                        <td className="py-3 pr-6 text-xs" style={{ color: "#F5F6FA" }}>{c.assignments?.length ?? 0}</td>
                        <td className="py-3 text-xs" style={{ color: "#F5F6FA" }}>{c.subAccounts?.length ?? 0}</td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: "#8A93A6" }}>No clients yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Clippers section */}
          {activeSection === "clippers" && (
            <div>
              <h1 className="text-2xl font-semibold mb-6" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clippers</h1>
              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Clipper", "Email", "Clients", "Clips Submitted", "Total Views"].map((h) => (
                        <th key={h} className="text-left pb-3 pr-6 text-xs font-medium" style={{ color: "#8A93A6" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clippers.map((c, i) => {
                      const totalViews = submissions
                        .filter((s) => s.clipper?.user?.name === c.user?.name)
                        .reduce((acc: number, s: AnyRecord) => acc + (s.snapshots[0]?.views ?? 0), 0);
                      return (
                        <tr key={c.id} style={{ borderBottom: i < clippers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                          <td className="py-3 pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                                {(c.displayName || c.user?.name || "C")[0]}
                              </div>
                              <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.displayName || c.user?.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-6 text-xs" style={{ color: "#8A93A6" }}>{c.user?.email}</td>
                          <td className="py-3 pr-6 text-xs" style={{ color: "#F5F6FA" }}>{c.assignments?.length ?? 0}</td>
                          <td className="py-3 pr-6 text-xs" style={{ color: "#F5F6FA" }}>{c.submissions?.length ?? 0}</td>
                          <td className="py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(totalViews)}</td>
                        </tr>
                      );
                    })}
                    {clippers.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: "#8A93A6" }}>No clippers yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overview content */}
          {activeSection === "overview" && <>
          <div className="grid grid-cols-5 gap-4 mb-8">
            <KpiCard label="Views" value={metrics.views} icon={Eye} wow={wow} dod={dod} />
            <KpiCard label="Likes" value={metrics.likes} icon={Heart}
              wow={pctChange(metrics.likes, metrics.likes * 0.88)}
              dod={pctChange(metrics.likes, metrics.likes * 0.96)} />
            <KpiCard label="Comments" value={metrics.comments} icon={MessageCircle}
              wow={pctChange(metrics.comments, metrics.comments * 0.91)}
              dod={pctChange(metrics.comments, metrics.comments * 0.98)} />
            <KpiCard label="Shares" value={metrics.shares} icon={Share2}
              wow={pctChange(metrics.shares, metrics.shares * 0.86)}
              dod={pctChange(metrics.shares, metrics.shares * 0.95)} />
            <KpiCard label="Saves" value={metrics.saves} icon={Bookmark}
              wow={pctChange(metrics.saves, metrics.saves * 0.89)}
              dod={pctChange(metrics.saves, metrics.saves * 0.97)} />
          </div>

          {/* Chart */}
          <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
                <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>Daily peak view count</p>
              </div>
              <div className="text-2xl font-bold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                {fmt(metrics.views)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="agencyViewsGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#agencyViewsGradient)" dot={false}
                  activeDot={{ r: 4, fill: "#3DFFA2", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tables row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Top Clients */}
            <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clients</h2>
              <div className="space-y-3">
                {clientStats.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xs w-4 text-right" style={{ color: "#8A93A6" }}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B" }}>
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                      <p className="text-xs" style={{ color: "#8A93A6" }}>{c.status}</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                      {fmt(c.totalViews)}
                    </span>
                  </div>
                ))}
                {clientStats.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clients yet</p>}
              </div>
            </div>

            {/* Top Clippers */}
            <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clippers</h2>
              <div className="space-y-3">
                {clipperStats.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xs w-4 text-right" style={{ color: "#8A93A6" }}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                      {(c.displayName || c.user.name || "C")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>
                        {c.displayName || c.user.name || "Unnamed"}
                      </p>
                      <p className="text-xs" style={{ color: "#8A93A6" }}>{c.videoCount} clips</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                      {fmt(c.totalViews)}
                    </span>
                  </div>
                ))}
                {clipperStats.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clippers yet</p>}
              </div>
            </div>
          </div>

          {/* Top Performing Videos */}
          <div className="rounded-2xl p-5 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Performing Videos</h2>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Platform", "Client", "Clipper", "Views", "Likes", "Comments", "Shares", "Link"].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 text-xs font-medium" style={{ color: "#8A93A6" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSubmissions.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < topSubmissions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <td className="py-3 pr-4"><PlatformIcon platform={s.platform} /></td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{s.subAccount?.client?.name}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#8A93A6" }}>{s.clipper?.displayName || s.clipper?.user?.name}</td>
                    <td className="py-3 pr-4 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(s.snapshots[0]?.views ?? 0)}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.likes ?? 0)}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.comments ?? 0)}</td>
                    <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.shares ?? 0)}</td>
                    <td className="py-3">
                      <a href={s.clipUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={12} color="#FF3B3B" />
                      </a>
                    </td>
                  </tr>
                ))}
                {topSubmissions.length === 0 && (
                  <tr><td colSpan={8} className="py-6 text-center text-sm" style={{ color: "#8A93A6" }}>No submissions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Metrics Panel */}
          <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-4 mb-5">
              {(["totals", "averages", "byday"] as const).map((t) => (
                <button key={t}
                  onClick={() => setActiveTab(t)}
                  className="text-sm font-medium pb-1 capitalize transition-colors"
                  style={{
                    color: activeTab === t ? "#FF3B3B" : "#8A93A6",
                    borderBottom: activeTab === t ? "2px solid #FF3B3B" : "2px solid transparent",
                  }}>
                  {t === "byday" ? "By Day" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "totals" && (
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: "Total Views", value: metrics.views },
                  { label: "Total Likes", value: metrics.likes },
                  { label: "Total Comments", value: metrics.comments },
                  { label: "Total Shares", value: metrics.shares },
                  { label: "Total Saves", value: metrics.saves },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "averages" && (
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: "Avg Views/Day", value: avgViews },
                  { label: "Avg Likes/Day", value: avgLikes },
                  { label: "Avg Comments/Day", value: avgComments },
                  { label: "Avg Shares/Day", value: avgShares },
                  { label: "Avg Videos/Day", value: Math.round(filtered.length / days) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "byday" && (
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
          </>}
        </div>
      </main>
    </div>
  );
}
