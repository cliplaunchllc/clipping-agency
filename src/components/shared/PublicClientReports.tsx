"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, BarChart2,
  Eye, DollarSign, Target, Wallet, CheckCircle, Scissors,
  Link2, Check, ExternalLink,
} from "lucide-react";
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PlatformIcon, PLATFORM_COLORS, PLATFORM_LABELS } from "./PlatformIcon";

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_COLOR = "#FF3B3B";

const DONUT_GRADIENTS: Record<string, [string, string]> = {
  tiktok:    ["#FF7070", "#AA0000"],
  instagram: ["#FFCC55", "#CC3300"],
  youtube:   ["#FF6655", "#880000"],
  twitter:   ["#90C8F0", "#2A6DB0"],
  other:     ["#9CA3AF", "#4B5563"],
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  weeklySummary: string | null;
  whatsWorking: string | null;
  whatsNotWorking: string | null;
  nextWeekFocus: string | null;
  campaignLink: string | null;
  publishedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function TrendIcon({ positive, neutral, size = 9 }: { positive: boolean; neutral: boolean; size?: number }) {
  if (neutral) return <Minus size={size} color="#8A93A6" />;
  if (positive) return <TrendingUp size={size} color="#3DD68C" />;
  return <TrendingDown size={size} color="#FF3B3B" />;
}

function WowBadge({ curr, prev, inverted, grey }: {
  curr: number; prev: number | null | undefined; inverted?: boolean; grey?: boolean;
}) {
  const { pct, positive, neutral, firstWeek } = wow(curr, prev, inverted);

  if (firstWeek && !pct) return (
    <span className="label-mono px-2 py-0.5 rounded-full" style={{ background: "var(--border-subtle)", color: "var(--text-secondary)" }}>First week</span>
  );
  if (firstWeek) return (
    <span className="label-mono px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>First week</span>
  );

  if (grey) {
    const delta = prev != null ? curr - prev : 0;
    const sign = delta >= 0 ? "+" : "";
    return (
      <span className="label-mono flex items-center gap-0.5" style={{ color: "var(--text-secondary)" }}>
        <Minus size={9} />{`${sign}${fmtCurrency(delta)}`}
      </span>
    );
  }

  const color = neutral ? "var(--text-tertiary)" : positive ? "#3DD68C" : "#FF3B3B";
  return (
    <span className="label-mono flex items-center gap-0.5" style={{ color }}>
      <TrendIcon positive={positive} neutral={neutral} size={9} />
      {pct}
    </span>
  );
}

// ─── Budget Bar ───────────────────────────────────────────────────────────────

function BudgetBar({ paidOut, budgetRemaining }: { paidOut: number; budgetRemaining: number }) {
  const total = paidOut + budgetRemaining;
  const paidPct = total > 0 ? Math.round((paidOut / total) * 100) : 0;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign size={13} color={ICON_COLOR} />
          <span className="label-mono">Budget Usage</span>
        </div>
        <span className="label-mono" style={{ color: "var(--accent)" }}>{paidPct}% spent</span>
      </div>

      {/* Bar */}
      <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--border-subtle)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${paidPct}%`,
            background: "linear-gradient(90deg, #FF3B3B 0%, #FF6B3B 100%)",
            boxShadow: "0 0 8px rgba(255,59,59,0.4)",
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between">
        <div>
          <p className="label-mono">Paid out</p>
          <p className="metric-value text-sm" style={{ color: "var(--accent)" }}>{fmtCurrency(paidOut)}</p>
        </div>
        <div className="text-right">
          <p className="label-mono">Remaining</p>
          <p className="metric-value text-sm" style={{ color: "var(--success)" }}>{fmtCurrency(budgetRemaining)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Donut Chart (platform breakdown) ────────────────────────────────────────

function DonutChart({ report }: { report: Report }) {
  const platformData = {
    tiktok: report.tiktokViews,
    instagram: report.instagramViews,
    youtube: report.youtubeViews,
    twitter: report.twitterViews,
  };

  const platforms = (Object.keys(platformData) as Array<keyof typeof platformData>)
    .filter((p) => platformData[p] > 0)
    .sort((a, b) => platformData[b] - platformData[a]);

  const total = platforms.reduce((a, p) => a + platformData[p], 0);

  const pieData = platforms.map((p) => ({
    name: p,
    value: platformData[p],
    gradId: `pub-dg-${report.id}-${p}`,
    grad: DONUT_GRADIENTS[p] ?? (["#9CA3AF", "#4B5563"] as [string, string]),
    color: PLATFORM_COLORS[p] ?? "var(--text-tertiary)",
  }));

  const emptySlice = [{
    name: "empty", value: 1, color: "rgba(255,255,255,0.07)",
    gradId: `pub-dg-${report.id}-empty`,
    grad: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.07)"] as [string, string],
  }];

  if (total === 0) return null;

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 4px 20px rgba(0,0,0,0.5)" }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={13} color={ICON_COLOR} />
        <p className="label-mono">Platform Breakdown</p>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
          <PieChart width={120} height={120}>
            <defs>
              {(pieData.length > 0 ? pieData : emptySlice).map((entry) => (
                <linearGradient key={entry.gradId} id={entry.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.grad[0]} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.grad[1]} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={pieData.length > 0 ? pieData : emptySlice}
              cx={55} cy={55}
              innerRadius={36} outerRadius={52}
              dataKey="value"
              paddingAngle={pieData.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90} endAngle={-270}
            >
              {(pieData.length > 0 ? pieData : emptySlice).map((entry, i) => (
                <Cell key={i} fill={`url(#${entry.gradId})`} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="metric-value text-sm leading-none" style={{ color: "var(--text-primary)" }}>{fmt(total)}</span>
            <span className="label-mono mt-0.5">views</span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5 min-w-0">
          {platforms.map((p) => {
            const val = platformData[p];
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            const color = PLATFORM_COLORS[p] ?? "var(--text-tertiary)";
            return (
              <div key={p}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PlatformIcon platform={p} size={12} />
                    <span className="metric-sub truncate" style={{ color: "var(--text-primary)" }}>{PLATFORM_LABELS[p] ?? p}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="metric-sub">{fmt(val)}</span>
                    <span className="metric-sub font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sublabel, curr, prev, inverted, grey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  curr: number;
  prev: number | null | undefined;
  inverted?: boolean;
  grey?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 transition-colors duration-200"
      style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="label-mono leading-tight">{label}</p>
      </div>
      <p className="metric-value text-xl mb-1 leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sublabel && <p className="metric-sub mb-1.5">{sublabel}</p>}
      <WowBadge curr={curr} prev={prev} inverted={inverted} grey={grey} />
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report, prev, allReports = [] }: { report: Report; prev: Report | null; allReports?: Report[] }) {
  const approvalRate = report.clipsSubmitted > 0
    ? (report.clipsApproved / report.clipsSubmitted) * 100 : null;
  const prevApprovalRate = prev && prev.clipsSubmitted > 0
    ? (prev.clipsApproved / prev.clipsSubmitted) * 100 : null;

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
  const latestWithCum = allReports.find((r) => r.cumViews > 0);
  const allTime = latestWithCum ? {
    views: latestWithCum.cumViews,
    tiktok: latestWithCum.cumTiktokViews,
    instagram: latestWithCum.cumInstagramViews,
    youtube: latestWithCum.cumYoutubeViews,
    twitter: latestWithCum.cumTwitterViews,
    paidOut: latestWithCum.cumPaidOut,
    clipsApproved: latestWithCum.cumClipsApproved,
    clipsSubmitted: latestWithCum.cumClipsSubmitted,
  } : calcAllTime;
  const allTimeApprovalRate = allTime.clipsSubmitted > 0 ? (allTime.clipsApproved / allTime.clipsSubmitted) * 100 : null;
  const platformsAllTime = [
    { key: "tiktok" as const, label: "TikTok", value: allTime.tiktok },
    { key: "instagram" as const, label: "Instagram", value: allTime.instagram },
    { key: "youtube" as const, label: "YouTube", value: allTime.youtube },
    { key: "twitter" as const, label: "X", value: allTime.twitter },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-4">
      {/* Campaign link */}
      {report.campaignLink && (
        <a
          href={report.campaignLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full rounded-xl px-4 py-3 group"
          style={{
            background: "linear-gradient(135deg, rgba(255,59,59,0.1) 0%, rgba(255,59,59,0.04) 100%)",
            border: "1px solid rgba(255,59,59,0.2)",
            textDecoration: "none",
            transition: "border-color 0.2s, background 0.2s",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,59,59,0.15)" }}>
              <Link2 size={13} color="#FF3B3B" />
            </div>
            <div className="min-w-0">
              <p className="label-mono mb-0.5" style={{ color: "var(--accent)" }}>Live Campaign Tracker</p>
              <p className="metric-sub mb-1" style={{ color: "var(--text-primary)" }}>View all clips, live stats, platform breakdown & real-time performance</p>
              <p className="metric-sub truncate">{report.campaignLink}</p>
            </div>
          </div>
          <ExternalLink size={14} color="#FF3B3B" className="flex-shrink-0 ml-3 opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      )}

      {/* ── THIS WEEK ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="label-mono px-2 py-0.5 rounded-md" style={{ background: "rgba(61,255,162,0.08)", color: "var(--success)", border: "1px solid rgba(61,255,162,0.2)", fontSize: "0.62rem", letterSpacing: "0.08em" }}>THIS WEEK</span>
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard icon={<Eye size={13} color={ICON_COLOR} />} label="Views This Week" value={fmt(report.totalViews)} curr={report.totalViews} prev={prev?.totalViews ?? null} />
          <StatCard icon={<Target size={13} color={ICON_COLOR} />} label="Effective CPM" value={report.effectiveCpm != null ? fmtCurrency(report.effectiveCpm) : "—"} curr={report.effectiveCpm ?? 0} prev={prev?.effectiveCpm ?? null} inverted />
          <StatCard icon={<Wallet size={13} color={ICON_COLOR} />} label="Budget Remaining" value={report.budgetRemaining != null ? fmtCurrency(report.budgetRemaining) : "—"} curr={report.budgetRemaining ?? 0} prev={prev?.budgetRemaining ?? null} grey />
          <StatCard icon={<CheckCircle size={13} color={ICON_COLOR} />} label="Approval Rate" value={approvalRate != null ? `${approvalRate.toFixed(1)}%` : "—"} curr={approvalRate ?? 0} prev={prevApprovalRate} />
          <StatCard icon={<Scissors size={13} color="var(--text-secondary)" />} label="Clips Submitted" value={report.clipsSubmitted.toString()} curr={report.clipsSubmitted} prev={prev?.clipsSubmitted ?? null} />
          <StatCard icon={<CheckCircle size={13} color={ICON_COLOR} />} label="Clips Approved" value={report.clipsApproved.toString()} curr={report.clipsApproved} prev={prev?.clipsApproved ?? null} />
          <StatCard icon={<DollarSign size={13} color={ICON_COLOR} />} label="Paid Out" value={fmtCurrency(report.paidOut)} curr={report.paidOut} prev={prev?.paidOut ?? null} />
        </div>
      </div>

      {/* Budget bar */}
      {report.budgetRemaining != null && (
        <BudgetBar paidOut={report.paidOut} budgetRemaining={report.budgetRemaining} />
      )}

      {/* Platform donut */}
      <DonutChart report={report} />

      {/* ── ALL TIME TOTALS ─────────────────────────────────── */}
      {allReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="label-mono px-2 py-0.5 rounded-md" style={{ background: "rgba(138,147,166,0.1)", color: "var(--text-secondary)", border: "1px solid rgba(138,147,166,0.18)", fontSize: "0.62rem", letterSpacing: "0.08em" }}>ALL TIME TOTALS</span>
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { icon: <Eye size={13} color="#3DD68C" />, label: "Total Views", value: fmt(allTime.views) },
              { icon: <DollarSign size={13} color="#3DD68C" />, label: "Total Paid Out", value: fmtCurrency(allTime.paidOut) },
              { icon: <CheckCircle size={13} color="#3DD68C" />, label: "Approved Videos", value: allTime.clipsApproved.toString() },
              { icon: <Scissors size={13} color={ICON_COLOR} />, label: "Videos Submitted", value: allTime.clipsSubmitted.toString() },
              { icon: <Target size={13} color={ICON_COLOR} />, label: "All-Time Approval", value: allTimeApprovalRate != null ? `${allTimeApprovalRate.toFixed(1)}%` : "—" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl p-4" style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 mb-2">{c.icon}<p className="label-mono leading-tight">{c.label}</p></div>
                <p className="metric-value text-xl leading-none" style={{ color: "var(--text-primary)" }}>{c.value}</p>
              </div>
            ))}
          </div>
          {platformsAllTime.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "var(--bg-base)" }}>
                <p className="label-mono">Platform Views — All Time</p>
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${platformsAllTime.length}, 1fr)` }}>
                {platformsAllTime.map((p, i) => (
                  <div key={p.key} className="px-4 py-3" style={{ borderRight: i < platformsAllTime.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <PlatformIcon platform={p.key} size={11} />
                      <span className="label-mono" style={{ color: PLATFORM_COLORS[p.key] ?? "var(--text-secondary)" }}>{p.label}</span>
                    </div>
                    <p className="metric-value text-lg leading-none" style={{ color: "var(--text-primary)" }}>{fmt(p.value)}</p>
                    <p className="metric-sub mt-0.5">{allTime.views > 0 ? `${Math.round((p.value / allTime.views) * 100)}%` : "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NOTES ──────────────────────────────────────────────── */}
      {(report.weeklySummary || report.whatsWorking || report.whatsNotWorking || report.nextWeekFocus) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="label-mono px-2 py-0.5 rounded-md" style={{ background: "rgba(245,185,74,0.08)", color: "var(--warning)", border: "1px solid rgba(245,185,74,0.2)", fontSize: "0.62rem", letterSpacing: "0.08em" }}>NOTES</span>
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            {report.weeklySummary && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3" style={{ color: "var(--text-primary)" }}>{report.weeklySummary}</p>
            )}
            {(report.whatsWorking || report.whatsNotWorking || report.nextWeekFocus) && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                {report.whatsWorking && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--success)", fontWeight: 600 }}>Working: </span>{report.whatsWorking}</p>}
                {report.whatsNotWorking && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--accent)", fontWeight: 600 }}>Not working: </span>{report.whatsNotWorking}</p>}
                {report.nextWeekFocus && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--warning)", fontWeight: 600 }}>Next week: </span>{report.nextWeekFocus}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copy Link Button ─────────────────────────────────────────────────────────

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
      style={{
        background: copied
          ? "rgba(61,255,162,0.12)"
          : "linear-gradient(135deg, rgba(255,59,59,0.15) 0%, rgba(255,59,59,0.08) 100%)",
        border: `1px solid ${copied ? "rgba(61,255,162,0.35)" : "rgba(255,59,59,0.25)"}`,
        color: copied ? "#3DD68C" : "#FF3B3B",
        fontFamily: "var(--font-display)",
        transition: "all 0.2s ease",
        transform: copied ? "scale(0.97)" : "scale(1)",
      }}
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
      {copied ? "Copied!" : "Share link"}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  clientName: string;
  logoUrl: string | null;
  agencyLogoUrl: string | null;
  reports: Report[];
}

export default function PublicClientReports({ clientName, logoUrl, agencyLogoUrl, reports }: Props) {
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

  // All-time aggregates for summary (use stored cumulative from most recent if available)
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
  const allTime = latestWithCum
    ? { views: latestWithCum.cumViews, paidOut: latestWithCum.cumPaidOut, clipsApproved: latestWithCum.cumClipsApproved, clipsSubmitted: latestWithCum.cumClipsSubmitted }
    : calcAllTime;
  const latestCpm = reports.find((r) => r.effectiveCpm != null)?.effectiveCpm ?? null;
  const todayD2 = new Date();
  const daysSinceFri2 = (todayD2.getDay() - 5 + 7) % 7;
  const lastFri2 = new Date(todayD2);
  lastFri2.setDate(todayD2.getDate() - daysSinceFri2);
  const lastFriStr2 = lastFri2.toISOString().slice(0, 10);
  const budgetSinceFri2 = reports.filter((r) => r.weekEndDate.slice(0, 10) >= lastFriStr2).reduce((s, r) => s + r.paidOut, 0);

  // Chart data: sorted oldest-first, with WoW % per week
  const sortedForChart = [...reports].sort((a, b) => a.weekEndDate.localeCompare(b.weekEndDate));
  const chartData = sortedForChart.map((r, i) => {
    const prev = i > 0 ? sortedForChart[i - 1] : null;
    const pct = prev && prev.totalViews > 0 ? Math.round(((r.totalViews - prev.totalViews) / prev.totalViews) * 100) : null;
    return { date: r.weekEndDate.slice(0, 10), views: r.totalViews, pct };
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", fontFamily: "var(--font-display)" }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{ borderColor: "var(--border-subtle)", background: "rgba(5,7,13,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Agency logo */}
            {agencyLogoUrl ? (
              <img src={agencyLogoUrl} alt="Agency" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(255,59,59,0.2) 0%, rgba(255,59,59,0.08) 100%)", border: "1px solid rgba(255,59,59,0.25)" }}
              >
                <BarChart2 size={16} color="#FF3B3B" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{clientName}</p>
              <p className="label-mono">Campaign Reports</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Client logo (right side) */}
            {logoUrl && (
              <img src={logoUrl} alt={clientName} className="w-7 h-7 rounded-lg object-cover opacity-70" />
            )}
            <CopyLinkButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl py-24" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <BarChart2 size={36} style={{ color: "var(--accent)", opacity: 0.35 }} className="mb-3" />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No reports published yet.</p>
          </div>
        ) : (
          <>
            {/* All-time summary — 6 boxes matching agency dashboard */}
            {reports.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                  { icon: <Target size={13} color={ICON_COLOR} />, label: "Total Effective CPM", value: latestCpm != null ? fmtCurrency(latestCpm) : "—", sub: "latest week" },
                  { icon: <Scissors size={13} color="var(--text-secondary)" />, label: "Total Submissions", value: allTime.clipsSubmitted.toString(), sub: "all time" },
                  { icon: <CheckCircle size={13} color="#3DD68C" />, label: "Approved Videos", value: allTime.clipsApproved.toString(), sub: "all time" },
                  { icon: <Eye size={13} color="#3DD68C" />, label: "Approved Views", value: fmt(allTime.views), sub: "cumulative" },
                  { icon: <DollarSign size={13} color="#3DD68C" />, label: "Total Paid Out", value: fmtCurrency(allTime.paidOut), sub: "all time" },
                  { icon: <Wallet size={13} color="var(--warning)" />, label: "Budget Since Last Fri", value: fmtCurrency(budgetSinceFri2), sub: "this cycle" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <div className="flex items-center gap-1.5 mb-2">{s.icon}<p className="label-mono leading-tight" style={{ fontSize: "0.63rem" }}>{s.label}</p></div>
                    <p className="metric-value text-xl mb-0.5" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                    <p className="metric-sub" style={{ fontSize: "0.6rem" }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Week After Week Views chart */}
            {chartData.length > 1 && (
              <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Week After Week Views</p>
                  {(() => {
                    const latest = chartData[chartData.length - 1];
                    if (latest.pct == null) return null;
                    const positive = latest.pct >= 0;
                    return (
                      <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: positive ? "#3DD68C" : ICON_COLOR }}>
                        {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {positive ? "+" : ""}{latest.pct}% this week
                      </span>
                    );
                  })()}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 28, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="pubViewsGradRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF3B3B" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#FF3B3B" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }} />
                    <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                        return v.toString();
                      }} width={46} />
                    <Tooltip
                      formatter={(v, _name, item) => {
                        const pct = (item as { payload?: { pct: number | null } }).payload?.pct;
                        const n = Number(v ?? 0);
                        const vStr = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toString();
                        const lines: [string, string][] = [[vStr, "Views"]];
                        if (pct != null) lines.push([`${pct >= 0 ? "+" : ""}${pct}%`, "vs prev week"]);
                        return lines;
                      }}
                      contentStyle={{ background: "rgba(15,10,20,0.95)", border: "1px solid rgba(255,59,59,0.25)", borderRadius: 8 }}
                      labelStyle={{ color: "#8A93A6" }}
                      itemStyle={{ color: "#FF6B6B" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#FF3B3B"
                      strokeWidth={2}
                      fill="url(#pubViewsGradRed)"
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

            <p className="text-xs font-medium pb-3" style={{ color: "var(--text-tertiary)" }}>
              {reports.length} {reports.length === 1 ? "report" : "reports"} · most recent first
            </p>
            <div className="space-y-3">
              {reports.map((report, idx) => {
                const expanded = expandedIds.has(report.id);
                const prev = prevReport(idx);
                const viewsPct = prev && prev.totalViews > 0 ? Math.round(((report.totalViews - prev.totalViews) / prev.totalViews) * 100) : null;
                return (
                  <div key={report.id} className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${expanded ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.08)"}`, transition: "border-color 0.2s ease" }}>
                    <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => toggleExpand(report.id)}>
                      <div>
                        <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                          {fmtWeek(report.weekStartDate, report.weekEndDate)}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                            <Eye size={11} color={ICON_COLOR} />{fmt(report.totalViews)} views
                          </span>
                          <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "10px" }}>·</span>
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                            <DollarSign size={11} color={ICON_COLOR} />{fmtCurrency(report.paidOut)} paid
                          </span>
                          {viewsPct != null && (
                            <>
                              <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "10px" }}>·</span>
                              <span className="text-xs flex items-center gap-1 font-semibold" style={{ color: viewsPct >= 0 ? "#3DD68C" : ICON_COLOR }}>
                                {viewsPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {viewsPct >= 0 ? "+" : ""}{viewsPct}% views
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0" style={{ color: "var(--text-secondary)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
                        <ChevronDown size={16} />
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-5 pb-5">
                        <div className="h-px mb-4" style={{ background: "var(--accent-muted)" }} />
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
    </div>
  );
}
