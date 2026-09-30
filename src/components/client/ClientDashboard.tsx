"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import TopClipsChart from "@/components/shared/TopClipsChart";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, BarChart2, ExternalLink, Check,
  TrendingUp, TrendingDown, RotateCw, Activity, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, Minus,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import PlatformStatsCards, { PlatformBreakdownTable } from "@/components/shared/PlatformStatsCards";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

type TimePeriod = "all" | "1d" | "7d" | "mtd" | "custom";

function getRange(period: TimePeriod, cs: string, ce: string): [Date, Date] {
  const now = new Date();
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  if (period === "all") return [new Date(0), new Date("2099-12-31T23:59:59")];
  if (period === "1d") { const s = new Date(); s.setHours(0, 0, 0, 0); return [s, eod]; }
  if (period === "7d") { const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0); return [s, eod]; }
  if (period === "mtd") return [new Date(now.getFullYear(), now.getMonth(), 1), eod];
  return [
    cs ? new Date(cs + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1),
    ce ? new Date(ce + "T23:59:59") : eod,
  ];
}

function getPrevRange(s: Date, e: Date): [Date, Date] {
  const dur = e.getTime() - s.getTime();
  return [new Date(s.getTime() - dur - 1), new Date(s.getTime() - 1)];
}

function inRange<T extends { submittedAt: string }>(clips: T[], s: Date, e: Date): T[] {
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

interface Clip {
  id: string; url: string; platform: string; handle: string;
  views: number; likes: number; comments: number; shares: number;
  saves: number; earnings: number; submittedAt: string; clipperName: string | null;
  title?: string | null; thumbnailUrl?: string | null;
}
interface SubAccount { id: string; platform: string; handle: string; profileUrl: string | null; }
interface Clipper { id: string; name: string | null; clipCount: number; totalViews: number; subAccounts: SubAccount[]; }
interface Link { id: string; label: string; url: string; }
interface OnboardingStep { id: string; title: string; description: string | null; linkUrl: string | null; order: number; completed: boolean; }
interface OngoingReport {
  id: string; date: string; totalSubmissions: number; pending: number;
  approved: number; rejected: number; mainTrend: string | null;
  clipperFeedback: string | null; mainOptimization: string | null; status: string;
}

interface ClientData {
  id: string; name: string; status: string;
  campaignType: "manual" | "cpm";
  contractUrl: string | null;
  logoUrl: string | null;
  dealLengthDays: number | null; dealStartDate: string | null; dealEndDate: string | null;
  pageCount: number | null; clipsPerDay: number | null;
  createdAt: string;
  clips: Clip[]; clippers: Clipper[];
  links: Link[]; onboardingSteps: OnboardingStep[];
  ongoingReports: OngoingReport[];
}

interface Props { client: ClientData; userName: string; previewMode?: boolean; }

export default function ClientDashboard({ client, userName, previewMode }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "deal" | "links" | "onboarding" | "clips" | "platform-stats" | "reports" | "contract">("overview");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    if (!client.ongoingReports?.length) return new Set();
    const latest = client.ongoingReports[0].date.slice(0, 7);
    return new Set([latest]);
  });
  const [clips, setClips] = useState<Clip[]>(client.clips);
  const [refreshingClip, setRefreshingClip] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));
  const [steps, setSteps] = useState<OnboardingStep[]>(client.onboardingSteps);
  const [togglingStep, setTogglingStep] = useState<string | null>(null);

  async function handleRefreshAll() {
    if (refreshingAll || clips.length === 0) return;
    setRefreshingAll(true);
    for (const clip of clips.slice(0, 50)) {
      const res = await fetch(`/api/clips/${clip.id}`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        setClips((prev) => prev.map((c) => c.id === clip.id ? { ...c, views: updated.views, likes: updated.likes, comments: updated.comments, shares: updated.shares, saves: updated.saves } : c));
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
      setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, views: updated.views, likes: updated.likes, comments: updated.comments, shares: updated.shares, saves: updated.saves, thumbnailUrl: updated.thumbnailUrl } : c));
    }
    setRefreshingClip(null);
  }


  // Time filtered clips
  const [rangeStart, rangeEnd] = getRange(timePeriod, customStart, customEnd);
  const filteredClips = inRange(clips, rangeStart, rangeEnd);
  const prevClips = timePeriod === "all"
    ? []
    : (() => { const [ps, pe] = getPrevRange(rangeStart, rangeEnd); return inRange(clips, ps, pe); })();

  // Stats
  const currViews = filteredClips.reduce((a, c) => a + c.views, 0);
  const currLikes = filteredClips.reduce((a, c) => a + c.likes, 0);
  const currComments = filteredClips.reduce((a, c) => a + c.comments, 0);
  const currShares = filteredClips.reduce((a, c) => a + c.shares, 0);
  const currSaves = filteredClips.reduce((a, c) => a + c.saves, 0);

  const prevViews = prevClips.reduce((a, c) => a + c.views, 0);
  const prevLikes = prevClips.reduce((a, c) => a + c.likes, 0);
  const prevComments = prevClips.reduce((a, c) => a + c.comments, 0);
  const prevShares = prevClips.reduce((a, c) => a + c.shares, 0);
  const prevSaves = prevClips.reduce((a, c) => a + c.saves, 0);
  const prevClipCount = prevClips.length;

  // Platform stats
  const viewsByPlatform: Record<string, number> = {};
  const clipsByPlatform: Record<string, number> = {};
  filteredClips.forEach((c) => {
    const p = (c as Clip).platform ?? "other";
    viewsByPlatform[p] = (viewsByPlatform[p] ?? 0) + (c as Clip).views;
    clipsByPlatform[p] = (clipsByPlatform[p] ?? 0) + 1;
  });

  // Chart from filtered clips
  const byDate: Record<string, number> = {};
  (filteredClips as Clip[]).forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + c.views;
  });
  const prevByDate: Record<string, number> = {};
  (prevClips as Clip[]).forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    prevByDate[date] = (prevByDate[date] ?? 0) + c.views;
  });
  const currChartDates = Object.keys(byDate).sort();
  const prevChartDates = Object.keys(prevByDate).sort();
  const chartData = currChartDates.map((date, i) => ({
    date,
    views: byDate[date] ?? 0,
    prevViews: prevChartDates[i] !== undefined ? (prevByDate[prevChartDates[i]] ?? 0) : undefined,
  }));

  // Top clips from all clips (not time-filtered for leaderboard context)
  const topClips = [...clips].sort((a, b) => b.views - a.views).slice(0, 5);

  // Onboarding
  const completedSteps = steps.filter((s) => s.completed).length;
  const onboardingPct = steps.length > 0
    ? Math.round((completedSteps / steps.length) * 100) : 0;

  async function toggleStep(stepId: string, completed: boolean) {
    if (previewMode) return;
    setTogglingStep(stepId);
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, completed }),
    });
    if (res.ok) {
      setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, completed } : s));
    }
    setTogglingStep(null);
  }

  const statItems = [
    { label: "Views", value: fmt(currViews), icon: Eye, color: "#FF3B3B", change: pct(currViews, prevViews) },
    { label: "Likes", value: fmt(currLikes), icon: Heart, color: "#FF3B3B", change: pct(currLikes, prevLikes) },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, color: "#FF3B3B", change: pct(currComments, prevComments) },
    { label: "Shares", value: fmt(currShares), icon: Share2, color: "#FF3B3B", change: pct(currShares, prevShares) },
    { label: "Saves", value: fmt(currSaves), icon: Bookmark, color: "#FF3B3B", change: pct(currSaves, prevSaves) },
    { label: "Clips", value: filteredClips.length.toString(), icon: BarChart2, color: "#FF3B3B", change: pct(filteredClips.length, prevClipCount) },
  ];

  type TabId = "overview" | "reports" | "onboarding" | "contract" | "deal" | "links" | "clips" | "platform-stats";
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(client.campaignType === "cpm" ? [
      { id: "reports" as TabId, label: "Campaign Reports" },
      { id: "onboarding" as TabId, label: `Onboarding${steps.length > 0 ? ` ${onboardingPct}%` : ""}` },
      { id: "contract" as TabId, label: "Contract" },
    ] : []),
    { id: "deal", label: "Deal Terms" },
    { id: "links", label: `Links (${client.links.length})` },
    ...(client.campaignType !== "cpm" ? [{ id: "onboarding" as TabId, label: `Onboarding${steps.length > 0 ? ` ${onboardingPct}%` : ""}` }] : []),
    { id: "clips", label: "Clips" },
    { id: "platform-stats", label: "Platform Stats" },
  ];

  const tooltipStyle = {
    contentStyle: { background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 },
    labelStyle: { color: "#8A93A6" },
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      {previewMode ? (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2"
          style={{ background: "rgba(11,14,23,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(8px)" }}>
          <a href="/agency" className="flex items-center gap-1.5 text-xs" style={{ color: "#8A93A6" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back to Agency
          </a>
          <span className="text-xs" style={{ color: "#8A93A6" }}>Viewing as <span style={{ color: "#F5F6FA" }}>{client.name}</span></span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B", border: "1px solid rgba(255,59,59,0.2)" }}>Preview</span>
        </div>
      ) : (
        <Sidebar role="client" userName={userName} />
      )}

      <main className={`flex-1 overflow-y-auto ${previewMode ? "" : "ml-60"}`}>
        <div className={`max-w-6xl mx-auto px-8 py-8 ${previewMode ? "pt-14" : ""}`}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {client.logoUrl && (
              <img src={client.logoUrl} alt={client.name}
                className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
            )}
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{client.name}</h1>
              <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clips.length} clips · {client.clippers.flatMap((cl) => cl.subAccounts).length} accounts</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm font-medium relative tab-btn"
                style={{ color: activeTab === tab.id ? "#F5F6FA" : "#8A93A6" }}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <>
              {/* Controls row */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
              {/* Time period controls */}
              <div className="flex items-center gap-3 flex-wrap">
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
                {timePeriod === "custom" && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-xl outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
                    <span className="text-xs" style={{ color: "#8A93A6" }}>to</span>
                    <input type="date" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-xl outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
                  </div>
                )}
              </div>
                </div>
                <div className="flex items-center gap-2">
                  {lastSynced && (
                    <span className="text-xs" style={{ color: "#8A93A6" }}>
                      Updated {Math.round((Date.now() - lastSynced.getTime()) / 60000)}m ago
                    </span>
                  )}
                  {!previewMode && (
                    <button onClick={handleRefreshAll} disabled={refreshingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B", opacity: refreshingAll ? 0.5 : 1 }}>
                      <RotateCw size={11} className={refreshingAll ? "animate-spin" : ""} />
                      {refreshingAll ? "Syncing…" : "Sync Stats"}
                    </button>
                  )}
                </div>
              </div>

              {/* Stats bar */}
              <div className="rounded-xl mb-6 overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
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

              {/* Live tracker callout */}
              <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.15)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)" }}>
                  <BarChart2 size={13} color="#FF3B3B" />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#FF3B3B" }}>Live Campaign Tracker</p>
                  <p className="text-xs" style={{ color: "#8A93A6" }}>This is your live dashboard — see all top clips, individual clip stats, platform breakdown, and real-time campaign performance.</p>
                </div>
              </div>

              {/* Views chart */}
              <div className="rounded-xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <defs>
                        <linearGradient id="clientViewGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF3B3B" stopOpacity={0.82} />
                          <stop offset="55%" stopColor="#FF3B3B" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#FF3B3B" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: string) => fmtDate(v)} />
                      <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => fmt(v)} width={48} />
                      <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "#3DFFA2" }} />
                      {timePeriod !== "all" && (
                        <Area name="Prev Period" type="linear" dataKey="prevViews" stroke="rgba(255,255,255,0.18)"
                          strokeWidth={1.5} fill="none" strokeDasharray="5 3" dot={false} />
                      )}
                      <Area name="Views" type="linear" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#clientViewGrad)"
                        dot={{ fill: "#FF3B3B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm py-10 text-center" style={{ color: "#8A93A6" }}>No clips in this period</p>
                )}
              </div>

              {/* Platform Stats */}
              <div className="mb-6">
                <PlatformStatsCards viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
              </div>

              {/* ── Deal Targets ─────────────────────────────────────── */}
              {(() => {
                const now = new Date();
                const cpd = client.clipsPerDay;
                const deal = client.dealLengthDays ?? 30;
                const numClippers = client.pageCount ?? 0; // pageCount = # clippers entered in deal terms
                if (!cpd || numClippers === 0) return null;
                const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
                const platColors: Record<string, string> = { tiktok: "#FF3B3B", instagram: "#FF8800", youtube: "#CC1A1A" };
                const platLabels: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
                // Use dealStartDate + dealLengthDays as the window; fallback to MTD
                const start = client.dealStartDate ? new Date(client.dealStartDate) : new Date(now.getFullYear(), now.getMonth(), 1);
                const end = client.dealStartDate ? new Date(new Date(client.dealStartDate).getTime() + deal * 86400000) : now;
                const fmtD = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const periodLabel = client.dealStartDate
                  ? `${fmtD(start)} – ${fmtD(end)}`
                  : now.toLocaleString("en-US", { month: "long" });
                // Per-platform: numClippers × clipsPerDay × dealLengthDays
                const platTarget = Math.round(numClippers * cpd * deal);
                const totalTarget = platTarget * 3;
                const dealClips = clips.filter((c) => { const d = new Date(c.submittedAt); return d >= start && d <= end; });
                const platActual: Record<string, number> = { tiktok: 0, instagram: 0, youtube: 0 };
                dealClips.forEach((c) => { if (c.platform in platActual) platActual[c.platform]++; });
                const totalActual = dealClips.length;
                const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0;
                const totalColor = totalPct >= 100 ? "#3DFFA2" : totalPct >= 60 ? "#FF9500" : "#FF3B3B";
                return (
                  <div className="rounded-xl p-6 mb-6 fade-up" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                        Deal Target — {periodLabel}
                      </h2>
                      <span className="text-xs" style={{ color: "#8A93A6" }}>{numClippers} clipper{numClippers !== 1 ? "s" : ""} · {cpd} clips/day · {deal} days</span>
                    </div>
                    <p className="text-xs mb-5" style={{ color: "#8A93A6" }}>{cpd} clips/day × 3 platforms × {deal} days × {numClippers} clipper{numClippers !== 1 ? "s" : ""}</p>

                    {/* Total bar */}
                    <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <span className="text-2xl font-bold stat-number" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{totalActual}</span>
                          <span className="text-sm ml-1.5" style={{ color: "#8A93A6" }}>/ {totalTarget} clips deal total</span>
                        </div>
                        <span className="text-base font-bold" style={{ color: totalColor }}>{totalPct}%</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full bar-fill" style={{
                          width: `${totalPct}%`,
                          background: `linear-gradient(90deg, ${totalColor}80 0%, ${totalColor} 100%)`,
                          boxShadow: `0 0 12px ${totalColor}60`,
                        }} />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "#8A93A6" }}>
                        {totalActual >= totalTarget ? "Deal target reached!" : `${totalTarget - totalActual} clips remaining`}
                      </p>
                    </div>

                    {/* Per-platform */}
                    <div className="grid grid-cols-3 gap-3">
                      {PLATFORMS.map((p, i) => {
                        const actual = platActual[p] ?? 0;
                        const platPct = platTarget > 0 ? Math.min(100, Math.round((actual / platTarget) * 100)) : 0;
                        const color = platColors[p];
                        return (
                          <div key={p} className={`rounded-xl p-4 fade-up delay-${i + 1}`} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center gap-2 mb-2">
                              <PlatformIcon platform={p} size={13} />
                              <span className="text-xs font-semibold" style={{ color }}>{platLabels[p]}</span>
                            </div>
                            <div className="flex items-end justify-between mb-1">
                              <span className="text-2xl font-bold stat-number" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{actual}</span>
                              <span className="text-xs" style={{ color: "#8A93A6" }}>/ {platTarget}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full bar-fill" style={{
                                width: `${platPct}%`,
                                background: `linear-gradient(90deg, ${color}70 0%, ${color} 100%)`,
                                boxShadow: `0 0 6px ${color}50`,
                              }} />
                            </div>
                            <p className="text-xs mt-1.5 font-semibold" style={{ color: platPct >= 100 ? "#3DFFA2" : platPct >= 60 ? "#FF9500" : color }}>{platPct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Clippers + Top Clips */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Accounts</h2>
                  {(() => {
                    const allAccounts = client.clippers.flatMap((cl) => cl.subAccounts);
                    const byPlatform: Record<string, SubAccount[]> = {};
                    allAccounts.forEach((s) => {
                      if (!byPlatform[s.platform]) byPlatform[s.platform] = [];
                      byPlatform[s.platform].push(s);
                    });
                    const platforms = Object.keys(byPlatform);
                    if (platforms.length === 0) return <p className="text-sm" style={{ color: "#8A93A6" }}>No accounts yet</p>;
                    return (
                      <div className="space-y-4">
                        {platforms.map((platform) => (
                          <div key={platform}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <PlatformIcon platform={platform} size={13} />
                              <span className="text-xs font-semibold" style={{ color: PLATFORM_COLORS[platform] ?? "#8A93A6" }}>
                                {platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1)}
                              </span>
                            </div>
                            <div className="space-y-1.5 pl-5">
                              {byPlatform[platform].map((s) => (
                                s.profileUrl ? (
                                  <a key={s.id} href={s.profileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs transition-colors"
                                    style={{ color: "#F5F6FA" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = PLATFORM_COLORS[platform] ?? "#8A93A6")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#F5F6FA")}>
                                    @{s.handle}
                                    <ExternalLink size={10} color="#8A93A6" />
                                  </a>
                                ) : (
                                  <p key={s.id} className="text-xs" style={{ color: "#F5F6FA" }}>@{s.handle}</p>
                                )
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={13} color="#FF3B3B" />
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
                            <PlatformIcon platform={clip.platform} size={11} />
                            <span className="text-xs truncate font-medium" style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>@{clip.handle}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(clip.views)}</span>
                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0"><ExternalLink size={11} color="#FF3B3B" /></a>
                      </div>
                    ))}
                    {topClips.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips yet</p>}
                  </div>
                </div>
              </div>

              {/* Top Clips chart */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {filteredClips.length > 0 && (
                <TopClipsChart clips={filteredClips as any} />
              )}

            </>
          )}

          {/* ── DEAL TERMS ─── */}
          {activeTab === "deal" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Deal Length", value: client.dealLengthDays ? `${client.dealLengthDays} days` : "—" },
                { label: "Pages", value: client.pageCount?.toString() ?? "—" },
                { label: "Clips / Day", value: client.clipsPerDay?.toString() ?? "—" },
                { label: "Total Clips Submitted", value: client.clips.length.toString() },
                { label: "Active Clippers", value: client.clippers.length.toString() },
                { label: "Started", value: new Date(client.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                  <p className="text-2xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── LINKS ─── */}
          {activeTab === "links" && (
            <div className="space-y-3">
              <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.15)" }}>
                <ExternalLink size={13} color="#FF3B3B" className="flex-shrink-0" />
                <p className="text-xs" style={{ color: "#8A93A6" }}>
                  <span style={{ color: "#FF3B3B", fontWeight: 600 }}>Live Tracker</span> — your agency may share a live tracker link here where you can watch top clips, individual clip stats, and real-time performance update as they happen.
                </p>
              </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
              {client.links.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No links added yet</p>
              ) : (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {client.links.map((link) => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{link.label}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: "#8A93A6" }}>{link.url}</p>
                      </div>
                      <ExternalLink size={14} color="#FF3B3B" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── ONBOARDING ─── */}
          {activeTab === "onboarding" && (
            <div className="space-y-4">
              {steps.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: "#8A93A6" }}>Progress — {completedSteps} of {steps.length} complete</span>
                    <span className="text-xs font-medium" style={{ color: "#3DFFA2" }}>{onboardingPct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${onboardingPct}%`, background: "linear-gradient(90deg, #3DFFA2, #FF3B3B)" }} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={step.id} className="flex items-start gap-4 p-4 rounded-2xl transition-all"
                    style={{ background: "#0B0E17", border: `1px solid ${step.completed ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.08)"}` }}>
                    <button
                      onClick={() => toggleStep(step.id, !step.completed)}
                      disabled={togglingStep === step.id || previewMode}
                      className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      title={step.completed ? "Mark incomplete" : "Mark complete"}
                      style={{
                        background: step.completed ? "rgba(61,255,162,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${step.completed ? "#3DFFA2" : "rgba(255,255,255,0.3)"}`,
                        cursor: previewMode ? "default" : "pointer",
                        opacity: togglingStep === step.id ? 0.5 : 1,
                        borderRadius: 4,
                      }}>
                      {step.completed && <Check size={12} color="#3DFFA2" strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: step.completed ? "#8A93A6" : "#F5F6FA", textDecoration: step.completed ? "line-through" : "none" }}>
                        {step.title}
                      </p>
                      {step.description && <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>{step.description}</p>}
                      {step.linkUrl && (
                        <a href={step.linkUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs mt-1.5 px-3 py-1 rounded-lg font-medium transition-colors"
                          style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B" }}>
                          <ExternalLink size={10} /> Open Link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {steps.length === 0 && (
                  <p className="text-center text-sm py-12" style={{ color: "#8A93A6" }}>No onboarding steps set up yet</p>
                )}
              </div>
            </div>
          )}

          {/* ── CLIPS ─── */}
          {activeTab === "clips" && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Platform", "Preview", "Title", "Account", "Views", "Likes", "Comments", "Shares", "Date", "Link", "Refresh"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clips.map((clip, i) => (
                    <tr key={clip.id} style={{ borderBottom: i < clips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={clip.platform} size={13} />
                          <span className="text-xs font-medium" style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                            {clip.platform === "twitter" ? "X" : clip.platform.charAt(0).toUpperCase() + clip.platform.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {clip.thumbnailUrl ? (
                          <a href={clip.url} target="_blank" rel="noopener noreferrer">
                            <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover"
                              style={{ width: 64, height: 36 }} />
                          </a>
                        ) : (
                          <span style={{ color: "#8A93A6", fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA", maxWidth: 120 }}>
                        <span className="truncate block">{clip.title ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>@{clip.handle}</td>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(clip.views)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.likes)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>{fmt(clip.comments)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.shares)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>{new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="px-5 py-3"><a href={clip.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} color="#FF3B3B" /></a></td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleRefreshClip(clip.id)} disabled={refreshingClip === clip.id} title="Refresh stats from platform" className="icon-btn p-1 rounded">
                          <RotateCw size={12} color="#8A93A6" className={refreshingClip === clip.id ? "animate-spin" : ""} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clips.length === 0 && (
                    <tr><td colSpan={11} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No clips yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CONTRACT (CPM only) ─── */}
          {activeTab === "contract" && client.campaignType === "cpm" && (
            <div className="max-w-2xl">
              {client.contractUrl ? (
                <div className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(123,159,249,0.15)", boxShadow: "0 0 0 1px rgba(255,59,59,0.03), 0 8px 32px rgba(0,0,0,0.5)" }}>
                  {/* Header */}
                  <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(123,159,249,0.1)", border: "1px solid rgba(123,159,249,0.2)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7B9FF9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Signed Agreement</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>Your executed campaign contract</p>
                      </div>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="px-6 py-6 flex flex-col items-start gap-4">
                    <div className="w-full rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A93A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <p className="text-xs truncate flex-1" style={{ color: "#8A93A6" }}>{client.contractUrl}</p>
                    </div>
                    <a
                      href={client.contractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                      style={{ background: "rgba(123,159,249,0.12)", border: "1px solid rgba(123,159,249,0.25)", color: "#7B9FF9", boxShadow: "0 0 18px rgba(123,159,249,0.12)" }}
                    >
                      <ExternalLink size={14} />
                      Open Signed Agreement
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl py-24" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7B9FF9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p className="text-base font-semibold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>No contract on file yet</p>
                  <p className="text-sm" style={{ color: "#8A93A6" }}>Your signed agreement will appear here once shared.</p>
                </div>
              )}
            </div>
          )}

          {/* ── PLATFORM STATS ─── */}
          {activeTab === "platform-stats" && (
            <div>
              <div className="mb-6">
                <PlatformStatsCards viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
              </div>
              <PlatformBreakdownTable viewsByPlatform={viewsByPlatform} clipsByPlatform={clipsByPlatform} />
            </div>
          )}

          {/* ── CAMPAIGN REPORTS (CPM) ───────────────────────────────── */}
          {activeTab === "reports" && client.campaignType === "cpm" && (() => {
            const ONGOING_COLOR = "#7B9FF9";
            const reports = (client.ongoingReports ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));

            const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
              Strong: { label: "Strong", bg: "rgba(61,255,162,0.1)", text: "#3DFFA2", icon: <CheckCircle2 size={11} /> },
              Normal: { label: "Normal", bg: "rgba(123,159,249,0.1)", text: "#7B9FF9", icon: <Minus size={11} /> },
              NeedsAttention: { label: "Needs Attention", bg: "rgba(255,136,0,0.12)", text: "#FF8800", icon: <AlertTriangle size={11} /> },
            };

            // Group by month
            const monthMap = new Map<string, OngoingReport[]>();
            for (const r of reports) {
              const key = r.date.slice(0, 7);
              if (!monthMap.has(key)) monthMap.set(key, []);
              monthMap.get(key)!.push(r);
            }
            const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

            function toggleMonth(k: string) {
              setExpandedMonths((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
            }

            function fmtMonthLabel(key: string) {
              const [y, m] = key.split("-").map(Number);
              return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
            }

            function dayName(dateStr: string) {
              return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
            }

            function fmtDay(dateStr: string) {
              return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }

            if (reports.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center rounded-2xl py-24" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Activity size={36} style={{ color: ONGOING_COLOR, opacity: 0.3 }} className="mb-4" />
                  <p className="text-base font-semibold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>No reports yet</p>
                  <p className="text-sm" style={{ color: "#8A93A6" }}>Your campaign reports will appear here.</p>
                </div>
              );
            }

            // Summary stats across all reports
            const totalApproved = reports.reduce((s, r) => s + r.approved, 0);
            const totalSubmissions = reports.reduce((s, r) => s + r.totalSubmissions, 0);
            const overallRate = totalSubmissions > 0 ? Math.round((totalApproved / totalSubmissions) * 100) : 0;
            const strongCount = reports.filter((r) => r.status === "Strong").length;
            const attentionCount = reports.filter((r) => r.status === "NeedsAttention").length;

            return (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total Reports", value: reports.length.toString(), sub: "all time", color: ONGOING_COLOR },
                    { label: "Clips Approved", value: totalApproved.toLocaleString(), sub: `of ${totalSubmissions.toLocaleString()} submitted`, color: "#3DFFA2" },
                    { label: "Approval Rate", value: `${overallRate}%`, sub: "overall", color: overallRate >= 60 ? "#3DFFA2" : overallRate >= 40 ? ONGOING_COLOR : "#FF8800" },
                    { label: "Strong Sessions", value: strongCount.toString(), sub: attentionCount > 0 ? `${attentionCount} need attention` : "all clear", color: attentionCount > 0 ? "#FF8800" : "#3DFFA2" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl p-4" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(255,59,59,0.03), 0 4px 20px rgba(0,0,0,0.4)" }}>
                      <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{s.label}</p>
                      <p className="text-2xl font-bold mb-0.5" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
                      <p className="text-xs" style={{ color: "#5C6370" }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Month groups */}
                <div className="space-y-3">
                  {months.map((monthKey) => {
                    const monthReports = monthMap.get(monthKey)!;
                    const isOpen = expandedMonths.has(monthKey);
                    const mApproved = monthReports.reduce((s, r) => s + r.approved, 0);
                    const mSubmitted = monthReports.reduce((s, r) => s + r.totalSubmissions, 0);
                    const mRate = mSubmitted > 0 ? Math.round((mApproved / mSubmitted) * 100) : 0;
                    const mStrong = monthReports.filter((r) => r.status === "Strong").length;
                    const mAttention = monthReports.filter((r) => r.status === "NeedsAttention").length;

                    return (
                      <div key={monthKey} className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(255,59,59,0.03), 0 4px 24px rgba(0,0,0,0.4)" }}>
                        {/* Month header */}
                        <button
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                          onClick={() => toggleMonth(monthKey)}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(123,159,249,0.1)", border: "1px solid rgba(123,159,249,0.15)" }}>
                            <Activity size={15} style={{ color: ONGOING_COLOR }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmtMonthLabel(monthKey)}</p>
                            <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>
                              {monthReports.length} report{monthReports.length !== 1 ? "s" : ""}
                              {mStrong > 0 && <span className="ml-2" style={{ color: "#3DFFA2" }}>· {mStrong} strong</span>}
                              {mAttention > 0 && <span className="ml-2" style={{ color: "#FF8800" }}>· {mAttention} need attention</span>}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Submitted</p>
                              <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{mSubmitted.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                              <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{mApproved.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Rate</p>
                              <p className="text-sm font-semibold" style={{ color: mRate >= 60 ? "#3DFFA2" : mRate >= 40 ? ONGOING_COLOR : "#FF8800" }}>{mRate}%</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2 transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "#8A93A6" }}>
                            <ChevronDown size={16} />
                          </div>
                        </button>

                        {/* Report rows */}
                        {isOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {monthReports.map((report) => {
                              const isExpanded = expandedReportId === report.id;
                              const rate = report.totalSubmissions > 0 ? Math.round((report.approved / report.totalSubmissions) * 100) : null;
                              const meta = STATUS_META[report.status] ?? STATUS_META.Normal;

                              return (
                                <div key={report.id} className="rounded-xl overflow-hidden" style={{ background: "#05070D", border: `1px solid ${isExpanded ? "rgba(123,159,249,0.2)" : "rgba(255,255,255,0.05)"}`, transition: "border-color 0.15s" }}>
                                  {/* Row header */}
                                  <button
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.015] transition-colors"
                                    onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  >
                                    {/* Left accent */}
                                    <div className="w-0.5 self-stretch flex-shrink-0 rounded-full" style={{ background: `${ONGOING_COLOR}40` }} />

                                    {/* Date + day */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtDay(report.date)}</span>
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(123,159,249,0.08)", color: ONGOING_COLOR }}>{dayName(report.date)}</span>
                                        <span className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.text }}>
                                          {meta.icon}<span>{meta.label}</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "#8A93A6" }}>Submitted</p>
                                        <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{report.totalSubmissions}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                                        <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{report.approved}</p>
                                      </div>
                                      {rate !== null && (
                                        <div className="text-right">
                                          <p className="text-xs" style={{ color: "#8A93A6" }}>Rate</p>
                                          <p className="text-sm font-semibold" style={{ color: rate >= 60 ? "#3DFFA2" : rate >= 40 ? ONGOING_COLOR : "#FF8800" }}>{rate}%</p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-shrink-0 ml-2 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "#8A93A6" }}>
                                      <ChevronRight size={14} />
                                    </div>
                                  </button>

                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 space-y-4">
                                      {/* Numbers row (mobile fallback) */}
                                      <div className="sm:hidden grid grid-cols-3 gap-2">
                                        {[
                                          { label: "Submitted", value: report.totalSubmissions, color: "#F5F6FA" },
                                          { label: "Approved", value: report.approved, color: "#3DFFA2" },
                                          { label: "Pending", value: report.pending, color: ONGOING_COLOR },
                                        ].map((s) => (
                                          <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <p className="text-xs mb-1" style={{ color: "#8A93A6" }}>{s.label}</p>
                                            <p className="text-lg font-bold" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Full numbers */}
                                      <div className="hidden sm:grid grid-cols-4 gap-3">
                                        {[
                                          { label: "Submitted", value: report.totalSubmissions, color: "#F5F6FA" },
                                          { label: "Pending", value: report.pending, color: ONGOING_COLOR },
                                          { label: "Approved", value: report.approved, color: "#3DFFA2" },
                                          { label: "Rejected", value: report.rejected, color: "#FF3B3B" },
                                        ].map((s) => (
                                          <div key={s.label} className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <p className="text-xs mb-1.5" style={{ color: "#8A93A6" }}>{s.label}</p>
                                            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Narrative insights */}
                                      {[
                                        { key: "mainTrend", label: "Main Trend", value: report.mainTrend, color: ONGOING_COLOR, accent: "rgba(123,159,249,0.06)" },
                                        { key: "mainOptimization", label: "Optimization Focus", value: report.mainOptimization, color: "#FF8800", accent: "rgba(255,136,0,0.06)" },
                                        { key: "clipperFeedback", label: "Clipper Feedback", value: report.clipperFeedback, color: "#8A93A6", accent: "rgba(255,255,255,0.03)" },
                                      ].filter((s) => s.value).map((s) => (
                                        <div key={s.key} className="rounded-xl p-4" style={{ background: s.accent, border: "1px solid rgba(255,255,255,0.06)" }}>
                                          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: s.color }}>{s.label}</p>
                                          <p className="text-sm leading-relaxed" style={{ color: "#C8CDD8" }}>{s.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
