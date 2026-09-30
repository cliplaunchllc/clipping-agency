"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, BarChart2,
  Eye, DollarSign, Target, Wallet, CheckCircle, Scissors,
  Link2, Check, ThumbsUp, ThumbsDown, Rocket, AlignLeft, ExternalLink,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
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

function TrendIcon({ positive, neutral, size = 12 }: { positive: boolean; neutral: boolean; size?: number }) {
  if (neutral) return <Minus size={size} color="#8A93A6" />;
  if (positive) return <TrendingUp size={size} color="#3DFFA2" />;
  return <TrendingDown size={size} color="#FF3B3B" />;
}

function WowBadge({ curr, prev, inverted, grey }: {
  curr: number; prev: number | null | undefined; inverted?: boolean; grey?: boolean;
}) {
  const { pct, positive, neutral, firstWeek } = wow(curr, prev, inverted);

  if (firstWeek && !pct) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>First week</span>
  );
  if (firstWeek) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>First week</span>
  );

  if (grey) {
    const delta = prev != null ? curr - prev : 0;
    const sign = delta >= 0 ? "+" : "";
    return (
      <span className="text-xs flex items-center gap-1" style={{ color: "#8A93A6" }}>
        <Minus size={11} />{`${sign}${fmtCurrency(delta)}`}
      </span>
    );
  }

  const color = neutral ? "#8A93A6" : positive ? "#3DFFA2" : "#FF3B3B";
  return (
    <span className="text-xs flex items-center gap-1 font-medium" style={{ color }}>
      <TrendIcon positive={positive} neutral={neutral} />
      {pct}
    </span>
  );
}

// ─── Budget Bar ───────────────────────────────────────────────────────────────

function BudgetBar({ paidOut, budgetRemaining }: { paidOut: number; budgetRemaining: number }) {
  const total = paidOut + budgetRemaining;
  const paidPct = total > 0 ? Math.round((paidOut / total) * 100) : 0;

  return (
    <div className="rounded-lg p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign size={13} color={ICON_COLOR} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A93A6" }}>Budget Usage</span>
        </div>
        <span className="text-xs font-bold" style={{ color: "#FF3B3B" }}>{paidPct}% spent</span>
      </div>

      {/* Bar */}
      <div className="h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
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
          <p className="text-xs" style={{ color: "#8A93A6" }}>Paid out</p>
          <p className="text-sm font-bold" style={{ color: "#FF3B3B", fontFamily: "Space Grotesk, sans-serif" }}>{fmtCurrency(paidOut)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#8A93A6" }}>Remaining</p>
          <p className="text-sm font-bold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmtCurrency(budgetRemaining)}</p>
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
    color: PLATFORM_COLORS[p] ?? "#8A93A6",
  }));

  const emptySlice = [{
    name: "empty", value: 1, color: "rgba(255,255,255,0.07)",
    gradId: `pub-dg-${report.id}-empty`,
    grad: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.07)"] as [string, string],
  }];

  if (total === 0) return null;

  return (
    <div className="rounded-xl p-5" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 4px 20px rgba(0,0,0,0.5)" }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={13} color={ICON_COLOR} />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A93A6" }}>Platform Breakdown</p>
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
            <span className="text-sm font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(total)}</span>
            <span className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>views</span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5 min-w-0">
          {platforms.map((p) => {
            const val = platformData[p];
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            const color = PLATFORM_COLORS[p] ?? "#8A93A6";
            return (
              <div key={p}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PlatformIcon platform={p} size={12} />
                    <span className="text-xs font-medium truncate" style={{ color: "#F5F6FA" }}>{PLATFORM_LABELS[p] ?? p}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: "#8A93A6" }}>{fmt(val)}</span>
                    <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
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
      style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-xs font-medium leading-tight" style={{ color: "#8A93A6" }}>{label}</p>
      </div>
      <p className="text-xl font-bold mb-1 leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{value}</p>
      {sublabel && <p className="text-xs mb-1.5" style={{ color: "#8A93A6" }}>{sublabel}</p>}
      <WowBadge curr={curr} prev={prev} inverted={inverted} grey={grey} />
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report, prev }: { report: Report; prev: Report | null }) {
  const approvalRate = report.clipsSubmitted > 0
    ? (report.clipsApproved / report.clipsSubmitted) * 100 : null;
  const prevApprovalRate = prev && prev.clipsSubmitted > 0
    ? (prev.clipsApproved / prev.clipsSubmitted) * 100 : null;

  return (
    <div className="space-y-3">
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
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#FF3B3B", fontFamily: "Space Grotesk, sans-serif" }}>Live Campaign Tracker</p>
              <p className="text-xs mb-1" style={{ color: "#C8CDD8" }}>View all clips, live stats, platform breakdown & real-time performance</p>
              <p className="text-xs truncate" style={{ color: "#8A93A6" }}>{report.campaignLink}</p>
            </div>
          </div>
          <ExternalLink size={14} color="#FF3B3B" className="flex-shrink-0 ml-3 opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={<Eye size={13} color={ICON_COLOR} />} label="Views This Week" value={fmt(report.totalViews)} curr={report.totalViews} prev={prev?.totalViews ?? null} />
        <StatCard icon={<Target size={13} color={ICON_COLOR} />} label="Effective CPM" value={report.effectiveCpm != null ? fmtCurrency(report.effectiveCpm) : "—"} curr={report.effectiveCpm ?? 0} prev={prev?.effectiveCpm ?? null} inverted />
        <StatCard icon={<Wallet size={13} color={ICON_COLOR} />} label="Budget Remaining" value={report.budgetRemaining != null ? fmtCurrency(report.budgetRemaining) : "—"} curr={report.budgetRemaining ?? 0} prev={prev?.budgetRemaining ?? null} grey />
        <StatCard icon={<CheckCircle size={13} color={ICON_COLOR} />} label="Approval Rate" value={approvalRate != null ? `${approvalRate.toFixed(1)}%` : "—"} curr={approvalRate ?? 0} prev={prevApprovalRate} />
        <StatCard
          icon={<Scissors size={13} color={ICON_COLOR} />}
          label="Clips"
          value={`${report.clipsApproved} approved`}
          sublabel={`out of ${report.clipsSubmitted} submitted`}
          curr={report.clipsApproved}
          prev={prev?.clipsApproved ?? null}
        />
        <StatCard icon={<DollarSign size={13} color={ICON_COLOR} />} label="Paid Out" value={fmtCurrency(report.paidOut)} curr={report.paidOut} prev={prev?.paidOut ?? null} />
      </div>

      {/* Budget bar — only shown when budgetRemaining is set */}
      {report.budgetRemaining != null && (
        <BudgetBar paidOut={report.paidOut} budgetRemaining={report.budgetRemaining} />
      )}

      {/* Platform donut */}
      <DonutChart report={report} />

      {/* Narrative sections */}
      {(report.weeklySummary || report.whatsWorking || report.whatsNotWorking || report.nextWeekFocus) && (
        <div className="space-y-3">
          {report.weeklySummary && (
            <div className="rounded-lg p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft size={13} color="#8A93A6" />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A93A6", fontFamily: "Space Grotesk, sans-serif" }}>Weekly Overview</p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#C8CDD8" }}>{report.weeklySummary}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.whatsWorking && (
              <div className="rounded-lg p-4" style={{ background: "#05070D", border: "1px solid rgba(61,255,162,0.2)", boxShadow: "0 0 16px rgba(61,255,162,0.06)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp size={13} color="#3DFFA2" />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>What&apos;s Working</p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#C8CDD8" }}>{report.whatsWorking}</p>
              </div>
            )}
            {report.whatsNotWorking && (
              <div className="rounded-lg p-4" style={{ background: "#05070D", border: "1px solid rgba(255,59,59,0.2)", boxShadow: "0 0 16px rgba(255,59,59,0.06)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown size={13} color="#FF3B3B" />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FF3B3B", fontFamily: "Space Grotesk, sans-serif" }}>What&apos;s Not Working</p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#C8CDD8" }}>{report.whatsNotWorking}</p>
              </div>
            )}
          </div>
          {report.nextWeekFocus && (
            <div className="rounded-lg p-4" style={{ background: "#05070D", border: "1px solid rgba(255,136,0,0.25)", boxShadow: "0 0 16px rgba(255,136,0,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Rocket size={13} color="#FF8800" />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FF8800", fontFamily: "Space Grotesk, sans-serif" }}>Next Week&apos;s Focus</p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#C8CDD8" }}>{report.nextWeekFocus}</p>
            </div>
          )}
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
        color: copied ? "#3DFFA2" : "#FF3B3B",
        fontFamily: "Space Grotesk, sans-serif",
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

  return (
    <div className="min-h-screen" style={{ background: "#05070D", fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,7,13,0.92)", backdropFilter: "blur(16px)" }}
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
              <p className="text-sm font-bold truncate" style={{ color: "#F5F6FA", letterSpacing: "-0.01em" }}>{clientName}</p>
              <p className="text-xs" style={{ color: "#8A93A6" }}>Campaign Reports</p>
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
          <div
            className="flex flex-col items-center justify-center rounded-xl py-24"
            style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <BarChart2 size={36} style={{ color: "#FF3B3B", opacity: 0.35 }} className="mb-3" />
            <p className="text-sm" style={{ color: "#8A93A6" }}>No reports published yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium pb-2" style={{ color: "#4A5568" }}>
              {reports.length} {reports.length === 1 ? "report" : "reports"} · most recent first
            </p>
            {reports.map((report, idx) => {
              const expanded = expandedIds.has(report.id);
              return (
                <div
                  key={report.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "#0B0E17",
                    border: `1px solid ${expanded ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.06)"}`,
                    transition: "border-color 0.2s ease",
                  }}
                >
                  {/* Accordion header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    style={{ transition: "background 0.15s" }}
                    onClick={() => toggleExpand(report.id)}
                  >
                    <div>
                      <p className="text-sm font-bold mb-1" style={{ color: "#F5F6FA", letterSpacing: "-0.01em" }}>
                        {fmtWeek(report.weekStartDate, report.weekEndDate)}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs flex items-center gap-1" style={{ color: "#8A93A6" }}>
                          <Eye size={11} color={ICON_COLOR} />
                          {fmt(report.totalViews)} views
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "10px" }}>·</span>
                        <span className="text-xs flex items-center gap-1" style={{ color: "#8A93A6" }}>
                          <DollarSign size={11} color={ICON_COLOR} />
                          {fmtCurrency(report.paidOut)} paid
                        </span>
                        {report.budgetRemaining != null && (
                          <>
                            <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "10px" }}>·</span>
                            <span className="text-xs flex items-center gap-1" style={{ color: "#8A93A6" }}>
                              <Wallet size={11} color={ICON_COLOR} />
                              {fmtCurrency(report.budgetRemaining)} left
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className="flex-shrink-0"
                      style={{
                        color: "#8A93A6",
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.25s ease",
                      }}
                    >
                      <ChevronDown size={16} />
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expanded && (
                    <div className="px-5 pb-5">
                      <div className="h-px mb-4" style={{ background: "rgba(255,59,59,0.1)" }} />
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
