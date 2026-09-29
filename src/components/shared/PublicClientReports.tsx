"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, BarChart2 } from "lucide-react";

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

  if (firstWeek && !pct) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>First week</span>;
  if (firstWeek) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>First week</span>;

  if (grey) {
    const delta = prev != null ? curr - prev : 0;
    const sign = delta >= 0 ? "+" : "";
    return (
      <span className="text-xs flex items-center gap-1" style={{ color: "#8A93A6" }}>
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

function ReportCard({ report, prev }: { report: Report; prev: Report | null }) {
  const approvalRate = report.clipsSubmitted > 0
    ? (report.clipsApproved / report.clipsSubmitted) * 100
    : null;
  const prevApprovalRate = prev && prev.clipsSubmitted > 0
    ? (prev.clipsApproved / prev.clipsSubmitted) * 100
    : null;

  const platforms = [
    { label: "TikTok", key: "tiktokViews" as const, color: "#FF3B3B" },
    { label: "Instagram", key: "instagramViews" as const, color: "#FF8800" },
    { label: "YouTube", key: "youtubeViews" as const, color: "#CC1A1A" },
    { label: "X", key: "twitterViews" as const, color: "#5B9BD5" },
  ];

  const cards = [
    {
      label: "Views This Week",
      value: fmt(report.totalViews),
      curr: report.totalViews,
      prev: prev?.totalViews ?? null,
      lastWeek: prev ? fmt(prev.totalViews) : null,
    },
    {
      label: "Paid Out This Week",
      value: fmtCurrency(report.paidOut),
      curr: report.paidOut,
      prev: prev?.paidOut ?? null,
      lastWeek: prev ? fmtCurrency(prev.paidOut) : null,
    },
    {
      label: "Effective CPM This Week",
      value: report.effectiveCpm != null ? fmtCurrency(report.effectiveCpm) : "—",
      curr: report.effectiveCpm ?? 0,
      prev: prev?.effectiveCpm ?? null,
      lastWeek: prev?.effectiveCpm != null ? fmtCurrency(prev.effectiveCpm) : null,
      inverted: true,
    },
    {
      label: "Budget Remaining",
      value: report.budgetRemaining != null ? fmtCurrency(report.budgetRemaining) : "—",
      curr: report.budgetRemaining ?? 0,
      prev: prev?.budgetRemaining ?? null,
      lastWeek: prev?.budgetRemaining != null ? fmtCurrency(prev.budgetRemaining) : null,
      grey: true,
    },
    {
      label: "Approval Rate This Week",
      value: approvalRate != null ? `${approvalRate.toFixed(1)}%` : "—",
      curr: approvalRate ?? 0,
      prev: prevApprovalRate,
      lastWeek: prevApprovalRate != null ? `${prevApprovalRate.toFixed(1)}%` : null,
    },
    {
      label: "Clips This Week",
      value: `${report.clipsApproved} / ${report.clipsSubmitted}`,
      curr: report.clipsApproved,
      prev: prev?.clipsApproved ?? null,
      lastWeek: prev ? `${prev.clipsApproved} / ${prev.clipsSubmitted}` : null,
      sublabel: "approved / submitted",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-medium mb-2 leading-tight" style={{ color: "#8A93A6" }}>{c.label}</p>
            <p className="text-xl font-bold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{c.value}</p>
            {c.sublabel && <p className="text-xs mb-1" style={{ color: "#8A93A6" }}>{c.sublabel}</p>}
            <WowBadge curr={c.curr} prev={c.prev} inverted={c.inverted} grey={c.grey} />
            {c.lastWeek && (
              <p className="text-xs mt-1" style={{ color: "#4A5568" }}>Last week: {c.lastWeek}</p>
            )}
          </div>
        ))}
      </div>

      {report.totalViews > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#05070D" }}>
            <p className="text-xs font-semibold" style={{ color: "#8A93A6" }}>PLATFORM BREAKDOWN</p>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {["Platform", "Views This Week", "% of Total", "vs. Last Week"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs" style={{ color: "#8A93A6" }}>{h}</th>
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
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: "#F5F6FA" }}>{fmt(views)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "#8A93A6" }}>{pctOfTotal}%</td>
                    <td className="px-4 py-2.5">
                      {prevViews !== null ? (
                        <span className="text-xs flex items-center gap-1" style={{ color: neutral ? "#8A93A6" : positive ? "#3DFFA2" : "#FF3B3B" }}>
                          <TrendIcon positive={positive} neutral={neutral} />
                          {pct}
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>First week</span>
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
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  clientName: string;
  logoUrl: string | null;
  reports: Report[];
}

export default function PublicClientReports({ clientName, logoUrl, reports }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(reports.length > 0 ? [reports[0].id] : [])
  );

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

  return (
    <div className="min-h-screen" style={{ background: "#05070D" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0B0E17" }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={clientName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)" }}>
              <BarChart2 size={14} color="#FF3B3B" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{clientName}</p>
            <p className="text-xs" style={{ color: "#8A93A6" }}>Weekly Campaign Reports</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {reports.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-24"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <BarChart2 size={36} style={{ color: "#FF3B3B", opacity: 0.4 }} className="mb-3" />
            <p className="text-sm" style={{ color: "#8A93A6" }}>No reports published yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report, idx) => {
              const expanded = expandedIds.has(report.id);
              return (
                <div key={report.id} className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => toggleExpand(report.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: "#F5F6FA" }}>
                        {fmtWeek(report.weekStartDate, report.weekEndDate)}
                      </p>
                      <p className="text-xs" style={{ color: "#8A93A6" }}>
                        {fmt(report.totalViews)} views · {fmtCurrency(report.paidOut)} paid out
                      </p>
                    </div>
                    <div className="transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none", color: "#8A93A6" }}>
                      <ChevronDown size={16} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5">
                      <ReportCard report={report} prev={prevReport(idx)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
