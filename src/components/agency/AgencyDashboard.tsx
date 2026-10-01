"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";
import ClientManagement from "@/components/agency/ClientManagement";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, Users, BarChart2,
  TrendingUp, TrendingDown, ExternalLink, ChevronDown, RotateCw,
  X, Check, Link2,
} from "lucide-react";
import PlatformStatsCards, { PlatformBreakdownTable } from "@/components/shared/PlatformStatsCards";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
type TimePeriod = "all" | "1d" | "7d" | "mtd" | "custom";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(period: TimePeriod, cs: string, ce: string): [Date, Date] {
  const now = new Date();
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  if (period === "all") return [new Date(0), new Date("2099-12-31T23:59:59")];
  if (period === "1d") {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    return [s, eod];
  }
  if (period === "7d") {
    const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
    return [s, eod];
  }
  if (period === "mtd") {
    return [new Date(now.getFullYear(), now.getMonth(), 1), eod];
  }
  return [
    cs ? new Date(cs + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1),
    ce ? new Date(ce + "T23:59:59") : eod,
  ];
}

function getPrevRange(s: Date, e: Date): [Date, Date] {
  const dur = e.getTime() - s.getTime();
  return [new Date(s.getTime() - dur - 1), new Date(s.getTime() - 1)];
}

function inRange(clips: AnyRecord[], s: Date, e: Date): AnyRecord[] {
  return clips.filter((c) => { const d = new Date(c.submittedAt); return d >= s && d <= e; });
}

function pct(curr: number, prev: number) {
  if (curr === 0 && prev === 0) return { str: "—", pos: true, ok: false };
  if (prev === 0) return { str: `+${Math.min(curr, 999)}%`, pos: true, ok: true };
  const p = ((curr - prev) / prev) * 100;
  const clamped = Math.max(-999, Math.min(999, Math.round(p)));
  return { str: `${clamped >= 0 ? "+" : ""}${clamped}%`, pos: p >= 0, ok: true };
}

function prevLabel(period: TimePeriod, cs: string, ce: string) {
  if (period === "all") return "all time";
  if (period === "1d") return "vs. yesterday";
  if (period === "7d") return "vs. prev. 7 days";
  if (period === "mtd") return "vs. prev. month (same period)";
  if (cs && ce) {
    const days = Math.round((new Date(ce).getTime() - new Date(cs).getTime()) / 86400000) + 1;
    return `vs. prev. ${days} days`;
  }
  return "vs. prev. period";
}

interface Props {
  userName: string;
  clients: AnyRecord[];
  allClients: AnyRecord[];
  clips: AnyRecord[];
  totalViews: number;
  pendingClientUsers?: AnyRecord[];
}

export default function AgencyDashboard({ userName, clients, allClients, clips: initialClips, pendingClientUsers = [] }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "clips" | "platform-stats">("overview");
  const [allClips] = useState<AnyRecord[]>(initialClips);
  const [showLiveLinkModal, setShowLiveLinkModal] = useState(false);
  const [liveLinkClientId, setLiveLinkClientId] = useState("");
  const [liveLinkCopied, setLiveLinkCopied] = useState(false);
  const [liveLinkLoading, setLiveLinkLoading] = useState(false);

  async function handleGetLiveLink() {
    if (!liveLinkClientId || liveLinkLoading) return;
    setLiveLinkLoading(true);
    const res = await fetch(`/api/agency/clients/${liveLinkClientId}/share-token`, { method: "POST" });
    if (res.ok) {
      const { token } = await res.json();
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      setLiveLinkCopied(true);
      setTimeout(() => setLiveLinkCopied(false), 2500);
    }
    setLiveLinkLoading(false);
  }

  // Controls
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));

  const activeClients = clients.filter((c) => c.status === "active");

  // Client filter
  const clientClips = selectedClientId === "all" ? allClips : allClips.filter((c) => c.clientId === selectedClientId);
  const selectedClient = allClients.find((c) => c.id === selectedClientId) ?? null;

  // Time range filter
  const [rangeStart, rangeEnd] = getRange(timePeriod, customStart, customEnd);
  const filteredClips = inRange(clientClips, rangeStart, rangeEnd);
  const prevClips = timePeriod === "all"
    ? []
    : (() => { const [ps, pe] = getPrevRange(rangeStart, rangeEnd); return inRange(clientClips, ps, pe); })();

  // Current period stats
  const currViews = filteredClips.reduce((a, c) => a + (c.views ?? 0), 0);
  const currLikes = filteredClips.reduce((a, c) => a + (c.likes ?? 0), 0);
  const currComments = filteredClips.reduce((a, c) => a + (c.comments ?? 0), 0);
  const currShares = filteredClips.reduce((a, c) => a + (c.shares ?? 0), 0);
  const currSaves = filteredClips.reduce((a, c) => a + (c.saves ?? 0), 0);

  // Prev period stats
  const prevViews = prevClips.reduce((a, c) => a + (c.views ?? 0), 0);
  const prevLikes = prevClips.reduce((a, c) => a + (c.likes ?? 0), 0);
  const prevComments = prevClips.reduce((a, c) => a + (c.comments ?? 0), 0);
  const prevShares = prevClips.reduce((a, c) => a + (c.shares ?? 0), 0);
  const prevSaves = prevClips.reduce((a, c) => a + (c.saves ?? 0), 0);
  const prevClipCount = prevClips.length;

  // Platform stats
  const viewsByPlatform: Record<string, number> = {};
  const clipsByPlatform: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const p = (c.subAccount?.platform ?? c.platform ?? "other") as string;
    viewsByPlatform[p] = (viewsByPlatform[p] ?? 0) + (c.views ?? 0);
    clipsByPlatform[p] = (clipsByPlatform[p] ?? 0) + 1;
  });

  // Chart from filtered clips
  const byDate: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const date = (c.submittedAt as string).slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + (c.views ?? 0);
  });
  const prevByDate: Record<string, number> = {};
  prevClips.forEach((c) => {
    const date = (c.submittedAt as string).slice(0, 10);
    prevByDate[date] = (prevByDate[date] ?? 0) + (c.views ?? 0);
  });
  const currChartDates = Object.keys(byDate).sort();
  const prevChartDates = Object.keys(prevByDate).sort();
  const chartData = currChartDates.map((date, i) => ({
    date,
    views: byDate[date] ?? 0,
    prevViews: prevChartDates[i] !== undefined ? (prevByDate[prevChartDates[i]] ?? 0) : undefined,
  }));

  const topClips = [...filteredClips].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  const statItems = [
    { label: "Views", value: fmt(currViews), icon: Eye, color: "var(--accent)", change: pct(currViews, prevViews) },
    { label: "Likes", value: fmt(currLikes), icon: Heart, color: "var(--accent)", change: pct(currLikes, prevLikes) },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, color: "var(--accent)", change: pct(currComments, prevComments) },
    { label: "Shares", value: fmt(currShares), icon: Share2, color: "var(--accent)", change: pct(currShares, prevShares) },
    { label: "Saves", value: fmt(currSaves), icon: Bookmark, color: "var(--accent)", change: pct(currSaves, prevSaves) },
    { label: "Clips", value: filteredClips.length.toString(), icon: BarChart2, color: "var(--accent)", change: pct(filteredClips.length, prevClipCount) },
  ];

  const tooltipStyle = {
    contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 },
    labelStyle: { color: "var(--text-secondary)" },
  };

  const activeClientsForDisplay = selectedClientId === "all"
    ? activeClients
    : clients.filter((c) => c.id === selectedClientId);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
      {showLiveLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-xl p-8 w-full max-w-sm fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.25)" }}>
                  <Link2 size={14} color="var(--accent)" />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Live Tracker Link</h2>
              </div>
              <button onClick={() => { setShowLiveLinkModal(false); setLiveLinkCopied(false); }}><X size={18} color="#8A93A6" /></button>
            </div>
            <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.15)" }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--accent)" }}>What your client sees:</p>
              <ul className="space-y-1">
                {["Live views, likes, shares & engagement stats", "Top performing clips with thumbnails & links", "Individual clip breakdown by platform", "Platform-by-platform performance charts", "Real-time deal progress tracking"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                    <span style={{ color: "var(--accent)", fontSize: 10 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-5">
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Client</label>
              <select value={liveLinkClientId} onChange={(e) => setLiveLinkClientId(e.target.value)}
                className="w-full outline-none appearance-none px-3 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}>
                <option value="" style={{ background: "var(--bg-surface)" }}>Choose a client…</option>
                {allClients.filter((c) => (c as AnyRecord).status === "active").map((c) => (
                  <option key={c.id} value={c.id} style={{ background: "var(--bg-surface)" }}>{(c as AnyRecord).name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleGetLiveLink} disabled={!liveLinkClientId || liveLinkLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: liveLinkCopied ? "rgba(61,255,162,0.15)" : "rgba(255,59,59,0.15)", border: `1px solid ${liveLinkCopied ? "rgba(61,255,162,0.3)" : "rgba(255,59,59,0.3)"}`, color: liveLinkCopied ? "var(--success)" : "var(--accent)", opacity: (!liveLinkClientId || liveLinkLoading) ? 0.5 : 1 }}>
              {liveLinkLoading ? (
                <><RotateCw size={14} className="animate-spin" /> Generating…</>
              ) : liveLinkCopied ? (
                <><Check size={14} /> Link Copied!</>
              ) : (
                <><Link2 size={14} /> Copy Live Link</>
              )}
            </button>
          </div>
        </div>
      )}
      <Sidebar role="agency" userName={userName} />
      <main className="flex-1 overflow-y-auto ml-56">
        {/* Tab bar */}
        <div className="sticky top-0 z-30 px-8 pt-6 pb-0" style={{ background: "var(--bg-elevated)" }}>
          <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "clients", label: `Clients (${clients.length})` },
              { id: "clips", label: `Clips (${allClips.length})` },
              { id: "platform-stats", label: "Platform Stats" },
            ] as const).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-all relative tab-btn"
                style={{ color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {activeTab === "overview" && <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {selectedClient ? selectedClient.name : "Overview"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selectedClient ? "Single client view" : "All clients & clippers"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowLiveLinkModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: "var(--accent-muted)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)" }}>
                  <Link2 size={11} /> Share Live Tracker
                </button>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              {/* Client selector */}
              <div className="relative">
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl cursor-pointer outline-none"
                  style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-primary)", minWidth: 150 }}>
                  <option value="all" style={{ background: "var(--bg-surface)" }}>All Clients</option>
                  {allClients.filter((c) => c.status === "active").map((c) => (
                    <option key={c.id} value={c.id} style={{ background: "var(--bg-surface)" }}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} color="#8A93A6" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "var(--border-default)", flexShrink: 0 }} />

              {/* Time period pills */}
              <div className="flex items-center gap-0.5 rounded-xl p-0.5"
                style={{ background: "var(--border-subtle)", border: "1px solid var(--border-subtle)" }}>
                {(["all", "1d", "7d", "mtd", "custom"] as const).map((p) => (
                  <button key={p} onClick={() => setTimePeriod(p)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      background: timePeriod === p ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
                      color: timePeriod === p ? "var(--accent)" : "var(--text-tertiary)",
                    }}>
                    {p === "all" ? "All" : p === "1d" ? "Day" : p === "7d" ? "Week" : p === "mtd" ? "MTD" : "Custom"}
                  </button>
                ))}
              </div>

              {/* Custom date inputs */}
              {timePeriod === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customStart} max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl outline-none"
                    style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-primary)", colorScheme: "dark" }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>to</span>
                  <input type="date" value={customEnd} min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl outline-none"
                    style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-primary)", colorScheme: "dark" }} />
                </div>
              )}
            </div>

            {/* ── Stats bar ───────────────────────────────────────────── */}
            <div className="rounded-xl mb-2 overflow-hidden fade-up" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <div className="grid grid-cols-6">
                {statItems.map((item, i) => {
                  const Icon = item.icon;
                  const borderRight = i < 5 ? "1px solid rgba(255,255,255,0.06)" : "none";
                  return (
                    <div key={item.label} className="flex flex-col items-center justify-center gap-1.5 px-4 py-4"
                      style={{ borderRight }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${item.color}18` }}>
                        <Icon size={14} color={item.color} />
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
                      <span className="text-lg font-bold leading-none" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                        {item.value}
                      </span>
                      {item.change.ok && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold leading-none"
                          style={{ color: item.change.pos ? "var(--success)" : "var(--danger)" }}>
                          {item.change.pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {item.change.str}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{prevLabel(timePeriod, customStart, customEnd)}</p>
              </div>
            </div>

            {/* ── Views chart ─────────────────────────────────────────── */}
            <div className="rounded-xl p-6 mb-6 mt-5 fade-up delay-1" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                Views Over Time{selectedClient ? ` · ${selectedClient.name}` : ""}
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.82} />
                        <stop offset="55%" stopColor="var(--accent)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => fmtDate(v)} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmt(Number(v))} width={48} />
                    <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "var(--success)" }} />
                    {timePeriod !== "all" && (
                      <Area name="Prev Period" type="linear" dataKey="prevViews" stroke="rgba(255,255,255,0.18)"
                        strokeWidth={1.5} fill="none" strokeDasharray="5 3" dot={false} />
                    )}
                    <Area name="Views" type="linear" dataKey="views" stroke="var(--accent)" strokeWidth={2} fill="url(#agGrad)"
                      dot={{ fill: "var(--accent)", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "var(--accent)", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm py-10 text-center" style={{ color: "var(--text-secondary)" }}>No clips in this period</p>
              )}
            </div>

            {/* ── Platform Stats ──────────────────────────────────────── */}
            <div className="mb-6 fade-up delay-2">
              <PlatformStatsCards viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
            </div>

            {/* ── Top Clips ────────────────────────────────────────────── */}
            <div className="mb-6 fade-up delay-3">
              <div className="rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} color="var(--accent)" />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Top Clips</h2>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Views</span>
                </div>
                <div className="space-y-3">
                  {topClips.map((clip, i) => (
                    <div key={clip.id} className="flex items-center gap-2">
                      <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{i + 1}</span>
                      {clip.thumbnailUrl ? (
                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover" style={{ width: 36, height: 36 }} />
                        </a>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <PlatformIcon platform={clip.subAccount?.platform ?? "other"} size={11} />
                          <span className="text-xs truncate font-medium" style={{ color: PLATFORM_COLORS[clip.subAccount?.platform] ?? "var(--text-tertiary)" }}>@{clip.subAccount?.handle}</span>
                          <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>· {clip.clipper?.name}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: "var(--success)", fontFamily: "var(--font-display)" }}>{fmt(clip.views ?? 0)}</span>
                      <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <ExternalLink size={11} color="var(--accent)" />
                      </a>
                    </div>
                  ))}
                  {topClips.length === 0 && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No clips in this period</p>}
                </div>
              </div>
            </div>

          </>}



          {/* ── CLIENTS TAB ───────────────────────────────────────────── */}
          {activeTab === "clients" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ClientManagement initialClients={clients as any} pendingClientUsers={pendingClientUsers as any} allClients={allClients as any} />
          )}


          {/* ── PLATFORM STATS TAB ────────────────────────────────────── */}
          {activeTab === "platform-stats" && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Platform Stats</h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>View and post breakdown across platforms</p>
              </div>
              <div className="mb-6">
                <PlatformStatsCards viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
              </div>
              <PlatformBreakdownTable viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
            </div>
          )}

          {/* ── CLIPS TAB ─────────────────────────────────────────────── */}
          {activeTab === "clips" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>All Clips</h1>
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{allClips.length} clips total</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Platform", "Preview", "Title", "Account", "Client", "Views", "Likes", "Comments", "Shares", "Date", "Link"].map((h) => (
                        <th key={h} className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider"
                          style={{ color: "var(--text-secondary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allClips.map((clip, i) => (
                      <tr key={clip.id}
                        style={{ borderBottom: i < allClips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold capitalize"
                            style={{ color: PLATFORM_COLORS[clip.subAccount?.platform] ?? "var(--text-tertiary)" }}>
                            {clip.subAccount?.platform ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {clip.thumbnailUrl ? (
                            <a href={clip.url} target="_blank" rel="noopener noreferrer">
                              <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover"
                                style={{ width: 64, height: 36 }} />
                            </a>
                          ) : (
                            <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)", maxWidth: 120 }}>
                          <span className="truncate block">{clip.title ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          @{clip.subAccount?.handle ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>
                          {clip.client?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--success)" }}>{fmt(clip.views ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{fmt(clip.likes ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{fmt(clip.comments ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{fmt(clip.shares ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {clip.submittedAt
                            ? new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <a href={clip.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={12} color="var(--accent)" />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {allClips.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                          No clips yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
