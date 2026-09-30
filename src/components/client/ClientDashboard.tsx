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

  type TabId = "overview" | "reports" | "onboarding" | "contract" | "deal";
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(client.campaignType === "cpm" ? [
      { id: "reports" as TabId, label: "Campaign Reports" },
      { id: "onboarding" as TabId, label: `Onboarding${steps.length > 0 ? ` ${onboardingPct}%` : ""}` },
      { id: "contract" as TabId, label: "Contract" },
    ] : []),
    { id: "deal", label: "Deal Terms" },
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
              {client.campaignType !== "cpm" && (
                <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clips.length} clips · {client.clippers.flatMap((cl) => cl.subAccounts).length} accounts</p>
              )}
              {client.campaignType === "cpm" && (
                <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>CPM Campaign</p>
              )}
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
              {client.campaignType === "cpm" ? (
                /* CPM Overview: tracker card + recent reports feed */
                <div className="space-y-6">
                  {/* Campaign Tracker card */}
                  <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,59,59,0.15)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.25)" }}>
                        <Activity size={16} color="#FF3B3B" />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Live Campaign Tracker</p>
                        <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>View all clips, live performance stats, platform breakdown, real-time views, CPM, and exact payout — updated continuously.</p>
                      </div>
                    </div>
                    {client.campaignTrackerUrl ? (
                      <a
                        href={client.campaignTrackerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold mt-2 transition-all"
                        style={{ background: "#FF3B3B", color: "#fff", boxShadow: "0 0 24px rgba(255,59,59,0.45)", textDecoration: "none" }}
                      >
                        <ExternalLink size={14} />
                        Open Live Tracker
                      </a>
                    ) : (
                      <div className="mt-2 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>Your live tracker link will appear here once set up.</p>
                      </div>
                    )}
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
                      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Recent Activity</p>
                          <button
                            onClick={() => setActiveTab("reports")}
                            className="text-xs font-medium"
                            style={{ color: "#FF3B3B" }}
                          >
                            View All Reports →
                          </button>
                        </div>
                        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          {recent.map((report, idx) => {
                            const prevReport = reports[idx + 1] ?? null;
                            const viewsTodayChange = prevReport
                              ? prevReport.viewsToday > 0
                                ? Math.round(((report.viewsToday - prevReport.viewsToday) / prevReport.viewsToday) * 100)
                                : null
                              : null;
                            const changeColor = viewsTodayChange === null ? "#8A93A6" : viewsTodayChange >= 0 ? "#3DFFA2" : "#FF4757";
                            return (
                              <div key={report.id} className="flex items-center gap-4 px-5 py-3.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtDay(report.date)}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,59,59,0.08)", color: "#FF3B3B" }}>{dayName(report.date)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-5 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                                    <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{report.approved}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs" style={{ color: "#8A93A6" }}>Views Today</p>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(report.viewsToday)}</p>
                                      {viewsTodayChange !== null && (
                                        <span className="text-xs font-semibold" style={{ color: changeColor }}>
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
                /* Non-CPM Overview: simplified — stats bar + chart */
                <>
                  {/* Time period controls */}
                  <div className="flex items-center gap-3 flex-wrap mb-4">
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
                </>
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

          {/* ── CAMPAIGN REPORTS (CPM) ───────────────────────────────── */}
          {activeTab === "reports" && client.campaignType === "cpm" && (() => {
            const REPORT_COLOR = "#FF3B3B";
            const reports = (client.ongoingReports ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));

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
                  <Activity size={36} style={{ color: REPORT_COLOR, opacity: 0.3 }} className="mb-4" />
                  <p className="text-base font-semibold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>No reports yet</p>
                  <p className="text-sm" style={{ color: "#8A93A6" }}>Your campaign reports will appear here.</p>
                </div>
              );
            }

            // Summary stats across all reports
            const totalApproved = reports.reduce((s, r) => s + r.approved, 0);
            const totalSubmissions = reports.reduce((s, r) => s + r.totalSubmissions, 0);
            const overallRate = totalSubmissions > 0 ? Math.round((totalApproved / totalSubmissions) * 100) : 0;

            return (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Total Reports", value: reports.length.toString(), sub: "all time", color: REPORT_COLOR },
                    { label: "Clips Approved", value: totalApproved.toLocaleString(), sub: `of ${totalSubmissions.toLocaleString()} submitted`, color: "#3DFFA2" },
                    { label: "Approval Rate", value: `${overallRate}%`, sub: "overall", color: overallRate >= 60 ? "#3DFFA2" : overallRate >= 40 ? REPORT_COLOR : "#FF8800" },
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

                    return (
                      <div key={monthKey} className="rounded-xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(255,59,59,0.03), 0 4px 24px rgba(0,0,0,0.4)" }}>
                        {/* Month header */}
                        <button
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                          onClick={() => toggleMonth(monthKey)}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.15)" }}>
                            <Activity size={15} style={{ color: REPORT_COLOR }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmtMonthLabel(monthKey)}</p>
                            <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>
                              {monthReports.length} report{monthReports.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                              <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{mApproved.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Rate</p>
                              <p className="text-sm font-semibold" style={{ color: mRate >= 60 ? "#3DFFA2" : mRate >= 40 ? REPORT_COLOR : "#FF8800" }}>{mRate}%</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2 transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "#8A93A6" }}>
                            <ChevronDown size={16} />
                          </div>
                        </button>

                        {/* Report rows */}
                        {isOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {monthReports.map((report, rIdx) => {
                              const isExpanded = expandedReportId === report.id;
                              const rate = report.totalSubmissions > 0 ? Math.round((report.approved / report.totalSubmissions) * 100) : null;
                              // prev report within the full sorted list
                              const globalIdx = reports.indexOf(report);
                              const prevReport = globalIdx >= 0 && globalIdx + 1 < reports.length ? reports[globalIdx + 1] : null;
                              const viewsTodayChange = prevReport
                                ? prevReport.viewsToday > 0
                                  ? Math.round(((report.viewsToday - prevReport.viewsToday) / prevReport.viewsToday) * 100)
                                  : null
                                : null;
                              const changeColor = viewsTodayChange === null ? "#8A93A6" : viewsTodayChange >= 0 ? "#3DFFA2" : "#FF4757";

                              return (
                                <div key={report.id} className="rounded-xl overflow-hidden" style={{ background: "#05070D", border: `1px solid ${isExpanded ? "rgba(255,59,59,0.2)" : "rgba(255,255,255,0.05)"}`, transition: "border-color 0.15s" }}>
                                  {/* Row header */}
                                  <button
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.015] transition-colors"
                                    onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  >
                                    {/* Left accent */}
                                    <div className="w-0.5 self-stretch flex-shrink-0 rounded-full" style={{ background: `${REPORT_COLOR}40` }} />

                                    {/* Date + day */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtDay(report.date)}</span>
                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(255,59,59,0.08)", color: REPORT_COLOR }}>{dayName(report.date)}</span>
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                                        <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{report.approved}</p>
                                      </div>
                                      {rate !== null && (
                                        <div className="text-right">
                                          <p className="text-xs" style={{ color: "#8A93A6" }}>Rate</p>
                                          <p className="text-sm font-semibold" style={{ color: rate >= 60 ? "#3DFFA2" : rate >= 40 ? REPORT_COLOR : "#FF8800" }}>{rate}%</p>
                                        </div>
                                      )}
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "#8A93A6" }}>Views Today</p>
                                        <div className="flex items-center justify-end gap-1.5">
                                          <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(report.viewsToday)}</p>
                                          {viewsTodayChange !== null && (
                                            <span className="text-xs font-semibold" style={{ color: changeColor }}>
                                              {viewsTodayChange >= 0 ? "+" : ""}{viewsTodayChange}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "#8A93A6" }}>Views Total</p>
                                        <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(report.viewsTotal)}</p>
                                      </div>
                                    </div>

                                    <div className="flex-shrink-0 ml-2 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "#8A93A6" }}>
                                      <ChevronRight size={14} />
                                    </div>
                                  </button>

                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 space-y-4">
                                      {/* Key stats */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                          { label: "Approved", value: report.approved, display: report.approved.toString(), color: "#3DFFA2" },
                                          { label: "Views Today", value: report.viewsToday, display: fmt(report.viewsToday), color: REPORT_COLOR },
                                          { label: "Views Total", value: report.viewsTotal, display: fmt(report.viewsTotal), color: "#F5F6FA" },
                                          { label: "Approval Rate", value: rate, display: rate !== null ? `${rate}%` : "—", color: rate !== null && rate >= 60 ? "#3DFFA2" : "#F5F6FA" },
                                        ].map((s) => (
                                          <div key={s.label} className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <p className="text-xs mb-1.5" style={{ color: "#8A93A6" }}>{s.label}</p>
                                            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Space Grotesk, sans-serif" }}>{s.display}</p>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Narrative insights */}
                                      {[
                                        { key: "mainTrend", label: "Main Trend", value: report.mainTrend, color: REPORT_COLOR, accent: "rgba(255,59,59,0.06)" },
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
