"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";
import ClientManagement from "@/components/agency/ClientManagement";
import ClipperManagement from "@/components/agency/ClipperManagement";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, Users, Scissors, BarChart2,
  TrendingUp, TrendingDown, ExternalLink, ChevronDown, RotateCw,
} from "lucide-react";
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
  if (prev === 0) return { str: "+∞", pos: true, ok: true };
  const p = ((curr - prev) / prev) * 100;
  return { str: `${p >= 0 ? "+" : ""}${Math.round(p)}%`, pos: p >= 0, ok: true };
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
  clippers: AnyRecord[];
  allClients: AnyRecord[];
  clips: AnyRecord[];
  totalViews: number;
}

export default function AgencyDashboard({ userName, clients, clippers, allClients, clips: initialClips }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "clippers" | "clips">("overview");
  const [allClips, setAllClips] = useState<AnyRecord[]>(initialClips);
  const [refreshingClip, setRefreshingClip] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  async function handleRefreshAll() {
    if (refreshingAll || allClips.length === 0) return;
    setRefreshingAll(true);
    for (const clip of allClips.slice(0, 50)) {
      const res = await fetch(`/api/clips/${clip.id}`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setAllClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, views: updated.views, likes: updated.likes, comments: updated.comments, shares: updated.shares, saves: updated.saves, lastScraped: updated.lastScraped } : c));
      }
    }
    setRefreshingAll(false);
    setLastSynced(new Date());
  }


  async function handleRefreshClip(clipId: string) {
    setRefreshingClip(clipId);
    const res = await fetch(`/api/clips/${clipId}`, { method: "PATCH" });
    if (res.ok) {
      const updated = await res.json();
      setAllClips((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? { ...c, views: updated.views, likes: updated.likes, comments: updated.comments, shares: updated.shares, saves: updated.saves, lastScraped: updated.lastScraped }
            : c
        )
      );
    }
    setRefreshingClip(null);
  }

  // Controls
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("7d");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));

  const pendingClippers = clippers.filter((c) => c.status === "pending").length;
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

  // Chart from filtered clips
  const byDate: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const date = (c.submittedAt as string).slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + (c.views ?? 0);
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));

  // Top clippers from filtered
  const clipperMap: Record<string, { name: string; views: number; likes: number; comments: number; shares: number; saves: number; clips: number }> = {};
  filteredClips.forEach((c) => {
    const name = c.clipper?.name ?? "Unknown";
    if (!clipperMap[name]) clipperMap[name] = { name, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clips: 0 };
    clipperMap[name].views += c.views ?? 0;
    clipperMap[name].likes += c.likes ?? 0;
    clipperMap[name].comments += c.comments ?? 0;
    clipperMap[name].shares += c.shares ?? 0;
    clipperMap[name].saves += c.saves ?? 0;
    clipperMap[name].clips += 1;
  });
  const topClippers = Object.values(clipperMap).sort((a, b) => b.views - a.views).slice(0, 5);
  const topClips = [...filteredClips].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);

  const statItems = [
    { label: "Views", value: fmt(currViews), icon: Eye, color: "#FF3B3B", change: pct(currViews, prevViews) },
    { label: "Likes", value: fmt(currLikes), icon: Heart, color: "#3DFFA2", change: pct(currLikes, prevLikes) },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, color: "#a78bfa", change: pct(currComments, prevComments) },
    { label: "Shares", value: fmt(currShares), icon: Share2, color: "#60a5fa", change: pct(currShares, prevShares) },
    { label: "Saves", value: fmt(currSaves), icon: Bookmark, color: "#FFA500", change: pct(currSaves, prevSaves) },
    { label: "Clips", value: filteredClips.length.toString(), icon: BarChart2, color: "#FF3B3B", change: pct(filteredClips.length, prevClipCount) },
  ];

  const tooltipStyle = {
    contentStyle: { background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 },
    labelStyle: { color: "#8A93A6" },
  };

  const activeClientsForDisplay = selectedClientId === "all"
    ? activeClients
    : clients.filter((c) => c.id === selectedClientId);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={userName} />
      <main className="flex-1 overflow-y-auto ml-60">
        {/* Tab bar */}
        <div className="sticky top-0 z-30 px-8 pt-6 pb-0" style={{ background: "#05070D" }}>
          <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "clients", label: `Clients (${clients.length})` },
              { id: "clippers", label: `Clippers${pendingClippers > 0 ? ` · ${pendingClippers} pending` : ""}` },
              { id: "clips", label: `Clips (${allClips.length})` },
            ] as const).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-all relative tab-btn"
                style={{ color: activeTab === tab.id ? "#F5F6FA" : "#8A93A6" }}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {activeTab === "overview" && <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                  {selectedClient ? selectedClient.name : "Overview"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "#8A93A6" }}>
                  {selectedClient ? "Single client view" : "All clients & clippers"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {lastSynced && (
                  <span className="text-xs" style={{ color: "#8A93A6" }}>
                    Updated {Math.round((Date.now() - lastSynced.getTime()) / 60000)}m ago
                  </span>
                )}
                <button onClick={handleRefreshAll} disabled={refreshingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B", opacity: refreshingAll ? 0.5 : 1 }}>
                  <RotateCw size={11} className={refreshingAll ? "animate-spin" : ""} />
                  {refreshingAll ? "Syncing…" : "Sync Stats"}
                </button>
                {pendingClippers > 0 && (
                  <button onClick={() => setActiveTab("clippers")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.25)", color: "#FFA500" }}>
                    <Scissors size={13} />
                    {pendingClippers} clipper{pendingClippers > 1 ? "s" : ""} awaiting assignment
                  </button>
                )}
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              {/* Client selector */}
              <div className="relative">
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-xs font-medium rounded-xl cursor-pointer outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", minWidth: 150 }}>
                  <option value="all" style={{ background: "#0B0E17" }}>All Clients</option>
                  {allClients.filter((c) => c.status === "active").map((c) => (
                    <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} color="#8A93A6" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

              {/* Time period pills */}
              <div className="flex items-center gap-0.5 rounded-xl p-0.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {(["all", "1d", "7d", "mtd", "custom"] as const).map((p) => (
                  <button key={p} onClick={() => setTimePeriod(p)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      background: timePeriod === p ? "rgba(255,59,59,0.2)" : "transparent",
                      color: timePeriod === p ? "#FF3B3B" : "#8A93A6",
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
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
                  <span className="text-xs" style={{ color: "#8A93A6" }}>to</span>
                  <input type="date" value={customEnd} min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
                </div>
              )}
            </div>

            {/* ── Stats bar ───────────────────────────────────────────── */}
            <div className="rounded-2xl mb-2 overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex">
                {statItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-4 px-6 py-6 flex-1 min-w-0"
                      style={{ borderRight: i < statItems.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${item.color}18` }}>
                        <Icon size={18} color={item.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <Icon size={10} color={item.color} />
                          <span className="text-xs truncate" style={{ color: "#8A93A6" }}>{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xl font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                            {item.value}
                          </span>
                          {item.change.ok && (
                            <span className="flex items-center gap-0.5 text-xs font-semibold leading-none"
                              style={{ color: item.change.pos ? "#3DFFA2" : "#FF4757" }}>
                              {item.change.pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {item.change.str}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-xs" style={{ color: "#8A93A6" }}>{prevLabel(timePeriod, customStart, customEnd)}</p>
              </div>
            </div>

            {/* ── Views chart ─────────────────────────────────────────── */}
            <div className="rounded-2xl p-6 mb-6 mt-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Views Over Time{selectedClient ? ` · ${selectedClient.name}` : ""}
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => fmtDate(v)} />
                    <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmt(Number(v))} width={48} />
                    <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "#3DFFA2" }} />
                    <Area type="linear" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#agGrad)"
                      dot={{ fill: "#FF3B3B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm py-10 text-center" style={{ color: "#8A93A6" }}>No clips in this period</p>
              )}
            </div>

            {/* ── Top Clippers + Top Clips ────────────────────────────── */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} color="#3DFFA2" />
                  <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clippers</h2>
                </div>
                <div className="space-y-3">
                  {topClippers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>{c.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                        <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Heart size={9} color="#3DFFA2" />{fmt(c.likes)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><MessageCircle size={9} color="#a78bfa" />{fmt(c.comments)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Share2 size={9} color="#60a5fa" />{fmt(c.shares)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Bookmark size={9} color="#FFA500" />{fmt(c.saves)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(c.views)}</span>
                    </div>
                  ))}
                  {topClippers.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips in this period</p>}
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} color="#FF3B3B" />
                  <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clips</h2>
                </div>
                <div className="space-y-3">
                  {topClips.map((clip, i) => (
                    <div key={clip.id} className="flex items-center gap-2">
                      <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                      {clip.thumbnailUrl ? (
                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover" style={{ width: 36, height: 36 }} />
                        </a>
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <PlatformIcon platform={clip.subAccount?.platform ?? "other"} size={11} />
                          <span className="text-xs truncate font-medium" style={{ color: PLATFORM_COLORS[clip.subAccount?.platform] ?? "#8A93A6" }}>@{clip.subAccount?.handle}</span>
                          <span className="text-xs" style={{ color: "#8A93A6" }}>· {clip.clipper?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-0.5" style={{ color: "#3DFFA2", fontSize: 10 }}><Eye size={9} color="#FF3B3B" />{fmt(clip.views ?? 0)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Heart size={9} color="#3DFFA2" />{fmt(clip.likes ?? 0)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><MessageCircle size={9} color="#a78bfa" />{fmt(clip.comments ?? 0)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Share2 size={9} color="#60a5fa" />{fmt(clip.shares ?? 0)}</span>
                          <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Bookmark size={9} color="#FFA500" />{fmt(clip.saves ?? 0)}</span>
                        </div>
                      </div>
                      <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <ExternalLink size={11} color="#FF3B3B" />
                      </a>
                    </div>
                  ))}
                  {topClips.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips in this period</p>}
                </div>
              </div>
            </div>

            {/* ── Active Clients ───────────────────────────────────────── */}
            {(selectedClientId === "all" || activeClientsForDisplay.length > 0) && (
              <div className="rounded-2xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} color="#FF3B3B" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Active Clients</h2>
                  </div>
                  <button onClick={() => setActiveTab("clients")}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)" }}>
                    Manage
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {activeClientsForDisplay.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B" }}>{c.name[0]}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{c.users.length} clippers · {c._count.clips} clips</p>
                      </div>
                    </div>
                  ))}
                  {activeClientsForDisplay.length === 0 && (
                    <p className="text-sm col-span-3" style={{ color: "#8A93A6" }}>No active clients</p>
                  )}
                </div>
              </div>
            )}

          </>}

          {/* ── CLIENTS TAB ───────────────────────────────────────────── */}
          {activeTab === "clients" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ClientManagement initialClients={clients as any} />
          )}

          {/* ── CLIPPERS TAB ──────────────────────────────────────────── */}
          {activeTab === "clippers" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ClipperManagement initialClippers={clippers as any} allClients={allClients as any} />
          )}

          {/* ── CLIPS TAB ─────────────────────────────────────────────── */}
          {activeTab === "clips" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>All Clips</h1>
                  <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{allClips.length} clips total</p>
                </div>
                {allClips.length > 0 && (
                  <button onClick={handleRefreshAll} disabled={refreshingAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#8A93A6", opacity: refreshingAll ? 0.6 : 1 }}>
                    <RotateCw size={13} className={refreshingAll ? "animate-spin" : ""} />
                    {refreshingAll ? "Refreshing..." : "Refresh All"}
                  </button>
                )}
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Platform", "Preview", "Title", "Account", "Clipper", "Client", "Views", "Likes", "Comments", "Shares", "Date", "Link", "Refresh"].map((h) => (
                        <th key={h} className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider"
                          style={{ color: "#8A93A6" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allClips.map((clip, i) => (
                      <tr key={clip.id}
                        style={{ borderBottom: i < allClips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold capitalize"
                            style={{ color: PLATFORM_COLORS[clip.subAccount?.platform] ?? "#8A93A6" }}>
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
                            <span style={{ color: "#8A93A6", fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA", maxWidth: 120 }}>
                          <span className="truncate block">{clip.title ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#8A93A6" }}>
                          @{clip.subAccount?.handle ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA" }}>
                          {clip.clipper?.name ?? clip.clipper?.user?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA" }}>
                          {clip.client?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(clip.views ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.likes ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.comments ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.shares ?? 0)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#8A93A6" }}>
                          {clip.submittedAt
                            ? new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <a href={clip.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={12} color="#FF3B3B" />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleRefreshClip(clip.id)} disabled={refreshingClip === clip.id} title="Refresh stats from platform">
                            <RotateCw size={12} color="#8A93A6" className={refreshingClip === clip.id ? "animate-spin" : ""} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allClips.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-4 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
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
