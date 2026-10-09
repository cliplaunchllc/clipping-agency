"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/shared/Sidebar";
import {
  ExternalLink, ChevronDown,
  Activity, CalendarDays, ChevronRight,
  Users, CheckCircle, Clock, AlertCircle, FileText, Eye, DollarSign, Wallet,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtWeekRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

interface CampaignReport {
  id: string; weekStartDate: string; weekEndDate: string;
  totalViews: number; tiktokViews: number; instagramViews: number;
  youtubeViews: number; twitterViews: number;
  paidOut: number; effectiveCpm: number | null; budgetRemaining: number | null;
  clipsSubmitted: number; clipsApproved: number;
  weeklySummary: string | null; whatsWorking: string | null;
  whatsNotWorking: string | null; nextWeekFocus: string | null;
  publishedAt: string | null;
}

interface OngoingReport {
  id: string; date: string; totalSubmissions: number; pending: number;
  approved: number; rejected: number; mainTrend: string | null;
  clipperFeedback: string | null; mainOptimization: string | null; status: string;
  viewsTotal: number; viewsToday: number;
}

interface Props {
  userName: string;
  clients: AnyRecord[];
  allClients: AnyRecord[];
  clips: AnyRecord[];
  totalViews: number;
  pendingClientUsers?: AnyRecord[];
}

const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
};

/* ── Status helper ──────────────────────────────────────────────────── */
type ClientStatus = "good" | "neutral" | "needs attention";
function getClientStatus(cFull: AnyRecord): ClientStatus {
  const sevenDaysAgo  = new Date(Date.now() - 7  * 86_400_000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);
  const latestDateStr = (cFull?.campaignReports?.[0]?.weekEndDate ?? cFull?.ongoingReports?.[0]?.date) as string | undefined;
  if (!latestDateStr) return "needs attention";
  const d = new Date(latestDateStr + "T00:00:00");
  if (d >= sevenDaysAgo)    return "good";
  if (d >= fourteenDaysAgo) return "neutral";
  return "needs attention";
}

export default function AgencyDashboard({ userName, clients, allClients, clips: initialClips, pendingClientUsers = [] }: Props) {
  const [allClips] = useState<AnyRecord[]>(initialClips);
  const [selectedClientId, setSelectedClientId] = useState("all");
  // Per-client inline report breakout
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
  function toggleClientBreakout(id: string) {
    setExpandedClientIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  // Report expansion state (single-client view)
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedWeekReportId, setExpandedWeekReportId] = useState<string | null>(null);
  const [highlightedWeekId, setHighlightedWeekId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const weekReportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Reset expansion state and open latest month when switching clients
  useEffect(() => {
    setExpandedReportId(null);
    setExpandedWeekReportId(null);
    setHighlightedWeekId(null);
    const sc = allClients.find((c) => c.id === selectedClientId);
    const reports = (sc?.ongoingReports ?? []) as OngoingReport[];
    setExpandedMonths(reports.length ? new Set([reports[0].date.slice(0, 7)]) : new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const activeClients = clients.filter((c) => c.status === "active");
  const selectedClient = allClients.find((c) => c.id === selectedClientId) ?? null;
  const campaignReports = (selectedClient?.campaignReports ?? []) as CampaignReport[];
  const ongoingReports = (selectedClient?.ongoingReports ?? [])
    .slice()
    .sort((a: OngoingReport, b: OngoingReport) => b.date.localeCompare(a.date)) as OngoingReport[];

  // Chart data for single-client view
  const cpmChartData = [...ongoingReports]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, views: r.viewsToday }));

  const tooltipStyle = {
    contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, fontSize: 12 },
    labelStyle: { color: "var(--text-secondary)" },
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
      <Sidebar role="agency" userName={userName} />
      <main className="flex-1 overflow-y-auto ml-56">


        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {true && <>
            <style>{`
              @keyframes liveOrbPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(61,255,162,0.7), 0 0 8px rgba(61,255,162,0.5); }
                50%      { box-shadow: 0 0 0 5px rgba(61,255,162,0.12), 0 0 18px rgba(61,255,162,0.5); }
              }
              .live-orb { animation: liveOrbPulse 2.4s ease-in-out infinite; }
              @keyframes paidBarGlow {
                0%, 100% { box-shadow: 0 0 6px 1px rgba(255,59,59,0.55); }
                50%      { box-shadow: 0 0 14px 3px rgba(255,59,59,0.85); }
              }
              .paid-bar { animation: paidBarGlow 1.8s ease-in-out infinite; }
            `}</style>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                  {selectedClient ? selectedClient.name : "Overview"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {selectedClient ? "CPM Campaign" : `${activeClients.length} active client${activeClients.length !== 1 ? "s" : ""} · CPM campaigns`}
                </p>
              </div>
              {/* Client selector for single-client drilldown */}
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
            </div>

            {selectedClientId === "all" ? (
              /* ── ALL CLIENTS ──────────────────────────────────────── */
              (() => {
                const activeFullClients = allClients.filter((c) => c.status === "active");
                const goodCount      = activeFullClients.filter((c) => getClientStatus(c) === "good").length;
                const attnCount      = activeFullClients.filter((c) => getClientStatus(c) === "needs attention").length;
                const neutralCount   = activeFullClients.filter((c) => getClientStatus(c) === "neutral").length;
                const totalReports   = activeFullClients.reduce((s: number, c: AnyRecord) => s + (c.campaignReports?.length ?? 0) + (c.ongoingReports?.length ?? 0), 0);

                return (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      {/* Active Clients — with live orb */}
                      <div style={card} className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="live-orb w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--accent)", boxShadow: "0 0 8px rgba(61,255,162,0.6)" }} />
                          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Active Clients</p>
                        </div>
                        <p className="text-3xl font-semibold tabular-nums mb-0.5" style={{ color: "var(--accent)", fontFamily: "var(--font-display)" }}>{activeClients.length}</p>
                        <div className="flex items-center gap-1.5">
                          <Users size={11} style={{ color: "var(--text-tertiary)" }} />
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{clients.filter((c) => c.status !== "active").length} archived</p>
                        </div>
                      </div>
                      {/* On Track */}
                      <div style={card} className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle size={12} style={{ color: "var(--success)", opacity: 0.7 }} />
                          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>On Track</p>
                        </div>
                        <p className="text-3xl font-semibold tabular-nums mb-0.5" style={{ color: "var(--success)", fontFamily: "var(--font-display)" }}>{goodCount}</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>report in last 7 days</p>
                      </div>
                      {/* Quiet */}
                      <div style={card} className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={12} style={{ color: "var(--warning)", opacity: 0.7 }} />
                          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Quiet</p>
                        </div>
                        <p className="text-3xl font-semibold tabular-nums mb-0.5" style={{ color: "var(--warning)", fontFamily: "var(--font-display)" }}>{neutralCount}</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>no report in 7–14 days</p>
                      </div>
                      {/* Needs Attention */}
                      <div style={card} className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle size={12} style={{ color: "var(--danger)", opacity: 0.7 }} />
                          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Needs Attention</p>
                        </div>
                        <p className="text-3xl font-semibold tabular-nums mb-0.5" style={{ color: "var(--danger)", fontFamily: "var(--font-display)" }}>{attnCount}</p>
                        <div className="flex items-center gap-1.5">
                          <FileText size={11} style={{ color: "var(--text-tertiary)" }} />
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{totalReports} total reports filed</p>
                        </div>
                      </div>
                    </div>

                    {/* Client list */}
                    {activeClients.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl py-16"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                        <Activity size={28} style={{ color: "var(--text-tertiary)", opacity: 0.4, marginBottom: 12 }} />
                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No active clients</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Add a client to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeClients.map((c) => {
                          const cFull  = allClients.find((x) => x.id === c.id)!;
                          const status = getClientStatus(cFull);
                          const latestWeekly  = cFull?.campaignReports?.[0]  as CampaignReport | undefined;
                          const latestOngoing = cFull?.ongoingReports?.[0]   as OngoingReport  | undefined;
                          const isExpanded    = expandedClientIds.has(c.id);

                          const statusDot   = status === "good" ? "var(--success)" : status === "neutral" ? "var(--warning)" : "var(--danger)";
                          const statusLabel = status === "good" ? "Good" : status === "neutral" ? "Neutral" : "Needs Attention";
                          const statusBg    = status === "good" ? "rgba(61,214,140,0.1)" : status === "neutral" ? "rgba(245,185,74,0.1)" : "rgba(255,59,59,0.1)";
                          const statusBorder= status === "good" ? "rgba(61,214,140,0.25)" : status === "neutral" ? "rgba(245,185,74,0.25)" : "rgba(255,59,59,0.25)";

                          // Build combined report list for breakout
                          const allReports: Array<{ kind: "daily" | "weekly"; date: string; report: OngoingReport | CampaignReport }> = [
                            ...(cFull?.ongoingReports ?? []).map((r: OngoingReport) => ({ kind: "daily" as const, date: r.date, report: r })),
                            ...(cFull?.campaignReports ?? []).map((r: CampaignReport) => ({ kind: "weekly" as const, date: r.weekEndDate, report: r })),
                          ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

                          return (
                            <div key={c.id} style={{ ...card, overflow: "hidden", padding: 0 }}>
                              {/* Client row */}
                              <div className="flex items-center gap-4 px-5 py-4">
                                {/* Logo */}
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
                                  style={c.logoUrl ? { border: "1px solid var(--border-default)" } : { background: "var(--accent-muted)", color: "var(--accent)" }}>
                                  {c.logoUrl ? <img src={c.logoUrl} alt="" className="w-full h-full object-cover" /> : (c.name as string)[0]}
                                </div>

                                {/* Name + last report info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                                    {/* Status badge */}
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
                                      style={{ background: statusBg, border: `1px solid ${statusBorder}`, color: statusDot, fontSize: 10 }}>
                                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusDot }} />
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                    {latestWeekly ? (
                                      <>Last week: {fmtWeekRange(latestWeekly.weekStartDate, latestWeekly.weekEndDate)}
                                        {" · "}<span style={{ color: "var(--accent)" }}>{fmt(latestWeekly.totalViews)} views</span>
                                        {latestWeekly.paidOut > 0 && <>{" · "}<span style={{ color: "var(--success)" }}>{fmtCurrency(latestWeekly.paidOut)}</span></>}
                                      </>
                                    ) : latestOngoing ? (
                                      <>Latest: {fmtDate(latestOngoing.date)}
                                        {" · "}{latestOngoing.approved} approved
                                        {" · "}<span style={{ color: "var(--accent)" }}>{fmt(latestOngoing.viewsTotal)} views</span>
                                      </>
                                    ) : (
                                      <span style={{ color: "var(--text-tertiary)" }}>No reports yet</span>
                                    )}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {cFull?.campaignTrackerUrl && (
                                    <a href={cFull.campaignTrackerUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                      style={{ background: "var(--accent-muted)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)" }}>
                                      <ExternalLink size={11} /> Tracker
                                    </a>
                                  )}
                                  <button onClick={() => setSelectedClientId(c.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background: "var(--border-subtle)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
                                    Full View
                                  </button>
                                  <button
                                    onClick={() => toggleClientBreakout(c.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    style={{ background: isExpanded ? "var(--bg-active)" : "var(--border-subtle)", border: "1px solid var(--border-default)", color: isExpanded ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                    Reports
                                    <span className="transition-transform duration-200" style={{ display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "none" }}>
                                      <ChevronDown size={11} />
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {/* Inline report breakout */}
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                  {allReports.length === 0 ? (
                                    <p className="text-xs py-4 text-center" style={{ color: "var(--text-tertiary)" }}>No reports yet for this client.</p>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-2 gap-2 pt-3">
                                        {/* Daily reports column */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold uppercase tracking-widest px-1 pb-1"
                                            style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Daily Reports</p>
                                          {allReports.filter((r) => r.kind === "daily").length === 0 && (
                                            <p className="text-xs px-1" style={{ color: "var(--text-tertiary)" }}>None</p>
                                          )}
                                          {allReports.filter((r) => r.kind === "daily").map(({ report }) => {
                                            const r = report as OngoingReport;
                                            return (
                                              <div key={r.id} className="rounded-lg px-3 py-2.5"
                                                style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                                                <div className="flex items-center justify-between gap-3">
                                                  <div>
                                                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                                      {fmtDate(r.date)}
                                                      <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
                                                        {new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                                                      </span>
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className="text-xs" style={{ color: "var(--success)" }}>{r.approved} approved</span>
                                                    <span className="text-xs tabular-nums" style={{ color: "var(--accent)" }}>{fmt(r.viewsToday)} views</span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {/* Weekly summaries column */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold uppercase tracking-widest px-1 pb-1"
                                            style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Weekly Summaries</p>
                                          {allReports.filter((r) => r.kind === "weekly").length === 0 && (
                                            <p className="text-xs px-1" style={{ color: "var(--text-tertiary)" }}>None</p>
                                          )}
                                          {allReports.filter((r) => r.kind === "weekly").map(({ report }) => {
                                            const wr = report as CampaignReport;
                                            return (
                                              <div key={wr.id} className="rounded-lg px-3 py-2.5"
                                                style={{ background: "var(--bg-base)", border: "1px solid var(--accent-border)" }}>
                                                <div className="flex items-center justify-between gap-3">
                                                  <div>
                                                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                                      {fmtWeekRange(wr.weekStartDate, wr.weekEndDate)}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className="text-xs tabular-nums" style={{ color: "var(--accent)" }}>{fmt(wr.totalViews)} views</span>
                                                    {wr.paidOut > 0 && <span className="text-xs tabular-nums" style={{ color: "var(--success)" }}>{fmtCurrency(wr.paidOut)}</span>}
                                                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{wr.clipsApproved}/{wr.clipsSubmitted} clips</span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              /* ── SINGLE CLIENT VIEW ───────────────────────────────── */
              (() => {
                function scrollToWeekReport(id: string) {
                  const monthKey = campaignReports.find((r) => r.id === id)?.weekEndDate.slice(0, 7);
                  if (monthKey) setExpandedMonths((s) => { const n = new Set(s); n.add(monthKey); return n; });
                  setExpandedWeekReportId(id);
                  setHighlightedWeekId(id);
                  setTimeout(() => {
                    weekReportRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => setHighlightedWeekId(null), 1800);
                  }, 80);
                }
                function fmtMonthLabel(key: string) {
                  const [y, m] = key.split("-").map(Number);
                  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                }
                function dayName(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }); }
                function fmtDay(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
                function toggleMonth(k: string) { setExpandedMonths((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }

                const latestWeekly = campaignReports[0];
                const totalApproved = ongoingReports.reduce((s, r) => s + r.approved, 0);
                const totalSubmissions = ongoingReports.reduce((s, r) => s + r.totalSubmissions, 0);

                const monthMap = new Map<string, OngoingReport[]>();
                for (const r of ongoingReports) {
                  const key = r.date.slice(0, 7);
                  if (!monthMap.has(key)) monthMap.set(key, []);
                  monthMap.get(key)!.push(r);
                }
                const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

                const weekByMonth = new Map<string, CampaignReport[]>();
                for (const wr of campaignReports) {
                  const mk = wr.weekEndDate.slice(0, 7);
                  if (!weekByMonth.has(mk)) weekByMonth.set(mk, []);
                  weekByMonth.get(mk)!.push(wr);
                }

                return (
                  <>
                    {/* Latest weekly banner */}
                    {latestWeekly && (
                      <div className="mb-5 rounded-xl px-4 py-3.5 flex items-center gap-4"
                        style={{ background: "linear-gradient(135deg, rgba(61,255,162,0.07) 0%, rgba(61,255,162,0.03) 100%)", border: "1px solid var(--accent-border)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                          <CalendarDays size={15} style={{ color: "var(--accent)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)", fontSize: 10, letterSpacing: "0.07em" }}>End of Week Report</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-muted)", color: "var(--accent)", fontSize: 10 }}>New</span>
                          </div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmtWeekRange(latestWeekly.weekStartDate, latestWeekly.weekEndDate)}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmt(latestWeekly.totalViews)} views</span>
                            {latestWeekly.paidOut > 0 && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>· {fmtCurrency(latestWeekly.paidOut)} paid out</span>}
                            {latestWeekly.clipsApproved > 0 && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>· {latestWeekly.clipsApproved} clips approved</span>}
                          </div>
                        </div>
                        <button onClick={() => scrollToWeekReport(latestWeekly.id)}
                          className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium"
                          style={{ background: "var(--accent-solid)", color: "var(--text-on-accent)" }}>
                          View Report
                        </button>
                      </div>
                    )}

                    {/* Campaign Tracker card */}
                    <div style={card} className="p-5 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                          <Activity size={15} style={{ color: "var(--accent)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Live Campaign Tracker</p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            All clips, live performance stats, platform breakdown, real-time views, CPM, and exact payout — updated continuously.
                          </p>
                          {selectedClient?.campaignTrackerUrl ? (
                            <a href={selectedClient.campaignTrackerUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
                              style={{ background: "var(--accent-solid)", color: "var(--text-on-accent)", textDecoration: "none" }}>
                              <ExternalLink size={12} /> Open Live Tracker
                            </a>
                          ) : (
                            <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>Set tracker URL in client settings.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reports section */}
                    {ongoingReports.length === 0 && campaignReports.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl py-16" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                        <Activity size={28} style={{ color: "var(--text-tertiary)", opacity: 0.4, marginBottom: 12 }} />
                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No reports yet</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Campaign reports will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary cards */}
                        {(() => {
                          const totalPaidOut = campaignReports.reduce((s, r) => s + (r.paidOut ?? 0), 0);
                          const totalBudget = ((selectedClient?.campaigns ?? []) as {totalBudget: number}[]).reduce((s, c) => s + (c.totalBudget ?? 0), 0);
                          return (
                            <>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                  { label: "Total Reports",  value: ongoingReports.length.toString(),       sub: "all time",      color: "var(--text-primary)", Icon: FileText },
                                  { label: "Clips Approved", value: totalApproved.toLocaleString(),          sub: `of ${totalSubmissions.toLocaleString()} submitted`, color: "var(--success)", Icon: CheckCircle },
                                  { label: "Total Views",    value: fmt(ongoingReports[0]?.viewsTotal ?? 0), sub: "running total", color: "var(--accent)", Icon: Eye },
                                  { label: "Total Paid Out", value: fmtCurrency(totalPaidOut),               sub: totalBudget > 0 ? `of ${fmtCurrency(totalBudget)} budget` : "to date", color: "var(--success)", Icon: DollarSign },
                                ].map((s) => (
                                  <div key={s.label} style={card} className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <s.Icon size={12} style={{ color: s.color, opacity: 0.7 }} />
                                      <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 11, letterSpacing: "0.06em" }}>{s.label}</p>
                                    </div>
                                    <p className="text-2xl font-semibold tabular-nums mb-0.5" style={{ color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</p>
                                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.sub}</p>
                                  </div>
                                ))}
                              </div>
                              {totalBudget > 0 && (
                                <div style={card} className="p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Wallet size={13} style={{ color: "var(--danger)", opacity: 0.8 }} />
                                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Budget Usage</p>
                                    <span className="ml-auto text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                      {fmtCurrency(totalPaidOut)} <span style={{ color: "var(--text-tertiary)" }}>/ {fmtCurrency(totalBudget)}</span>
                                    </span>
                                  </div>
                                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                                    <div className="paid-bar h-full rounded-full" style={{ width: `${Math.min(100, (totalPaidOut / totalBudget) * 100)}%`, background: "var(--danger)", boxShadow: "0 0 8px rgba(255,59,59,0.6)", transition: "width 0.6s ease" }} />
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{Math.round((totalPaidOut / totalBudget) * 100)}% used</p>
                                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{fmtCurrency(Math.max(0, totalBudget - totalPaidOut))} remaining</p>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Daily views chart */}
                        {cpmChartData.length > 1 && (
                          <div style={card} className="p-5">
                            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Daily Views Over Time</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <AreaChart data={cpmChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                <defs>
                                  <linearGradient id="agCpmGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.6} />
                                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => fmtDate(v)} />
                                <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} width={44} />
                                <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "var(--text-primary)" }} />
                                <Area name="Views" type="linear" dataKey="views" stroke="var(--accent)" strokeWidth={1.5} fill="url(#agCpmGrad)" dot={false} activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Month-grouped reports */}
                        {months.length > 0 && (
                          <div className="space-y-2">
                            {months.map((monthKey) => {
                              const monthReports = monthMap.get(monthKey)!;
                              const monthWeekReports = weekByMonth.get(monthKey) ?? [];
                              const isOpen = expandedMonths.has(monthKey);
                              const mApproved = monthReports.reduce((s, r) => s + r.approved, 0);

                              const sortedDailyRows = [...monthReports].sort((a, b) => b.date.localeCompare(a.date));
                              const sortedWeeklyRows = [...monthWeekReports].sort((a, b) => b.weekEndDate.localeCompare(a.weekEndDate));

                              return (
                                <div key={monthKey} style={{ ...card, overflow: "hidden", padding: 0 }}>
                                  <button
                                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                                    style={{ background: "transparent" }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                                    onClick={() => toggleMonth(monthKey)}
                                  >
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                                      style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                                      <Activity size={13} style={{ color: "var(--accent)" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmtMonthLabel(monthKey)}</p>
                                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                        {monthReports.length} daily report{monthReports.length !== 1 ? "s" : ""}
                                        {monthWeekReports.length > 0 && ` · ${monthWeekReports.length} week summar${monthWeekReports.length !== 1 ? "ies" : "y"}`}
                                      </p>
                                    </div>
                                    <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                                      <div className="text-right">
                                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Approved</p>
                                        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--success)" }}>{mApproved.toLocaleString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0 ml-2 transition-transform duration-200"
                                      style={{ transform: isOpen ? "rotate(180deg)" : "none", color: "var(--text-tertiary)" }}>
                                      <ChevronDown size={15} />
                                    </div>
                                  </button>

                                  {isOpen && (
                                    <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                      {/* Two-column: daily left, weekly right */}
                                      <div className="grid grid-cols-2 gap-3">
                                        {/* Left — Daily / Ongoing */}
                                        <div className="space-y-1.5">
                                          <p className="text-xs font-semibold uppercase tracking-widest px-1 pt-1"
                                            style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>
                                            Daily Reports
                                          </p>
                                          {sortedDailyRows.length === 0 && (
                                            <p className="text-xs px-2 py-3" style={{ color: "var(--text-tertiary)" }}>No daily reports</p>
                                          )}
                                          {sortedDailyRows.map((report) => {
                                            const isExpanded = expandedReportId === report.id;
                                            const globalIdx = ongoingReports.indexOf(report);
                                            const prevReport = globalIdx >= 0 && globalIdx + 1 < ongoingReports.length ? ongoingReports[globalIdx + 1] : null;
                                            const viewsTodayChange = prevReport && prevReport.viewsToday > 0
                                              ? Math.round(((report.viewsToday - prevReport.viewsToday) / prevReport.viewsToday) * 100)
                                              : null;
                                            const changeColor = viewsTodayChange === null ? "var(--text-tertiary)" : viewsTodayChange >= 0 ? "var(--success)" : "var(--danger)";
                                            return (
                                              <div key={report.id} className="rounded-lg overflow-hidden"
                                                style={{ background: "var(--bg-base)", border: `1px solid ${isExpanded ? "var(--accent-border)" : "var(--border-subtle)"}`, transition: "border-color 120ms ease" }}>
                                                <button
                                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                                                  style={{ background: "transparent" }}
                                                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
                                                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                                                  onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                                >
                                                  <div className="w-0.5 self-stretch flex-shrink-0 rounded-full" style={{ background: "var(--accent-border)" }} />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmtDay(report.date)}</span>
                                                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-active)", color: "var(--text-tertiary)", fontSize: 10 }}>{dayName(report.date)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                      <span className="text-xs" style={{ color: "var(--success)" }}>{report.approved} approved</span>
                                                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{fmt(report.viewsToday)} views
                                                        {viewsTodayChange !== null && (
                                                          <span className="ml-1 font-medium" style={{ color: changeColor }}>{viewsTodayChange >= 0 ? "+" : ""}{viewsTodayChange}%</span>
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <div className="flex-shrink-0 transition-transform duration-200"
                                                    style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "var(--text-tertiary)" }}>
                                                    <ChevronRight size={12} />
                                                  </div>
                                                </button>
                                                {isExpanded && (
                                                  <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      {[
                                                        { label: "Approved",     value: report.approved.toString(),  color: "var(--success)" },
                                                        { label: "Views Today",  value: fmt(report.viewsToday),      color: "var(--accent)" },
                                                        { label: "Views Total",  value: fmt(report.viewsTotal),      color: "var(--text-primary)" },
                                                        { label: "Views Change", value: viewsTodayChange !== null ? `${viewsTodayChange >= 0 ? "+" : ""}${viewsTodayChange}%` : "—", color: viewsTodayChange === null ? "var(--text-tertiary)" : viewsTodayChange >= 0 ? "var(--success)" : "var(--danger)" },
                                                      ].map((s) => (
                                                        <div key={s.label} className="rounded-lg p-2.5" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
                                                          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{s.label}</p>
                                                          <p className="text-base font-semibold tabular-nums" style={{ color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</p>
                                                        </div>
                                                      ))}
                                                    </div>
                                                    {[
                                                      { key: "mainTrend",        label: "Main Trend",         value: report.mainTrend,        border: "var(--accent-border)",  bg: "var(--accent-muted)",  color: "var(--accent)" },
                                                      { key: "mainOptimization", label: "Optimization Focus", value: report.mainOptimization, border: "rgba(245,185,74,0.3)",  bg: "var(--warning-bg)",    color: "var(--warning)" },
                                                      { key: "clipperFeedback",  label: "Clipper Feedback",   value: report.clipperFeedback,  border: "var(--border-default)", bg: "var(--bg-hover)",      color: "var(--text-secondary)" },
                                                    ].filter((s) => s.value).map((s) => (
                                                      <div key={s.key} className="rounded-lg p-3" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                                                        <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: s.color, fontSize: 10, letterSpacing: "0.07em" }}>{s.label}</p>
                                                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {/* Right — Weekly Summaries */}
                                        <div className="space-y-1.5">
                                          <p className="text-xs font-semibold uppercase tracking-widest px-1 pt-1"
                                            style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>
                                            Weekly Summaries
                                          </p>
                                          {sortedWeeklyRows.length === 0 && (
                                            <p className="text-xs px-2 py-3" style={{ color: "var(--text-tertiary)" }}>No weekly summaries</p>
                                          )}
                                          {sortedWeeklyRows.map((wr) => {
                                            const isExpanded = expandedWeekReportId === wr.id;
                                            const isHighlighted = highlightedWeekId === wr.id;
                                            return (
                                              <div key={`week-${wr.id}`}
                                                ref={(el) => { weekReportRefs.current[wr.id] = el; }}
                                                className="rounded-lg overflow-hidden"
                                                style={{ background: "var(--bg-base)", border: `1px solid ${isHighlighted ? "var(--accent)" : "var(--accent-border)"}`, transition: "border-color 400ms ease, box-shadow 400ms ease", boxShadow: isHighlighted ? "0 0 0 2px var(--accent-muted)" : "none" }}>
                                                <button
                                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
                                                  style={{ background: isHighlighted ? "var(--accent-muted)" : "transparent" }}
                                                  onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                                                  onMouseLeave={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                                  onClick={() => setExpandedWeekReportId(isExpanded ? null : wr.id)}
                                                >
                                                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                                    style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                                                    <CalendarDays size={10} style={{ color: "var(--accent)" }} />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                                      {fmtWeekRange(wr.weekStartDate, wr.weekEndDate)}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                      <span className="text-xs" style={{ color: "var(--accent)" }}>{fmt(wr.totalViews)} views</span>
                                                      {wr.paidOut > 0 && <span className="text-xs" style={{ color: "var(--success)" }}>{fmtCurrency(wr.paidOut)}</span>}
                                                    </div>
                                                  </div>
                                                  <div className="flex-shrink-0 transition-transform duration-200"
                                                    style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "var(--text-tertiary)" }}>
                                                    <ChevronRight size={12} />
                                                  </div>
                                                </button>
                                                {isExpanded && (
                                                  <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "1px solid var(--accent-border)" }}>
                                                    <div className="grid grid-cols-2 gap-2">
                                                      {[
                                                        { label: "Total Views", value: fmt(wr.totalViews),                                        color: "var(--accent)" },
                                                        { label: "Paid Out",    value: fmtCurrency(wr.paidOut),                                   color: "var(--success)" },
                                                        { label: "Clips",       value: `${wr.clipsApproved} / ${wr.clipsSubmitted}`,              color: "var(--text-primary)" },
                                                        { label: "Eff. CPM",    value: wr.effectiveCpm != null ? fmtCurrency(wr.effectiveCpm) : "—", color: "var(--text-secondary)" },
                                                      ].map((s) => (
                                                        <div key={s.label} className="rounded-lg p-2.5" style={{ background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
                                                          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{s.label}</p>
                                                          <p className="text-base font-semibold tabular-nums" style={{ color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</p>
                                                        </div>
                                                      ))}
                                                    </div>
                                                    {wr.totalViews > 0 && (() => {
                                                      const platforms = [
                                                        { label: "TikTok",    views: wr.tiktokViews,    color: "var(--accent)" },
                                                        { label: "Instagram", views: wr.instagramViews, color: "#FF8800" },
                                                        { label: "YouTube",   views: wr.youtubeViews,   color: "#CC1A1A" },
                                                        { label: "X",         views: wr.twitterViews,   color: "#5B9BD5" },
                                                      ].filter((p) => p.views > 0);
                                                      if (!platforms.length) return null;
                                                      return (
                                                        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                                                          <div className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-hover)" }}>
                                                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.07em" }}>Platforms</p>
                                                          </div>
                                                          <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                                                            {platforms.map((p) => (
                                                              <div key={p.label} className="flex items-center justify-between px-3 py-1.5">
                                                                <span className="text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
                                                                <div className="flex items-center gap-2">
                                                                  <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(p.views)}</span>
                                                                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{((p.views / wr.totalViews) * 100).toFixed(1)}%</span>
                                                                </div>
                                                              </div>
                                                            ))}
                                                          </div>
                                                        </div>
                                                      );
                                                    })()}
                                                    {[
                                                      { key: "weeklySummary",   label: "Weekly Summary",      value: wr.weeklySummary,   border: "var(--accent-border)",  bg: "var(--accent-muted)",        color: "var(--accent)" },
                                                      { key: "whatsWorking",    label: "What's Working",      value: wr.whatsWorking,    border: "rgba(61,214,140,0.3)",  bg: "var(--success-bg)",          color: "var(--success)" },
                                                      { key: "whatsNotWorking", label: "What's Not Working",  value: wr.whatsNotWorking, border: "rgba(255,59,59,0.2)",   bg: "rgba(255,59,59,0.06)",       color: "var(--danger)" },
                                                      { key: "nextWeekFocus",   label: "Next Week Focus",     value: wr.nextWeekFocus,   border: "rgba(245,185,74,0.3)",  bg: "var(--warning-bg)",          color: "var(--warning)" },
                                                    ].filter((s) => s.value).map((s) => (
                                                      <div key={s.key} className="rounded-lg p-3" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                                                        <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: s.color, fontSize: 10, letterSpacing: "0.07em" }}>{s.label}</p>
                                                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Clip Engagement ─────────────────────────────── */}
                    {(() => {
                      const clientClips = allClips.filter((c) => c.clientId === selectedClientId);
                      const totalViews    = clientClips.reduce((a: number, c: AnyRecord) => a + (c.views    ?? 0), 0);
                      const totalLikes    = clientClips.reduce((a: number, c: AnyRecord) => a + (c.likes    ?? 0), 0);
                      const totalComments = clientClips.reduce((a: number, c: AnyRecord) => a + (c.comments ?? 0), 0);
                      const totalShares   = clientClips.reduce((a: number, c: AnyRecord) => a + (c.shares   ?? 0), 0);
                      const totalSaves    = clientClips.reduce((a: number, c: AnyRecord) => a + (c.saves    ?? 0), 0);

                      const byDate: Record<string, number> = {};
                      clientClips.forEach((c: AnyRecord) => {
                        const d = (c.submittedAt as string).slice(0, 10);
                        byDate[d] = (byDate[d] ?? 0) + (c.views ?? 0);
                      });
                      const clipChartData = Object.entries(byDate)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, views]) => ({ date, views }));

                      const statItems = [
                        { label: "Views",    value: fmt(totalViews),               color: "var(--accent)",        icon: "👁" },
                        { label: "Likes",    value: fmt(totalLikes),               color: "var(--text-primary)",  icon: "♥" },
                        { label: "Comments", value: fmt(totalComments),            color: "var(--text-primary)",  icon: "💬" },
                        { label: "Shares",   value: fmt(totalShares),              color: "var(--text-primary)",  icon: "↗" },
                        { label: "Saves",    value: fmt(totalSaves),               color: "var(--text-primary)",  icon: "⬇" },
                        { label: "Clips",    value: clientClips.length.toString(), color: "var(--text-primary)",  icon: "▶" },
                      ];

                      return (
                        <div className="mt-6 space-y-4">
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                            Clip Engagement
                          </p>

                          {clientClips.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl py-12"
                              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                              <Activity size={24} style={{ color: "var(--text-tertiary)", opacity: 0.35, marginBottom: 10 }} />
                              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No clip data yet</p>
                              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Stats will populate as clips are submitted and approved.</p>
                            </div>
                          ) : (
                            <>
                              {/* Stat bar */}
                              <div style={{ ...card, overflow: "hidden", padding: 0 }}>
                                <div className="grid grid-cols-6">
                                  {statItems.map((s, i) => (
                                    <div key={s.label}
                                      className="flex flex-col items-center justify-center gap-1 px-3 py-4"
                                      style={{ borderRight: i < 5 ? "1px solid var(--border-subtle)" : "none" }}>
                                      <span className="text-sm leading-none mb-0.5" style={{ opacity: 0.5 }}>{s.icon}</span>
                                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
                                      <span className="text-lg font-semibold leading-none tabular-nums"
                                        style={{ color: s.color, fontFamily: "var(--font-display)" }}>
                                        {s.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Views over time chart */}
                              {clipChartData.length > 1 && (
                                <div style={card} className="p-5">
                                  <p className="text-sm font-semibold mb-4"
                                    style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                                    Views Over Time
                                  </p>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={clipChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                      <defs>
                                        <linearGradient id="agClipViewGrad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.6} />
                                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.04} />
                                        </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                      <XAxis dataKey="date" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                                        axisLine={false} tickLine={false} tickFormatter={(v: string) => fmtDate(v)} />
                                      <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                                        axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} width={44} />
                                      <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle}
                                        itemStyle={{ color: "var(--text-primary)" }} />
                                      <Area name="Views" type="linear" dataKey="views"
                                        stroke="var(--accent)" strokeWidth={1.5}
                                        fill="url(#agClipViewGrad)" dot={false}
                                        activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }} />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()
            )}
          </>}


        </div>
      </main>
    </div>
  );
}
