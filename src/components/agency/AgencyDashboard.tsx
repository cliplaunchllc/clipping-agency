"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";
import ClientManagement from "@/components/agency/ClientManagement";
import ClipperManagement from "@/components/agency/ClipperManagement";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, Users, Scissors, BarChart2,
  TrendingUp, TrendingDown, ExternalLink, ChevronDown, RotateCw, UserCheck,
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
  clippers: AnyRecord[];
  allClients: AnyRecord[];
  clips: AnyRecord[];
  totalViews: number;
  pendingClientUsers?: AnyRecord[];
}

export default function AgencyDashboard({ userName, clients, clippers, allClients, clips: initialClips, pendingClientUsers = [] }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "targets" | "clients" | "clippers" | "clips" | "platform-stats">("overview");
  const [allClips, setAllClips] = useState<AnyRecord[]>(initialClips);
  const [refreshingClip, setRefreshingClip] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
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
  const [trackerClientId, setTrackerClientId] = useState("all");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
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

  // Platform stats
  const viewsByPlatform: Record<string, number> = {};
  const clipsByPlatform: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const p = (c.subAccount?.platform ?? c.platform ?? "other") as string;
    viewsByPlatform[p] = (viewsByPlatform[p] ?? 0) + (c.views ?? 0);
    clipsByPlatform[p] = (clipsByPlatform[p] ?? 0) + 1;
  });

  // Active clippers per period
  const clipperViewsInPeriod: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const name = (c.clipper?.name ?? "Unknown") as string;
    clipperViewsInPeriod[name] = (clipperViewsInPeriod[name] ?? 0) + (c.views ?? 0);
  });
  const activeClippersDisplay = (clippers
    .filter((c) => c.status === "active" && (selectedClientId === "all" || c.clientId === selectedClientId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c) => ({ ...c, periodViews: clipperViewsInPeriod[(c.name as string) ?? ""] ?? 0 })) as AnyRecord[])
    .sort((a, b) => (b.periodViews as number) - (a.periodViews as number))
    .slice(0, 8);

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

  // Clipper page breakout (MTD)
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const mtdClips = allClips.filter((c) => new Date(c.submittedAt as string) >= mtdStart);
  const BREAKOUT_PLATFORMS = ["tiktok", "instagram", "youtube"];
  const clipperBreakout = clippers
    .filter((c) => c.status === "active" && (selectedClientId === "all" || c.clientId === selectedClientId))
    .map((clipper) => {
      const myMtd = mtdClips.filter((c) => c.clipper?.name === clipper.name);
      const byPlatform: Record<string, number> = {};
      myMtd.forEach((c) => {
        const p = (c.subAccount?.platform ?? "other") as string;
        byPlatform[p] = (byPlatform[p] ?? 0) + 1;
      });
      const client = allClients.find((cl) => cl.id === clipper.clientId);
      // Per clipper: clipsPerDay × 3 platforms × dealLengthDays (or 30)
      const dealDays = (client as AnyRecord)?.dealLengthDays ?? 30;
      const monthlyTarget = (client as AnyRecord)?.clipsPerDay
        ? Math.round((client as AnyRecord).clipsPerDay * 3 * dealDays)
        : null;
      return { ...clipper, byPlatform, mtdTotal: myMtd.length, monthlyTarget, clientName: (clipper as AnyRecord).client?.name ?? null } as AnyRecord;
    })
    .sort((a, b) => (b.mtdTotal as number) - (a.mtdTotal as number));

  const statItems = [
    { label: "Views", value: fmt(currViews), icon: Eye, color: "#FF3B3B", change: pct(currViews, prevViews) },
    { label: "Likes", value: fmt(currLikes), icon: Heart, color: "#FF3B3B", change: pct(currLikes, prevLikes) },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, color: "#FF3B3B", change: pct(currComments, prevComments) },
    { label: "Shares", value: fmt(currShares), icon: Share2, color: "#FF3B3B", change: pct(currShares, prevShares) },
    { label: "Saves", value: fmt(currSaves), icon: Bookmark, color: "#FF3B3B", change: pct(currSaves, prevSaves) },
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
      {showLiveLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-xl p-8 w-full max-w-sm fade-in" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.25)" }}>
                  <Link2 size={14} color="#FF3B3B" />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Live Tracker Link</h2>
              </div>
              <button onClick={() => { setShowLiveLinkModal(false); setLiveLinkCopied(false); }}><X size={18} color="#8A93A6" /></button>
            </div>
            <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.15)" }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#FF3B3B" }}>What your client sees:</p>
              <ul className="space-y-1">
                {["Live views, likes, shares & engagement stats", "Top performing clips with thumbnails & links", "Individual clip breakdown by platform", "Platform-by-platform performance charts", "Real-time deal progress tracking"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs" style={{ color: "#C8CDD8" }}>
                    <span style={{ color: "#FF3B3B", fontSize: 10 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-5">
              <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Select Client</label>
              <select value={liveLinkClientId} onChange={(e) => setLiveLinkClientId(e.target.value)}
                className="w-full outline-none appearance-none px-3 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}>
                <option value="" style={{ background: "#0B0E17" }}>Choose a client…</option>
                {allClients.filter((c) => (c as AnyRecord).status === "active").map((c) => (
                  <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{(c as AnyRecord).name}</option>
                ))}
              </select>
            </div>
            <button onClick={handleGetLiveLink} disabled={!liveLinkClientId || liveLinkLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: liveLinkCopied ? "rgba(61,255,162,0.15)" : "rgba(255,59,59,0.15)", border: `1px solid ${liveLinkCopied ? "rgba(61,255,162,0.3)" : "rgba(255,59,59,0.3)"}`, color: liveLinkCopied ? "#3DFFA2" : "#FF3B3B", opacity: (!liveLinkClientId || liveLinkLoading) ? 0.5 : 1 }}>
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
      <main className="flex-1 overflow-y-auto ml-60">
        {/* Tab bar */}
        <div className="sticky top-0 z-30 px-8 pt-6 pb-0" style={{ background: "#05070D" }}>
          <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "targets", label: "Targets" },
              { id: "clients", label: `Clients (${clients.length})` },
              { id: "clippers", label: `Clippers${pendingClippers > 0 ? ` · ${pendingClippers} pending` : ""}` },
              { id: "clips", label: `Clips (${allClips.length})` },
              { id: "platform-stats", label: "Platform Stats" },
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
                <button onClick={() => setShowLiveLinkModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B" }}>
                  <Link2 size={11} /> Share Live Tracker
                </button>
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
            <div className="rounded-xl mb-2 overflow-hidden fade-up" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
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
                      <p className="text-xs" style={{ color: "#8A93A6" }}>{item.label}</p>
                      <span className="text-lg font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                        {item.value}
                      </span>
                      {item.change.ok && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold leading-none"
                          style={{ color: item.change.pos ? "#3DFFA2" : "#FF4757" }}>
                          {item.change.pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {item.change.str}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-xs" style={{ color: "#8A93A6" }}>{prevLabel(timePeriod, customStart, customEnd)}</p>
              </div>
            </div>

            {/* ── Views chart ─────────────────────────────────────────── */}
            <div className="rounded-xl p-6 mb-6 mt-5 fade-up delay-1" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                Views Over Time{selectedClient ? ` · ${selectedClient.name}` : ""}
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF3B3B" stopOpacity={0.82} />
                        <stop offset="55%" stopColor="#FF3B3B" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#FF3B3B" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => fmtDate(v)} />
                    <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmt(Number(v))} width={48} />
                    <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "#3DFFA2" }} />
                    {timePeriod !== "all" && (
                      <Area name="Prev Period" type="linear" dataKey="prevViews" stroke="rgba(255,255,255,0.18)"
                        strokeWidth={1.5} fill="none" strokeDasharray="5 3" dot={false} />
                    )}
                    <Area name="Views" type="linear" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#agGrad)"
                      dot={{ fill: "#FF3B3B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm py-10 text-center" style={{ color: "#8A93A6" }}>No clips in this period</p>
              )}
            </div>

            {/* ── Platform Stats ──────────────────────────────────────── */}
            <div className="mb-6 fade-up delay-2">
              <PlatformStatsCards viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
            </div>

            {/* ── Totals Tracker (overview) ──────────────────────────── */}
            {(() => {
              const TRACKER_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
              const trackerFilteredClients = trackerClientId === "all"
                ? allClients.filter((c) => (c as AnyRecord).status === "active")
                : allClients.filter((c) => c.id === trackerClientId && (c as AnyRecord).status === "active");
              let totalGoal = 0;
              const platformGoals: Record<string, number> = { tiktok: 0, instagram: 0, youtube: 0 };
              trackerFilteredClients.forEach((c) => {
                const cpd = (c as AnyRecord).clipsPerDay as number | null;
                if (!cpd) return;
                const deal = (c as AnyRecord).dealLengthDays as number | null ?? 30;
                const numClip = (c as AnyRecord).pageCount as number | null ?? 0; // pageCount = # clippers in deal
                if (numClip === 0) return;
                const perPlatformGoal = Math.round(numClip * cpd * deal);
                totalGoal += perPlatformGoal * 3;
                TRACKER_PLATFORMS.forEach((p) => { platformGoals[p] += perPlatformGoal; });
              });
              // Filter clips by each client's deal window (dealStartDate + dealLengthDays), fallback to MTD
              const platformActual: Record<string, number> = { tiktok: 0, instagram: 0, youtube: 0 };
              let totalActual = 0;
              const trackerClientMap = new Map(trackerFilteredClients.map((c) => [c.id, c]));
              allClips.forEach((clip) => {
                const clientData = trackerClientMap.get(clip.clientId as string);
                if (!clientData) return;
                const startRaw = (clientData as AnyRecord).dealStartDate as string | null;
                const dealLen = (clientData as AnyRecord).dealLengthDays as number | null ?? 30;
                const start = startRaw ? new Date(startRaw) : mtdStart;
                const end = startRaw ? new Date(new Date(startRaw).getTime() + dealLen * 86400000) : now;
                const submittedAt = new Date(clip.submittedAt as string);
                if (submittedAt < start || submittedAt > end) return;
                const p = (clip.subAccount?.platform ?? "other") as string;
                if (p in platformActual) platformActual[p] = (platformActual[p] ?? 0) + 1;
                totalActual += 1;
              });
              const totalPct = totalGoal > 0 ? Math.min(100, Math.round((totalActual / totalGoal) * 100)) : 0;
              const totalColor = totalPct >= 100 ? "#3DFFA2" : totalPct >= 60 ? "#FF9500" : "#FF3B3B";
              const trackerClipper = trackerFilteredClients.reduce((acc, c) => acc + ((c as AnyRecord).pageCount as number | null ?? 0), 0);
              const trackerCpd = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).clipsPerDay ?? null) : null;
              const trackerDeal = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).dealLengthDays ?? 30) : null;
              const singleStart = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).dealStartDate as string | null) : null;
              const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const computedEnd = singleStart && trackerDeal ? new Date(new Date(singleStart).getTime() + trackerDeal * 86400000) : null;
              const periodLabel = singleStart && computedEnd
                ? `${fmtDate(new Date(singleStart))} – ${fmtDate(computedEnd)}`
                : singleStart ? fmtDate(new Date(singleStart)) + " +" : now.toLocaleString("en-US", { month: "long" });
              return (
                <div className="rounded-xl p-6 mb-6 fade-up delay-3" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} color="#3DFFA2" />
                      <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                        Deal Tracker — {periodLabel}
                      </h2>
                    </div>
                    <div className="relative">
                      <select value={trackerClientId} onChange={(e) => setTrackerClientId(e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-xl cursor-pointer outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}>
                        <option value="all" style={{ background: "#0B0E17" }}>All Clients</option>
                        {allClients.filter((c) => (c as AnyRecord).status === "active").map((c) => (
                          <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{(c as AnyRecord).name}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} color="#8A93A6" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                  {trackerClipper > 0 && (
                    <p className="text-xs mb-4" style={{ color: "#8A93A6" }}>
                      {trackerClipper} clipper{trackerClipper !== 1 ? "s" : ""}
                      {trackerCpd ? ` · ${trackerCpd} clips/day/platform` : ""}
                      {" · 3 platforms"}
                      {trackerDeal ? ` · ${trackerDeal}-day deal` : ""}
                      {totalGoal > 0 ? ` → ${totalGoal} total clips` : ""}
                    </p>
                  )}
                  {totalGoal === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: "#8A93A6" }}>No deal terms set. Add clips/day to clients to see the tracker.</p>
                  ) : (
                    <>
                      <div className="mb-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <span className="text-2xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{totalActual}</span>
                            <span className="text-sm ml-1.5" style={{ color: "#8A93A6" }}>/ {totalGoal} clips deal total</span>
                          </div>
                          <span className="text-base font-bold" style={{ color: totalColor }}>{totalPct}%</span>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full bar-fill" style={{ width: `${totalPct}%`, background: `linear-gradient(90deg, ${totalColor}80 0%, ${totalColor} 100%)`, boxShadow: `0 0 12px ${totalColor}60` }} />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: "#8A93A6" }}>
                          {totalActual >= totalGoal ? "Deal goal reached!" : `${totalGoal - totalActual} clips remaining`}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {TRACKER_PLATFORMS.map((p) => {
                          const goal = platformGoals[p] ?? 0;
                          const actual = platformActual[p] ?? 0;
                          const platPct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
                          const color = PLATFORM_COLORS[p] ?? "#8A93A6";
                          const platLabel = p === "tiktok" ? "TikTok" : p === "instagram" ? "Instagram" : "YouTube";
                          return (
                            <div key={p} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div className="flex items-center gap-2 mb-3">
                                <PlatformIcon platform={p} size={13} />
                                <span className="text-xs font-semibold" style={{ color }}>{platLabel}</span>
                              </div>
                              <div className="flex items-end justify-between mb-2">
                                <span className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{actual}</span>
                                <span className="text-xs" style={{ color: "#8A93A6" }}>/ {goal}</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full bar-fill" style={{ width: `${platPct}%`, background: `linear-gradient(90deg, ${color}70 0%, ${color} 100%)`, boxShadow: `0 0 8px ${color}50` }} />
                              </div>
                              <p className="text-xs mt-1.5 font-semibold" style={{ color: platPct >= 100 ? "#3DFFA2" : platPct >= 60 ? "#FF9500" : color }}>{platPct}%</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Active Clippers */}
            {activeClippersDisplay.length > 0 && (
              <div className="rounded-xl p-6 mb-6 fade-up delay-3" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck size={14} color="#3DFFA2" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Active Clippers</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2", border: "1px solid rgba(61,255,162,0.2)" }}>
                      {activeClippersDisplay.length}
                    </span>
                  </div>
                  <button onClick={() => setActiveTab("clippers")} className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "#3DFFA2", background: "rgba(61,255,162,0.08)", border: "1px solid rgba(61,255,162,0.15)" }}>
                    Manage
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {activeClippersDisplay.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(255,59,59,0.12)", color: "#FF3B3B" }}>
                        {((c.name as string) || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "#F5F6FA" }}>{(c.name as string) ?? (c.email as string)}</p>
                        {c.client?.name && (
                          <p className="text-xs truncate" style={{ color: "#8A93A6" }}>{c.client.name as string}</p>
                        )}
                        <p className="text-xs" style={{ color: "#FF3B3B" }}>{fmt(c.periodViews)} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Top Clippers + Top Clips ────────────────────────────── */}
            <div className="grid grid-cols-2 gap-6 mb-6 fade-up delay-4">
              <div className="rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} color="#3DFFA2" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clippers</h2>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Views</span>
                </div>
                <div className="space-y-3">
                  {topClippers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>{c.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{c.clips} clips</p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(c.views)}</span>
                    </div>
                  ))}
                  {topClippers.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips in this period</p>}
                </div>
              </div>

              <div className="rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} color="#FF3B3B" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clips</h2>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Views</span>
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
                        <div className="flex items-center gap-1">
                          <PlatformIcon platform={clip.subAccount?.platform ?? "other"} size={11} />
                          <span className="text-xs truncate font-medium" style={{ color: PLATFORM_COLORS[clip.subAccount?.platform] ?? "#8A93A6" }}>@{clip.subAccount?.handle}</span>
                          <span className="text-xs truncate" style={{ color: "#8A93A6" }}>· {clip.clipper?.name}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(clip.views ?? 0)}</span>
                      <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <ExternalLink size={11} color="#FF3B3B" />
                      </a>
                    </div>
                  ))}
                  {topClips.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips in this period</p>}
                </div>
              </div>
            </div>

          </>}

          {/* ── TARGETS TAB ───────────────────────────────────────────── */}
          {activeTab === "targets" && (
            <div className="space-y-6">
              {/* ── Clipper Page Breakout ───────────────────────────────── */}
              {clipperBreakout.length > 0 && (
                <div className="rounded-xl mb-6 overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                      <BarChart2 size={14} color="#FF3B3B" />
                      <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Clipper Breakdown — {now.toLocaleString("en-US", { month: "long" })}</h2>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Clipper</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Client</th>
                        {BREAKOUT_PLATFORMS.map((p) => (
                          <th key={p} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: PLATFORM_COLORS[p] ?? "#8A93A6" }}>
                            {p === "tiktok" ? "TikTok" : p === "instagram" ? "Instagram" : "YouTube"}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Total MTD</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Target</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clipperBreakout.map((c, i) => {
                        const pct = c.monthlyTarget ? Math.min(100, Math.round((c.mtdTotal / c.monthlyTarget) * 100)) : null;
                        const color = pct !== null ? (pct >= 100 ? "#3DFFA2" : pct >= 60 ? "#FF9500" : "#FF3B3B") : "#8A93A6";
                        return (
                          <tr key={c.id as string} style={{ borderBottom: i < clipperBreakout.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ background: "rgba(255,59,59,0.12)", color: "#FF3B3B" }}>
                                  {((c.name as string) || "?")[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{c.name as string}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-xs" style={{ color: "#8A93A6" }}>{(c.clientName as string) ?? "—"}</td>
                            {BREAKOUT_PLATFORMS.map((p) => (
                              <td key={p} className="px-4 py-3 text-center text-sm font-medium" style={{ color: (c.byPlatform as Record<string,number>)[p] > 0 ? (PLATFORM_COLORS[p] ?? "#F5F6FA") : "#5C6370" }}>
                                {(c.byPlatform as Record<string,number>)[p] ?? 0}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-center text-sm font-semibold" style={{ color: "#F5F6FA" }}>{c.mtdTotal as number}</td>
                            <td className="px-4 py-3 text-center text-xs" style={{ color: "#8A93A6" }}>{c.monthlyTarget ?? "—"}</td>
                            <td className="px-4 py-3">
                              {pct !== null ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                                  </div>
                                  <span className="text-xs font-semibold w-8 text-right flex-shrink-0" style={{ color }}>{pct}%</span>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: "#5C6370" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Totals Tracker ─────────────────────────────────────── */}
              {(() => {
                const TRACKER_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
                const trackerFilteredClients = trackerClientId === "all"
                  ? allClients.filter((c) => (c as AnyRecord).status === "active")
                  : allClients.filter((c) => c.id === trackerClientId && (c as AnyRecord).status === "active");
                let totalGoal = 0;
                const platformGoals: Record<string, number> = { tiktok: 0, instagram: 0, youtube: 0 };
                trackerFilteredClients.forEach((c) => {
                  const cpd = (c as AnyRecord).clipsPerDay as number | null;
                  if (!cpd) return;
                  const deal = (c as AnyRecord).dealLengthDays as number | null ?? 30;
                  const numClip = (c as AnyRecord).pageCount as number | null ?? 0; // pageCount = # clippers in deal
                  if (numClip === 0) return;
                  const perPlatformGoal = Math.round(numClip * cpd * deal);
                  totalGoal += perPlatformGoal * 3;
                  TRACKER_PLATFORMS.forEach((p) => { platformGoals[p] += perPlatformGoal; });
                });
                const platformActual: Record<string, number> = { tiktok: 0, instagram: 0, youtube: 0 };
                let totalActual = 0;
                const trackerClientMap = new Map(trackerFilteredClients.map((c) => [c.id, c]));
                allClips.forEach((clip) => {
                  const clientData = trackerClientMap.get(clip.clientId as string);
                  if (!clientData) return;
                  const startRaw = (clientData as AnyRecord).dealStartDate as string | null;
                  const dealLen = (clientData as AnyRecord).dealLengthDays as number | null ?? 30;
                  const start = startRaw ? new Date(startRaw) : mtdStart;
                  const end = startRaw ? new Date(new Date(startRaw).getTime() + dealLen * 86400000) : now;
                  const submittedAt = new Date(clip.submittedAt as string);
                  if (submittedAt < start || submittedAt > end) return;
                  const p = (clip.subAccount?.platform ?? "other") as string;
                  if (p in platformActual) platformActual[p] = (platformActual[p] ?? 0) + 1;
                  totalActual += 1;
                });
                const totalPct = totalGoal > 0 ? Math.min(100, Math.round((totalActual / totalGoal) * 100)) : 0;
                const totalColor = totalPct >= 100 ? "#3DFFA2" : totalPct >= 60 ? "#FF9500" : "#FF3B3B";
                const trackerClipper = trackerFilteredClients.reduce((acc, c) => acc + ((c as AnyRecord).pageCount as number | null ?? 0), 0);
                const trackerCpd = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).clipsPerDay ?? null) : null;
                const trackerDeal = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).dealLengthDays ?? 30) : null;
                const singleStart = trackerFilteredClients.length === 1 ? ((trackerFilteredClients[0] as AnyRecord).dealStartDate as string | null) : null;
                const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const computedEnd = singleStart && trackerDeal ? new Date(new Date(singleStart).getTime() + trackerDeal * 86400000) : null;
                const periodLabel = singleStart && computedEnd
                  ? `${fmtDate(new Date(singleStart))} – ${fmtDate(computedEnd)}`
                  : singleStart ? fmtDate(new Date(singleStart)) + " +" : now.toLocaleString("en-US", { month: "long" });
                return (
                  <div className="rounded-xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} color="#3DFFA2" />
                        <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                          Deal Tracker — {periodLabel}
                        </h2>
                      </div>
                      <div className="relative">
                        <select value={trackerClientId} onChange={(e) => setTrackerClientId(e.target.value)}
                          className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-xl cursor-pointer outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}>
                          <option value="all" style={{ background: "#0B0E17" }}>All Clients</option>
                          {allClients.filter((c) => (c as AnyRecord).status === "active").map((c) => (
                            <option key={c.id} value={c.id} style={{ background: "#0B0E17" }}>{(c as AnyRecord).name}</option>
                          ))}
                        </select>
                        <ChevronDown size={11} color="#8A93A6" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    {trackerClipper > 0 && (
                      <p className="text-xs mb-4" style={{ color: "#8A93A6" }}>
                        {trackerClipper} clipper{trackerClipper !== 1 ? "s" : ""}
                        {trackerCpd ? ` · ${trackerCpd} clips/day/platform` : ""}
                        {" · 3 platforms"}
                        {trackerDeal ? ` · ${trackerDeal}-day deal` : ""}
                        {totalGoal > 0 ? ` → ${totalGoal} total clips` : ""}
                      </p>
                    )}
                    {totalGoal === 0 ? (
                      <p className="text-sm py-4 text-center" style={{ color: "#8A93A6" }}>
                        No deal terms set. Add clips/day to clients to see the tracker.
                      </p>
                    ) : (
                      <>
                        <div className="mb-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-end justify-between mb-2">
                            <div>
                              <span className="text-2xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{totalActual}</span>
                              <span className="text-sm ml-1.5" style={{ color: "#8A93A6" }}>/ {totalGoal} clips deal total</span>
                            </div>
                            <span className="text-base font-bold" style={{ color: totalColor }}>{totalPct}%</span>
                          </div>
                          <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${totalPct}%`, background: `linear-gradient(90deg, ${totalColor}80 0%, ${totalColor} 100%)`, boxShadow: `0 0 12px ${totalColor}60`, transition: "width 0.5s ease" }} />
                          </div>
                          <p className="text-xs mt-1.5" style={{ color: "#8A93A6" }}>
                            {totalActual >= totalGoal ? "Deal goal reached!" : `${totalGoal - totalActual} clips remaining`}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {TRACKER_PLATFORMS.map((p) => {
                            const goal = platformGoals[p] ?? 0;
                            const actual = platformActual[p] ?? 0;
                            const platPct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
                            const color = PLATFORM_COLORS[p] ?? "#8A93A6";
                            const platLabel = p === "tiktok" ? "TikTok" : p === "instagram" ? "Instagram" : "YouTube";
                            return (
                              <div key={p} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div className="flex items-center gap-2 mb-3">
                                  <PlatformIcon platform={p} size={13} />
                                  <span className="text-xs font-semibold" style={{ color }}>{platLabel}</span>
                                </div>
                                <div className="flex items-end justify-between mb-2">
                                  <span className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{actual}</span>
                                  <span className="text-xs" style={{ color: "#8A93A6" }}>/ {goal}</span>
                                </div>
                                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${platPct}%`, background: `linear-gradient(90deg, ${color}70 0%, ${color} 100%)`, boxShadow: `0 0 8px ${color}50`, transition: "width 0.5s ease" }} />
                                </div>
                                <p className="text-xs mt-1.5 font-semibold" style={{ color: platPct >= 100 ? "#3DFFA2" : platPct >= 60 ? "#FF9500" : color }}>{platPct}%</p>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── CLIENTS TAB ───────────────────────────────────────────── */}
          {activeTab === "clients" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ClientManagement initialClients={clients as any} pendingClientUsers={pendingClientUsers as any} allClients={allClients as any} />
          )}

          {/* ── CLIPPERS TAB ──────────────────────────────────────────── */}
          {activeTab === "clippers" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <ClipperManagement initialClippers={clippers as any} allClients={allClients as any} />
          )}

          {/* ── PLATFORM STATS TAB ────────────────────────────────────── */}
          {activeTab === "platform-stats" && (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Platform Stats</h1>
                <p className="text-sm" style={{ color: "#8A93A6" }}>View and post breakdown across platforms</p>
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
              <div className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
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
