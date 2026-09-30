"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, BarChart2, ExternalLink, Check,
  TrendingUp, TrendingDown, Activity, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

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
  viewsTotal: number; viewsToday: number;
}

interface ClientData {
  id: string; name: string; status: string;
  campaignType: "manual" | "cpm";
  contractUrl: string | null;
  campaignTrackerUrl: string | null;
  logoUrl: string | null;
  dealLengthDays: number | null; dealStartDate: string | null; dealEndDate: string | null;
  pageCount: number | null; clipsPerDay: number | null;
  createdAt: string;
  clips: Clip[]; clippers: Clipper[];
  links: Link[]; onboardingSteps: OnboardingStep[];
  ongoingReports: OngoingReport[];
}

interface Props { client: ClientData; userName: string; previewMode?: boolean; }

/* ── Shared style fragments ──────────────────────────────────────── */
const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-inset-top)",
};

const cardElevated: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-inset-top)",
};

export default function ClientDashboard({ client, userName, previewMode }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "deal" | "onboarding" | "reports" | "contract">("overview");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    if (!client.ongoingReports?.length) return new Set();
    const latest = client.ongoingReports[0].date.slice(0, 7);
    return new Set([latest]);
  });
  const [clips] = useState<Clip[]>(client.clips);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));
  const [steps, setSteps] = useState<OnboardingStep[]>(client.onboardingSteps);
  const [togglingStep, setTogglingStep] = useState<string | null>(null);

  const [rangeStart, rangeEnd] = getRange(timePeriod, customStart, customEnd);
  const filteredClips = inRange(clips, rangeStart, rangeEnd);
  const prevClips = timePeriod === "all"
    ? []
    : (() => { const [ps, pe] = getPrevRange(rangeStart, rangeEnd); return inRange(clips, ps, pe); })();

  const currViews    = filteredClips.reduce((a, c) => a + c.views, 0);
  const currLikes    = filteredClips.reduce((a, c) => a + c.likes, 0);
  const currComments = filteredClips.reduce((a, c) => a + c.comments, 0);
  const currShares   = filteredClips.reduce((a, c) => a + c.shares, 0);
  const currSaves    = filteredClips.reduce((a, c) => a + c.saves, 0);
  const prevViews    = prevClips.reduce((a, c) => a + c.views, 0);
  const prevLikes    = prevClips.reduce((a, c) => a + c.likes, 0);
  const prevComments = prevClips.reduce((a, c) => a + c.comments, 0);
  const prevShares   = prevClips.reduce((a, c) => a + c.shares, 0);
  const prevSaves    = prevClips.reduce((a, c) => a + c.saves, 0);
  const prevClipCount = prevClips.length;

  const byDate: Record<string, number> = {};
  filteredClips.forEach((c) => { const d = c.submittedAt.slice(0, 10); byDate[d] = (byDate[d] ?? 0) + c.views; });
  const prevByDate: Record<string, number> = {};
  prevClips.forEach((c) => { const d = c.submittedAt.slice(0, 10); prevByDate[d] = (prevByDate[d] ?? 0) + c.views; });
  const currChartDates = Object.keys(byDate).sort();
  const prevChartDates = Object.keys(prevByDate).sort();
  const chartData = currChartDates.map((date, i) => ({
    date,
    views: byDate[date] ?? 0,
    prevViews: prevChartDates[i] !== undefined ? (prevByDate[prevChartDates[i]] ?? 0) : undefined,
  }));

  const completedSteps = steps.filter((s) => s.completed).length;
  const onboardingPct = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  async function toggleStep(stepId: string, completed: boolean) {
    if (previewMode) return;
    setTogglingStep(stepId);
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, completed }),
    });
    if (res.ok) setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, completed } : s));
    setTogglingStep(null);
  }

  const statItems = [
    { label: "Views",    value: fmt(currViews),    icon: Eye,         change: pct(currViews,    prevViews)    },
    { label: "Likes",    value: fmt(currLikes),    icon: Heart,       change: pct(currLikes,    prevLikes)    },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, change: pct(currComments, prevComments) },
    { label: "Shares",   value: fmt(currShares),   icon: Share2,      change: pct(currShares,   prevShares)   },
    { label: "Saves",    value: fmt(currSaves),    icon: Bookmark,    change: pct(currSaves,    prevSaves)    },
    { label: "Clips",    value: filteredClips.length.toString(), icon: BarChart2, change: pct(filteredClips.length, prevClipCount) },
  ];

  type TabId = "overview" | "reports" | "onboarding" | "contract" | "deal";
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(client.campaignType === "cpm" ? [
      { id: "reports"    as TabId, label: "Reports" },
      { id: "onboarding" as TabId, label: steps.length > 0 ? `Onboarding · ${onboardingPct}%` : "Onboarding" },
      { id: "contract"   as TabId, label: "Contract" },
    ] : []),
    { id: "deal", label: "Deal Terms" },
  ];

  const tooltipStyle = {
    contentStyle: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      fontSize: 12,
    },
    labelStyle: { color: "var(--text-secondary)" },
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {previewMode ? (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2.5"
          style={{
            background: "var(--bg-subtle)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <a href="/agency" className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Agency
          </a>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Viewing as <span style={{ color: "var(--text-primary)" }}>{client.name}</span>
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-md font-medium"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            Preview
          </span>
        </div>
      ) : (
        <Sidebar role="client" userName={userName} />
      )}

      <main className={`flex-1 overflow-y-auto ${previewMode ? "" : "ml-56"}`}>
        <div className={`max-w-5xl mx-auto px-8 py-8 ${previewMode ? "pt-14" : ""}`}>

          {/* ── Page header ────────────────────────────────────────── */}
          <div className="flex items-center gap-4 mb-6">
            {client.logoUrl && (
              <img
                src={client.logoUrl}
                alt={client.name}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                style={{ border: "1px solid var(--border-default)" }}
              />
            )}
            <div>
              <h1
                className="text-xl font-semibold tracking-tight"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
              >
                {client.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {client.campaignType === "cpm" ? "CPM Campaign" : `${clips.length} clips · ${client.clippers.flatMap((cl) => cl.subAccounts).length} accounts`}
              </p>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────────── */}
          <div className="flex gap-0 mb-7" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm relative tab-btn"
                style={{
                  color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  background: "transparent",
                  border: "none",
                }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <>
              {client.campaignType === "cpm" ? (
                <div className="space-y-4">
                  {/* Campaign Tracker card */}
                  <div style={card} className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}
                      >
                        <Activity size={15} style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                        >
                          Live Campaign Tracker
                        </p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          All clips, live performance stats, platform breakdown, real-time views, CPM, and exact payout — updated continuously.
                        </p>
                        {client.campaignTrackerUrl ? (
                          <a
                            href={client.campaignTrackerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                            style={{
                              background: "var(--accent-solid)",
                              color: "var(--text-on-accent)",
                              textDecoration: "none",
                              boxShadow: "var(--shadow-inset-top)",
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid-hover)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid)")}
                          >
                            <ExternalLink size={12} />
                            Open Live Tracker
                          </a>
                        ) : (
                          <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
                            Tracker link will appear here once set up.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity feed */}
                  {(() => {
                    const reports = (client.ongoingReports ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
                    const recent = reports.slice(0, 5);
                    if (recent.length === 0) return null;

                    function fmtDay(dateStr: string) {
                      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }
                    function dayName(dateStr: string) {
                      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                    }

                    return (
                      <div style={{ ...card, overflow: "hidden", padding: 0 }}>
                        <div
                          className="flex items-center justify-between px-5 py-3.5"
                          style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        >
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Recent Activity</p>
                          <button
                            onClick={() => setActiveTab("reports")}
                            className="text-xs font-medium transition-colors"
                            style={{ color: "var(--accent)" }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                          >
                            View all →
                          </button>
                        </div>
                        <div>
                          {recent.map((report, idx) => {
                            const prevReport = reports[idx + 1] ?? null;
                            const viewsTodayChange = prevReport && prevReport.viewsToday > 0
                              ? Math.round(((report.viewsToday - prevReport.viewsToday) / prevReport.viewsToday) * 100)
                              : null;
                            const changeColor = viewsTodayChange === null
                              ? "var(--text-tertiary)"
                              : viewsTodayChange >= 0 ? "var(--success)" : "var(--danger)";

                            return (
                              <div
                                key={report.id}
                                className="flex items-center gap-4 px-5 py-3 table-row-hover"
                                style={{ borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none" }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      {fmtDay(report.date)}
                                    </span>
                                    <span
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: "var(--bg-active)", color: "var(--text-tertiary)", fontSize: 10 }}
                                    >
                                      {dayName(report.date)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Approved</p>
                                    <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--success)" }}>{report.approved}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Views Today</p>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                        {fmt(report.viewsToday)}
                                      </p>
                                      {viewsTodayChange !== null && (
                                        <span className="text-xs font-medium" style={{ color: changeColor }}>
                                          {viewsTodayChange >= 0 ? "+" : ""}{viewsTodayChange}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Non-CPM Overview */
                <>
                  {/* Time period controls */}
                  <div className="flex items-center gap-3 flex-wrap mb-5">
                    <div
                      className="flex items-center gap-0.5 rounded-lg p-0.5"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                    >
                      {(["all", "1d", "7d", "mtd", "custom"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setTimePeriod(p)}
                          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                          style={{
                            background: timePeriod === p ? "var(--accent-muted)" : "transparent",
                            color: timePeriod === p ? "var(--accent)" : "var(--text-tertiary)",
                          }}
                        >
                          {p === "all" ? "All" : p === "1d" ? "Day" : p === "7d" ? "Week" : p === "mtd" ? "MTD" : "Custom"}
                        </button>
                      ))}
                    </div>
                    {timePeriod === "custom" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="date" value={customStart} max={customEnd}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="text-xs px-3 py-1.5 rounded-md outline-none"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-primary)",
                            colorScheme: "dark",
                            height: 32,
                          }}
                        />
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>to</span>
                        <input
                          type="date" value={customEnd} min={customStart}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="text-xs px-3 py-1.5 rounded-md outline-none"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-primary)",
                            colorScheme: "dark",
                            height: 32,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Stats bar */}
                  <div style={{ ...card, overflow: "hidden", padding: 0 }} className="mb-4">
                    <div className="grid grid-cols-6">
                      {statItems.map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.label}
                            className="flex flex-col items-center justify-center gap-1.5 px-3 py-4"
                            style={{ borderRight: i < 5 ? "1px solid var(--border-subtle)" : "none" }}
                          >
                            <Icon size={14} style={{ color: "var(--text-tertiary)" }} />
                            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{item.label}</p>
                            <span
                              className="text-lg font-semibold leading-none tabular-nums"
                              style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                            >
                              {item.value}
                            </span>
                            {item.change.ok && (
                              <span
                                className="flex items-center gap-0.5 text-xs font-medium leading-none"
                                style={{ color: item.change.pos ? "var(--success)" : "var(--danger)" }}
                              >
                                {item.change.pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {item.change.str}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="px-5 py-2"
                      style={{ borderTop: "1px solid var(--border-subtle)" }}
                    >
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {prevLabel(timePeriod, customStart, customEnd)}
                      </p>
                    </div>
                  </div>

                  {/* Views chart */}
                  <div style={card} className="p-5 mb-4">
                    <h2
                      className="text-sm font-semibold mb-4"
                      style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                    >
                      Views Over Time
                    </h2>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                          <defs>
                            <linearGradient id="clientViewGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.6} />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: string) => fmtDate(v)} />
                          <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: number) => fmt(v)} width={44} />
                          <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "var(--text-primary)" }} />
                          {timePeriod !== "all" && (
                            <Area name="Prev Period" type="linear" dataKey="prevViews"
                              stroke="var(--border-strong)" strokeWidth={1.5} fill="none"
                              strokeDasharray="5 3" dot={false} />
                          )}
                          <Area name="Views" type="linear" dataKey="views"
                            stroke="var(--accent)" strokeWidth={1.5}
                            fill="url(#clientViewGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm py-10 text-center" style={{ color: "var(--text-tertiary)" }}>
                        No clips in this period
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── DEAL TERMS ───────────────────────────────────────────── */}
          {activeTab === "deal" && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Deal Length", value: client.dealLengthDays ? `${client.dealLengthDays} days` : "—" },
                { label: "Pages", value: client.pageCount?.toString() ?? "—" },
                { label: "Clips / Day", value: client.clipsPerDay?.toString() ?? "—" },
                { label: "Total Clips", value: client.clips.length.toString() },
                { label: "Active Clippers", value: client.clippers.length.toString() },
                { label: "Started", value: new Date(client.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
              ].map((item) => (
                <div key={item.label} style={card} className="p-5">
                  <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {item.label}
                  </p>
                  <p
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── ONBOARDING ───────────────────────────────────────────── */}
          {activeTab === "onboarding" && (
            <div className="space-y-3">
              {steps.length > 0 && (
                <div style={card} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {completedSteps} of {steps.length} complete
                    </span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: "var(--success)" }}>
                      {onboardingPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--bg-hover)" }}>
                    <div
                      className="h-1.5 rounded-full bar-fill"
                      style={{ width: `${onboardingPct}%`, background: "var(--success)" }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 p-4 rounded-xl transition-colors"
                    style={{
                      background: "var(--bg-surface)",
                      border: `1px solid ${step.completed ? "rgba(61,214,140,0.2)" : "var(--border-default)"}`,
                    }}
                  >
                    <button
                      onClick={() => toggleStep(step.id, !step.completed)}
                      disabled={togglingStep === step.id || previewMode}
                      className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors check-circle"
                      title={step.completed ? "Mark incomplete" : "Mark complete"}
                      style={{
                        background: step.completed ? "var(--success-bg)" : "var(--bg-hover)",
                        border: `1.5px solid ${step.completed ? "var(--success)" : "var(--border-strong)"}`,
                        cursor: previewMode ? "default" : "pointer",
                        opacity: togglingStep === step.id ? 0.5 : 1,
                        borderRadius: 4,
                      }}
                    >
                      {step.completed && <Check size={10} style={{ color: "var(--success)" }} strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: step.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                          textDecoration: step.completed ? "line-through" : "none",
                        }}
                      >
                        {step.title}
                      </p>
                      {step.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                          {step.description}
                        </p>
                      )}
                      {step.linkUrl && (
                        <a
                          href={step.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs mt-2 px-2.5 py-1 rounded-md font-medium transition-colors"
                          style={{
                            background: "var(--accent-muted)",
                            border: "1px solid var(--accent-border)",
                            color: "var(--accent)",
                          }}
                        >
                          <ExternalLink size={10} /> Open Link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {steps.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No onboarding steps yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CONTRACT ─────────────────────────────────────────────── */}
          {activeTab === "contract" && client.campaignType === "cpm" && (
            <div className="max-w-xl">
              {client.contractUrl ? (
                <div style={card} className="overflow-hidden p-0">
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--bg-active)", border: "1px solid var(--border-default)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Signed Agreement</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Your executed campaign contract</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-4 flex flex-col items-start gap-3">
                    <div
                      className="w-full rounded-md px-3 py-2 flex items-center gap-2"
                      style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <p className="text-xs truncate flex-1" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                        {client.contractUrl}
                      </p>
                    </div>
                    <a
                      href={client.contractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      style={{
                        background: "var(--accent-solid)",
                        color: "var(--text-on-accent)",
                        textDecoration: "none",
                        boxShadow: "var(--shadow-inset-top)",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid-hover)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid)")}
                    >
                      <ExternalLink size={13} />
                      Open Agreement
                    </a>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-xl py-20"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 12 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No contract on file yet</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Your signed agreement will appear here once shared.</p>
                </div>
              )}
            </div>
          )}

          {/* ── CAMPAIGN REPORTS (CPM) ────────────────────────────────── */}
          {activeTab === "reports" && client.campaignType === "cpm" && (() => {
            const reports = (client.ongoingReports ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));

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
                <div
                  className="flex flex-col items-center justify-center rounded-xl py-20"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                >
                  <Activity size={28} style={{ color: "var(--text-tertiary)", opacity: 0.4, marginBottom: 12 }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No reports yet</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Your campaign reports will appear here.</p>
                </div>
              );
            }

            const totalApproved    = reports.reduce((s, r) => s + r.approved, 0);
            const totalSubmissions = reports.reduce((s, r) => s + r.totalSubmissions, 0);

            return (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Reports",   value: reports.length.toString(),              sub: "all time",                            color: "var(--text-primary)" },
                    { label: "Clips Approved",  value: totalApproved.toLocaleString(),         sub: `of ${totalSubmissions.toLocaleString()} submitted`, color: "var(--success)" },
                    { label: "Total Views",     value: fmt(reports[0]?.viewsTotal ?? 0),       sub: "running total",                       color: "var(--accent)" },
                  ].map((s) => (
                    <div key={s.label} style={card} className="p-4">
                      <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {s.label}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums mb-0.5" style={{ color: s.color, fontFamily: "var(--font-display)" }}>
                        {s.value}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Views chart — manual report data */}
                {reports.length > 1 && (() => {
                  const chartData = reports
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((r) => ({ date: r.date.slice(0, 10), views: r.viewsToday }));
                  return (
                    <div style={card} className="p-5 mb-4">
                      <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                        Daily Views Over Time
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                          <defs>
                            <linearGradient id="cpmViewsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.6} />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: string) => fmtDate(v)} />
                          <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: number) => fmt(v)} width={44} />
                          <Tooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 8 }} labelStyle={{ color: "var(--text-tertiary)" }} itemStyle={{ color: "var(--text-primary)" }} />
                          <Area name="Views" type="linear" dataKey="views"
                            stroke="var(--accent)" strokeWidth={1.5}
                            fill="url(#cpmViewsGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      <p className="text-xs mt-3 text-center" style={{ color: "var(--text-tertiary)" }}>
                        Manual (report data) · Live tracking automated via campaign link
                      </p>
                    </div>
                  );
                })()}
                {/* Month groups */}
                <div className="space-y-2">
                  {months.map((monthKey) => {
                    const monthReports = monthMap.get(monthKey)!;
                    const isOpen = expandedMonths.has(monthKey);
                    const mApproved  = monthReports.reduce((s, r) => s + r.approved, 0);

                    return (
                      <div
                        key={monthKey}
                        style={{ ...card, overflow: "hidden", padding: 0 }}
                      >
                        {/* Month header */}
                        <button
                          className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                          style={{ background: "transparent" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                          onClick={() => toggleMonth(monthKey)}
                        >
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}
                          >
                            <Activity size={13} style={{ color: "var(--accent)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {fmtMonthLabel(monthKey)}
                            </p>
                            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {monthReports.length} report{monthReports.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Approved</p>
                              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--success)" }}>{mApproved.toLocaleString()}</p>
                            </div>
                          </div>
                          <div
                            className="flex-shrink-0 ml-2 transition-transform duration-200"
                            style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "var(--text-tertiary)" }}
                          >
                            <ChevronDown size={15} />
                          </div>
                        </button>

                        {/* Report rows */}
                        {isOpen && (
                          <div
                            className="px-3 pb-3 space-y-1.5 pt-1"
                            style={{ borderTop: "1px solid var(--border-subtle)" }}
                          >
                            {monthReports.map((report) => {
                              const isExpanded = expandedReportId === report.id;
                              const globalIdx = reports.indexOf(report);
                              const prevReport = globalIdx >= 0 && globalIdx + 1 < reports.length ? reports[globalIdx + 1] : null;
                              const viewsTodayChange = prevReport && prevReport.viewsToday > 0
                                ? Math.round(((report.viewsToday - prevReport.viewsToday) / prevReport.viewsToday) * 100)
                                : null;
                              const changeColor = viewsTodayChange === null
                                ? "var(--text-tertiary)"
                                : viewsTodayChange >= 0 ? "var(--success)" : "var(--danger)";

                              return (
                                <div
                                  key={report.id}
                                  className="rounded-lg overflow-hidden"
                                  style={{
                                    background: "var(--bg-base)",
                                    border: `1px solid ${isExpanded ? "var(--accent-border)" : "var(--border-subtle)"}`,
                                    transition: "border-color 120ms ease",
                                  }}
                                >
                                  {/* Row header */}
                                  <button
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                                    style={{ background: "transparent" }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                                    onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  >
                                    {/* Left accent bar */}
                                    <div
                                      className="w-0.5 self-stretch flex-shrink-0 rounded-full"
                                      style={{ background: "var(--accent-border)" }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                          {fmtDay(report.date)}
                                        </span>
                                        <span
                                          className="text-xs px-1.5 py-0.5 rounded"
                                          style={{ background: "var(--bg-active)", color: "var(--text-tertiary)", fontSize: 10 }}
                                        >
                                          {dayName(report.date)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Approved</p>
                                        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--success)" }}>{report.approved}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Views Today</p>
                                        <div className="flex items-center justify-end gap-1.5">
                                          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                            {fmt(report.viewsToday)}
                                          </p>
                                          {viewsTodayChange !== null && (
                                            <span className="text-xs font-medium" style={{ color: changeColor }}>
                                              {viewsTodayChange >= 0 ? "+" : ""}{viewsTodayChange}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Views Total</p>
                                        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                          {fmt(report.viewsTotal)}
                                        </p>
                                      </div>
                                    </div>
                                    <div
                                      className="flex-shrink-0 ml-2 transition-transform duration-200"
                                      style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "var(--text-tertiary)" }}
                                    >
                                      <ChevronRight size={13} />
                                    </div>
                                  </button>

                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div
                                      className="px-5 pb-5 pt-3 space-y-3"
                                      style={{ borderTop: "1px solid var(--border-subtle)" }}
                                    >
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                          { label: "Approved",      value: report.approved.toString(),    color: "var(--success)" },
                                          { label: "Views Today",   value: fmt(report.viewsToday),        color: "var(--accent)" },
                                          { label: "Views Total",   value: fmt(report.viewsTotal),        color: "var(--text-primary)" },
                                          { label: "Views Change",  value: viewsTodayChange !== null ? `${viewsTodayChange >= 0 ? "+" : ""}${viewsTodayChange}%` : "—", color: viewsTodayChange === null ? "var(--text-tertiary)" : viewsTodayChange >= 0 ? "var(--success)" : "var(--danger)" },
                                        ].map((s) => (
                                          <div
                                            key={s.label}
                                            className="rounded-lg p-3"
                                            style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
                                          >
                                            <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{s.label}</p>
                                            <p className="text-xl font-semibold tabular-nums" style={{ color: s.color, fontFamily: "var(--font-display)" }}>
                                              {s.value}
                                            </p>
                                          </div>
                                        ))}
                                      </div>

                                      {[
                                        { key: "mainTrend",        label: "Main Trend",         value: report.mainTrend,        border: "var(--accent-border)",  bg: "var(--accent-muted)",   color: "var(--accent)" },
                                        { key: "mainOptimization", label: "Optimization Focus", value: report.mainOptimization, border: "rgba(245,185,74,0.3)",   bg: "var(--warning-bg)",     color: "var(--warning)" },
                                        { key: "clipperFeedback",  label: "Clipper Feedback",   value: report.clipperFeedback,  border: "var(--border-default)", bg: "var(--bg-hover)",       color: "var(--text-secondary)" },
                                      ].filter((s) => s.value).map((s) => (
                                        <div
                                          key={s.key}
                                          className="rounded-lg p-4"
                                          style={{ background: s.bg, border: `1px solid ${s.border}` }}
                                        >
                                          <p
                                            className="text-xs font-semibold uppercase tracking-widest mb-2"
                                            style={{ color: s.color, fontSize: 10, letterSpacing: "0.07em" }}
                                          >
                                            {s.label}
                                          </p>
                                          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                                            {s.value}
                                          </p>
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
