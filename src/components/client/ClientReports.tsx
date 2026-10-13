"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, BarChart2, Eye, DollarSign, CheckCircle, Scissors, Target, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Report {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalViews: number;
  tiktokViews: number;
  instagramViews: number;
  youtubeViews: number;
  twitterViews: number;
  paidOut: number;
  effectiveCpm: number | null;
  budgetRemaining: number | null;
  clipsSubmitted: number;
  clipsApproved: number;
  cumViews: number;
  cumTiktokViews: number;
  cumInstagramViews: number;
  cumYoutubeViews: number;
  cumTwitterViews: number;
  cumPaidOut: number;
  cumClipsSubmitted: number;
  cumClipsApproved: number;
  cumEffectiveCpm: number | null;
  publishedAt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtWeek(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function wow(curr: number, prev: number | null | undefined, inverted = false) {
  if (prev === null || prev === undefined) return { pct: "", positive: true, neutral: true, firstWeek: true };
  if (prev === 0 && curr === 0) return { pct: "—", positive: true, neutral: true, firstWeek: false };
  if (prev === 0) return { pct: "First week", positive: !inverted, neutral: false, firstWeek: true };
  const raw = ((curr - prev) / prev) * 100;
  const rounded = Math.round(raw * 10) / 10;
  const neutral = Math.abs(rounded) < 0.5;
  const positive = inverted ? rounded <= 0 : rounded >= 0;
  const sign = rounded >= 0 ? "+" : "";
  return { pct: `${sign}${rounded.toFixed(1)}%`, positive, neutral, firstWeek: false };
}

function TrendIcon({ positive, neutral, size = 12 }: { positive: boolean; neutral: boolean; size?: number }) {
  if (neutral) return <Minus size={size} color="#8A93A6" />;
  if (positive) return <TrendingUp size={size} color="#3DFFA2" />;
  return <TrendingDown size={size} color="#FF3B3B" />;
}

function WowBadge({ curr, prev, inverted, grey }: {
  curr: number; prev: number | null | undefined; inverted?: boolean; grey?: boolean;
}) {
  const { pct, positive, neutral, firstWeek } = wow(curr, prev, inverted);

  if (firstWeek && !pct) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--border-subtle)", color: "var(--text-secondary)" }}>First week</span>;
  if (firstWeek) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.1)", color: "var(--success)" }}>First week</span>;

  if (grey) {
    const delta = prev != null ? curr - prev : 0;
    const sign = delta >= 0 ? "+" : "";
    return (
      <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
        <Minus size={11} />
        {`${sign}${fmtCurrency(delta)}`}
      </span>
    );
  }

  const color = neutral ? "#8A93A6" : positive ? "#3DFFA2" : "#FF3B3B";
  return (
    <span className="text-xs flex items-center gap-1" style={{ color }}>
      <TrendIcon positive={positive} neutral={neutral} />
      {pct}
    </span>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report, prev, allReports = [] }: { report: Report; prev: Report | null; allReports?: Report[] }) {
  const approvalRate = report.clipsSubmitted > 0
    ? (report.clipsApproved / report.clipsSubmitted) * 100
    : null;
  const prevApprovalRate = prev && prev.clipsSubmitted > 0
    ? (prev.clipsApproved / prev.clipsSubmitted) * 100
    : null;

  const platforms = [
    { label: "TikTok", key: "tiktokViews" as const, color: "var(--accent)" },
    { label: "Instagram", key: "instagramViews" as const, color: "#FF8800" },
    { label: "YouTube", key: "youtubeViews" as const, color: "#CC1A1A" },
    { label: "X", key: "twitterViews" as const, color: "#5B9BD5" },
  ];

  // All-time totals: use stored cumulative from most recent report if entered, else sum all reports
  const calcAllTime = allReports.reduce(
    (acc, r) => ({
      views: acc.views + r.totalViews,
      tiktok: acc.tiktok + r.tiktokViews,
      instagram: acc.instagram + r.instagramViews,
      youtube: acc.youtube + r.youtubeViews,
      twitter: acc.twitter + r.twitterViews,
      paidOut: acc.paidOut + r.paidOut,
      clipsApproved: acc.clipsApproved + r.clipsApproved,
      clipsSubmitted: acc.clipsSubmitted + r.clipsSubmitted,
    }),
    { views: 0, tiktok: 0, instagram: 0, youtube: 0, twitter: 0, paidOut: 0, clipsApproved: 0, clipsSubmitted: 0 }
  );
  // Platform views always auto-calc from weekly reports; only totals can be overridden
  const latestWithCum = allReports.find((r) => r.cumViews > 0);
  const allTime = {
    views: latestWithCum ? latestWithCum.cumViews : calcAllTime.views,
    tiktok: calcAllTime.tiktok,
    instagram: calcAllTime.instagram,
    youtube: calcAllTime.youtube,
    twitter: calcAllTime.twitter,
    paidOut: latestWithCum && latestWithCum.cumPaidOut > 0 ? latestWithCum.cumPaidOut : calcAllTime.paidOut,
    clipsApproved: latestWithCum && latestWithCum.cumClipsApproved > 0 ? latestWithCum.cumClipsApproved : calcAllTime.clipsApproved,
    clipsSubmitted: latestWithCum && latestWithCum.cumClipsSubmitted > 0 ? latestWithCum.cumClipsSubmitted : calcAllTime.clipsSubmitted,
  };
  const allTimeApprovalRate = allTime.clipsSubmitted > 0 ? (allTime.clipsApproved / allTime.clipsSubmitted) * 100 : null;
  const platformsAllTime = [
    { label: "TikTok", key: "tiktok" as const, color: "var(--accent)", value: allTime.tiktok },
    { label: "Instagram", key: "instagram" as const, color: "#FF8800", value: allTime.instagram },
    { label: "YouTube", key: "youtube" as const, color: "#CC1A1A", value: allTime.youtube },
    { label: "X", key: "twitter" as const, color: "#5B9BD5", value: allTime.twitter },
  ].filter((p) => p.value > 0);

  const weeklyCards = [
    { label: "Views This Week", value: fmt(report.totalViews), curr: report.totalViews, prev: prev?.totalViews ?? null, lastWeek: prev ? fmt(prev.totalViews) : null },
    { label: "Paid Out", value: fmtCurrency(report.paidOut), curr: report.paidOut, prev: prev?.paidOut ?? null, lastWeek: prev ? fmtCurrency(prev.paidOut) : null },
    { label: "Effective CPM", value: report.effectiveCpm != null ? fmtCurrency(report.effectiveCpm) : "—", curr: report.effectiveCpm ?? 0, prev: prev?.effectiveCpm ?? null, lastWeek: prev?.effectiveCpm != null ? fmtCurrency(prev.effectiveCpm) : null, inverted: true },
    { label: "Budget Remaining", value: report.budgetRemaining != null ? fmtCurrency(report.budgetRemaining) : "—", curr: report.budgetRemaining ?? 0, prev: prev?.budgetRemaining ?? null, lastWeek: prev?.budgetRemaining != null ? fmtCurrency(prev.budgetRemaining) : null, grey: true },
    { label: "Approval Rate", value: approvalRate != null ? `${approvalRate.toFixed(1)}%` : "—", curr: approvalRate ?? 0, prev: prevApprovalRate, lastWeek: prevApprovalRate != null ? `${prevApprovalRate.toFixed(1)}%` : null },
    { label: "Clips Submitted", value: report.clipsSubmitted.toString(), curr: report.clipsSubmitted, prev: prev?.clipsSubmitted ?? null, lastWeek: prev ? prev.clipsSubmitted.toString() : null },
    { label: "Clips Approved", value: report.clipsApproved.toString(), curr: report.clipsApproved, prev: prev?.clipsApproved ?? null, lastWeek: prev ? prev.clipsApproved.toString() : null },
  ];

  return (
    <div className="space-y-5">
      {/* ── THIS WEEK ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(61,255,162,0.1)", color: "var(--success)", border: "1px solid rgba(61,255,162,0.2)", letterSpacing: "0.07em" }}>THIS WEEK</span>
          <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {weeklyCards.map((c) => (
            <div key={c.label} className="rounded-xl p-4" style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-medium mb-2 leading-tight" style={{ color: "var(--text-secondary)" }}>{c.label}</p>
              <p className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{c.value}</p>
              <WowBadge curr={c.curr} prev={c.prev} inverted={"inverted" in c ? c.inverted : undefined} grey={"grey" in c ? c.grey : undefined} />
              {c.lastWeek && (
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Last week: {c.lastWeek}</p>
              )}
            </div>
          ))}
        </div>

        {/* Platform breakdown this week */}
        {report.totalViews > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "var(--bg-base)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>PLATFORM BREAKDOWN — THIS WEEK</p>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Platform", "Views", "% of Week", "vs. Last Week"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs" style={{ color: "var(--text-secondary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms.filter((p) => report[p.key] > 0).map((p) => {
                  const views = report[p.key];
                  const prevViews = prev ? prev[p.key] : null;
                  const pctOfTotal = ((views / report.totalViews) * 100).toFixed(1);
                  const { pct, positive, neutral } = wow(views, prevViews);
                  return (
                    <tr key={p.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: p.color }}>{p.label}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(views)}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>{pctOfTotal}%</td>
                      <td className="px-4 py-2.5">
                        {prevViews !== null ? (
                          <span className="text-xs flex items-center gap-1" style={{ color: neutral ? "var(--text-tertiary)" : positive ? "var(--success)" : "var(--danger)" }}>
                            <TrendIcon positive={positive} neutral={neutral} />
                            {pct}
                          </span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--border-subtle)", color: "var(--text-secondary)" }}>First week</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── ALL TIME TOTALS ────────────────────────────── */}
      {allReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(138,147,166,0.12)", color: "var(--text-secondary)", border: "1px solid rgba(138,147,166,0.2)", letterSpacing: "0.07em" }}>ALL TIME TOTALS</span>
            <span className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { label: "Total Views (cumulative)", value: fmt(allTime.views) },
              { label: "Total Paid Out", value: fmtCurrency(allTime.paidOut) },
              { label: "Approved Videos", value: allTime.clipsApproved.toString() },
              { label: "Videos Submitted", value: allTime.clipsSubmitted.toString() },
              { label: "All-Time Approval Rate", value: allTimeApprovalRate != null ? `${allTimeApprovalRate.toFixed(1)}%` : "—" },
              { label: "Effective CPM", value: (() => { const cpm = report.cumEffectiveCpm ?? report.effectiveCpm ?? allReports.find((r) => r.cumEffectiveCpm != null)?.cumEffectiveCpm ?? allReports.find((r) => r.effectiveCpm != null)?.effectiveCpm ?? null; return cpm != null ? fmtCurrency(cpm) : "—"; })() },
              ...(report.budgetRemaining != null ? [{ label: "Budget Remaining", value: fmtCurrency(report.budgetRemaining) }] : []),
            ].map((c) => (
              <div key={c.label} className="rounded-xl p-4" style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-xs font-medium mb-2 leading-tight" style={{ color: "var(--text-secondary)" }}>{c.label}</p>
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{c.value}</p>
              </div>
            ))}
          </div>
          {/* Platform totals all time */}
          {platformsAllTime.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "var(--bg-base)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>PLATFORM VIEWS — ALL TIME</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                {platformsAllTime.map((p, i) => (
                  <div key={p.key} className="px-4 py-3" style={{ borderRight: i < platformsAllTime.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: p.color }}>{p.label}</p>
                    <p className="text-lg font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(p.value)}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{allTime.views > 0 ? `${Math.round((p.value / allTime.views) * 100)}%` : "—"} of total</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientReports({ reports, clientName }: { reports: Report[]; clientName: string }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(reports.length > 0 ? [reports[0].id] : []));

  function toggleExpand(id: string) {
    setExpandedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function prevReport(idx: number): Report | null {
    return idx < reports.length - 1 ? reports[idx + 1] : null;
  }

  // All-time aggregates (use stored cumulative from most recent report if available)
  const calcAllTime = reports.reduce(
    (acc, r) => ({
      views: acc.views + r.totalViews,
      paidOut: acc.paidOut + r.paidOut,
      clipsApproved: acc.clipsApproved + r.clipsApproved,
      clipsSubmitted: acc.clipsSubmitted + r.clipsSubmitted,
    }),
    { views: 0, paidOut: 0, clipsApproved: 0, clipsSubmitted: 0 }
  );
  const latestWithCum = reports.find((r) => r.cumViews > 0);
  const allTime = {
    views: latestWithCum ? latestWithCum.cumViews : calcAllTime.views,
    paidOut: latestWithCum && latestWithCum.cumPaidOut > 0 ? latestWithCum.cumPaidOut : calcAllTime.paidOut,
    clipsApproved: latestWithCum && latestWithCum.cumClipsApproved > 0 ? latestWithCum.cumClipsApproved : calcAllTime.clipsApproved,
    clipsSubmitted: latestWithCum && latestWithCum.cumClipsSubmitted > 0 ? latestWithCum.cumClipsSubmitted : calcAllTime.clipsSubmitted,
  };
  // Latest CPM: prefer cumEffectiveCpm, then effectiveCpm from most recent report
  const latestCpm = reports.find((r) => r.cumEffectiveCpm != null)?.cumEffectiveCpm ?? reports.find((r) => r.effectiveCpm != null)?.effectiveCpm ?? null;
  // Budget since last Friday
  const todayD = new Date();
  const daysSinceFri = (todayD.getDay() - 5 + 7) % 7;
  const lastFri = new Date(todayD);
  lastFri.setDate(todayD.getDate() - daysSinceFri);
  const lastFriStr = lastFri.toISOString().slice(0, 10);
  const budgetSinceFri = reports.filter((r) => r.weekEndDate.slice(0, 10) >= lastFriStr).reduce((s, r) => s + r.paidOut, 0);

  // Chart data for views over time with % change
  const sortedForChart = [...reports].sort((a, b) => a.weekEndDate.localeCompare(b.weekEndDate));
  const chartData = sortedForChart.map((r, i) => {
    const prev = i > 0 ? sortedForChart[i - 1] : null;
    const pct = prev && prev.totalViews > 0 ? Math.round(((r.totalViews - prev.totalViews) / prev.totalViews) * 100) : null;
    return { date: r.weekEndDate.slice(0, 10), views: r.totalViews, pct };
  });

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
        Weekly Reports
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>{clientName}</p>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl py-24" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <BarChart2 size={36} style={{ color: "var(--text-tertiary)", opacity: 0.4 }} className="mb-3" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No reports published yet.</p>
        </div>
      ) : (
        <>
          {/* All-time summary stats — 6 boxes matching agency view */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: "Total Effective CPM", value: latestCpm != null ? fmtCurrency(latestCpm) : "—", sub: "latest week", icon: <Target size={13} color="var(--accent)" /> },
              { label: "Total Submissions", value: allTime.clipsSubmitted.toString(), sub: "all time", icon: <Scissors size={13} color="var(--text-secondary)" /> },
              { label: "Approved Videos", value: allTime.clipsApproved.toString(), sub: "all time", icon: <CheckCircle size={13} color="#3DD68C" /> },
              { label: "Approved Views", value: fmt(allTime.views), sub: "cumulative", icon: <Eye size={13} color="#3DD68C" /> },
              { label: "Total Paid Out", value: fmtCurrency(allTime.paidOut), sub: "all time", icon: <DollarSign size={13} color="#3DD68C" /> },
              { label: "Budget Since Last Fri", value: fmtCurrency(budgetSinceFri), sub: "this cycle", icon: <Wallet size={13} color="var(--warning)" /> },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="flex items-center gap-1.5 mb-2">{s.icon}<p className="text-xs font-medium leading-tight" style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>{s.label}</p></div>
                <p className="text-xl font-bold mb-0.5" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{s.value}</p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)", fontSize: "0.62rem" }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Week After Week Views chart */}
          {chartData.length > 1 && (
            <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Week After Week Views</p>
                {(() => {
                  const latest = chartData[chartData.length - 1];
                  if (latest.pct == null) return null;
                  const positive = latest.pct >= 0;
                  return (
                    <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: positive ? "var(--success)" : "#FF3B3B" }}>
                      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {positive ? "+" : ""}{latest.pct}% this week
                    </span>
                  );
                })()}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 28, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="clientViewsGradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF3B3B" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#FF3B3B" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }} />
                  <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => fmt(v)} width={46} />
                  <Tooltip
                    formatter={(v, _name, item) => {
                      const pct = (item as { payload?: { pct: number | null } }).payload?.pct;
                      const lines: [string, string][] = [[fmt(Number(v ?? 0)), "Views"]];
                      if (pct != null) lines.push([`${pct >= 0 ? "+" : ""}${pct}%`, "vs prev week"]);
                      return lines;
                    }}
                    contentStyle={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,59,59,0.2)", borderRadius: 8 }}
                    labelStyle={{ color: "#8A93A6" }}
                    itemStyle={{ color: "#FF6B6B" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#FF3B3B"
                    strokeWidth={2}
                    fill="url(#clientViewsGradRed)"
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const positive = (payload.pct ?? 0) >= 0;
                      const labelColor = payload.pct == null ? "#8A93A6" : positive ? "#3DD68C" : "#FF3B3B";
                      return (
                        <g key={index}>
                          <circle cx={cx} cy={cy} r={3.5} fill="#FF3B3B" strokeWidth={0} />
                          {payload.pct != null && (
                            <text x={cx} y={cy - 12} textAnchor="middle" fill={labelColor} fontSize={9} fontWeight="700">
                              {positive ? "+" : ""}{payload.pct}%
                            </text>
                          )}
                        </g>
                      );
                    }}
                    activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual weekly reports */}
          <div className="space-y-3">
            {reports.map((report, idx) => {
              const expanded = expandedIds.has(report.id);
              const prev = prevReport(idx);
              // WoW views % for header
              const viewsPct = prev && prev.totalViews > 0 ? Math.round(((report.totalViews - prev.totalViews) / prev.totalViews) * 100) : null;
              return (
                <div key={report.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => toggleExpand(report.id)}>
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                        {fmtWeek(report.weekStartDate, report.weekEndDate)}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {fmt(report.totalViews)} views · {fmtCurrency(report.paidOut)} paid out
                        </span>
                        {viewsPct != null && (
                          <span className="text-xs flex items-center gap-0.5 font-semibold" style={{ color: viewsPct >= 0 ? "var(--success)" : "#FF3B3B" }}>
                            {viewsPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {viewsPct >= 0 ? "+" : ""}{viewsPct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none", color: "var(--text-secondary)" }}>
                      <ChevronDown size={16} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5">
                      <ReportCard report={report} prev={prev} allReports={reports} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
