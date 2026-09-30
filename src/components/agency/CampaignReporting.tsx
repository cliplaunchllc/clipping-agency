"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, X, Edit2, Trash2, Eye, EyeOff, TrendingUp, TrendingDown,
  Minus, BarChart2, ChevronDown, Link2, Check, ChevronLeft, ChevronRight,
  UserPlus, DollarSign, Target, Wallet, CheckCircle, Scissors,
  Folder, FolderOpen, AlertTriangle, ArrowLeft, Activity, Calendar,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { PlatformIcon, PLATFORM_COLORS, PLATFORM_LABELS } from "@/components/shared/PlatformIcon";

// ─── Color Constants ──────────────────────────────────────────────────────────

const WEEKLY_COLOR = "#3DFFA2";
const ONGOING_COLOR = "#7B9FF9";

const STATUS_META = {
  Strong: {
    label: "Strong",
    bg: "rgba(61,255,162,0.15)",
    text: "#3DFFA2",
    border: "rgba(61,255,162,0.3)",
  },
  Normal: {
    label: "Normal",
    bg: "rgba(138,147,166,0.1)",
    text: "#8A93A6",
    border: "rgba(138,147,166,0.2)",
  },
  NeedsAttention: {
    label: "Needs Attention",
    bg: "rgba(255,59,59,0.15)",
    text: "#FF3B3B",
    border: "rgba(255,59,59,0.3)",
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Report {
  id: string;
  clientId: string;
  client: { id: string; name: string; logoUrl: string | null };
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
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OngoingReport {
  id: string;
  clientId: string;
  client: { id: string; name: string; logoUrl: string | null };
  date: string;
  campaignName: string;
  totalSubmissions: number;
  pending: number;
  approved: number;
  rejected: number;
  mainTrend: string | null;
  clipperFeedback: string | null;
  mainOptimization: string | null;
  status: "Strong" | "Normal" | "NeedsAttention";
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  clientId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalViews: string;
  tiktokViews: string;
  instagramViews: string;
  youtubeViews: string;
  twitterViews: string;
  paidOut: string;
  effectiveCpm: string;
  budgetRemaining: string;
  clipsSubmitted: string;
  clipsApproved: string;
  weeklySummary: string;
  whatsWorking: string;
  whatsNotWorking: string;
  nextWeekFocus: string;
  campaignLink: string;
}

interface OngoingFormState {
  clientId: string;
  date: string;
  campaignName: string;
  totalSubmissions: string;
  pending: string;
  approved: string;
  rejected: string;
  mainTrend: string;
  clipperFeedback: string;
  mainOptimization: string;
  status: "Strong" | "Normal" | "NeedsAttention" | "";
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

function fmtDate(dateStr: string) {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dayOfWeekName(dateStr: string) {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function isMonOrWed(dateStr: string) {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 1 || dow === 3;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function wow(curr: number, prev: number | null | undefined, inverted = false): {
  pct: string; positive: boolean; neutral: boolean; firstWeek: boolean;
} {
  if (prev === null || prev === undefined) return { pct: "", positive: true, neutral: true, firstWeek: true };
  if (prev === 0 && curr === 0) return { pct: "—", positive: true, neutral: true, firstWeek: false };
  if (prev === 0) return { pct: "First", positive: !inverted, neutral: false, firstWeek: true };
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
  if (firstWeek && !pct) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>First</span>;
  if (firstWeek) return <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>First</span>;
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
    <span className="text-xs flex items-center gap-1" style={{ color }}>
      <TrendIcon positive={positive} neutral={neutral} />{pct}
    </span>
  );
}

function getMissingFlags(
  today: Date,
  clientOngoingReports: OngoingReport[],
  clientWeeklyReports: Report[]
): string[] {
  const flags: string[] = [];
  const dow = today.getDay();

  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + daysToMon);

  const thisWednesday = new Date(thisMonday);
  thisWednesday.setDate(thisMonday.getDate() + 2);

  if (dow >= 1 && dow <= 6) {
    const monStr = isoDate(thisMonday);
    const hasMonReport = clientOngoingReports.some((r) => r.date.slice(0, 10) === monStr);
    if (!hasMonReport) flags.push("Mon report missing");
  }

  if (dow >= 3 && dow <= 6) {
    const wedStr = isoDate(thisWednesday);
    const hasWedReport = clientOngoingReports.some((r) => r.date.slice(0, 10) === wedStr);
    if (!hasWedReport) flags.push("Wed report missing");
  }

  if (dow === 0 || dow === 6) {
    const lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - (dow === 6 ? 1 : 2));
    const lastFriStr = isoDate(lastFriday);
    const hasWeekly = clientWeeklyReports.some((r) => r.weekEndDate.slice(0, 10) === lastFriStr);
    if (!hasWeekly) flags.push("Weekly overdue");
  }

  return flags;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }: {
  status: "Strong" | "Normal" | "NeedsAttention";
  size?: "sm" | "xs";
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`font-semibold rounded-lg inline-flex items-center ${size === "xs" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs"}`}
      style={{ background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`, fontFamily: "Space Grotesk, sans-serif" }}
    >
      {meta.label}
    </span>
  );
}

// ─── CalendarPicker ───────────────────────────────────────────────────────────

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function CalendarPicker({ value, onChange, label, highlightDows }: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
  highlightDows?: number[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    onChange(isoDate(d));
    setOpen(false);
  }

  function isSelected(day: number) {
    if (!selected) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  }

  function isToday(day: number) {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  }

  function getDow(day: number) {
    return new Date(viewYear, viewMonth, day).getDay();
  }

  const displayValue = selected
    ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between"
        style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: displayValue ? "#F5F6FA" : "#4A5568" }}
      >
        <span>{displayValue || `Pick ${label}…`}</span>
        <ChevronDown size={13} color="#8A93A6" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl p-3 shadow-xl"
          style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)", minWidth: "260px" }}
        >
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/5">
              <ChevronLeft size={14} color="#8A93A6" />
            </button>
            <span className="text-xs font-semibold" style={{ color: "#F5F6FA" }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/5">
              <ChevronRight size={14} color="#8A93A6" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div key={d} className="text-center text-xs py-1" style={{
                color: highlightDows?.includes(i) ? ONGOING_COLOR : "#4A5568"
              }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              const isHL = day ? highlightDows?.includes(getDow(day)) : false;
              return (
                <div key={i} className="flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: isSelected(day) ? "#FF3B3B" : isToday(day) ? "rgba(255,59,59,0.12)" : isHL ? "rgba(123,159,249,0.1)" : "transparent",
                        color: isSelected(day) ? "#fff" : isToday(day) ? "#FF3B3B" : isHL ? ONGOING_COLOR : "#F5F6FA",
                      }}
                    >
                      {day}
                    </button>
                  ) : <div className="w-8 h-8" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NewClientModal ───────────────────────────────────────────────────────────

function NewClientModal({ onCreated, onClose }: {
  onCreated: (client: ClientOption) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/agency/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const client = await res.json();
      onCreated({ id: client.id, name: client.name, logoUrl: client.logoUrl ?? null });
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create client");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>New Client</h2>
          <button onClick={onClose}><X size={16} color="#8A93A6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Client name</label>
            <input
              autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}
            />
            {error && <p className="text-xs mt-1.5" style={{ color: "#FF3B3B" }}>{error}</p>}
          </div>
          <p className="text-xs" style={{ color: "#4A5568" }}>Login credentials can be added later from the Clients page.</p>
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "#FF3B3B", color: "#fff", opacity: saving || !name.trim() ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create Client"}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Donut + ReportPreview ────────────────────────────────────────────────────

const DONUT_GRADIENTS: Record<string, [string, string]> = {
  tiktok:    ["#FF7070", "#AA0000"],
  instagram: ["#FFCC55", "#CC3300"],
  youtube:   ["#FF6655", "#880000"],
  twitter:   ["#90C8F0", "#2A6DB0"],
  other:     ["#9CA3AF", "#4B5563"],
};

function ReportDonut({ report }: { report: Report }) {
  const platformData: Record<string, number> = {
    tiktok: report.tiktokViews,
    instagram: report.instagramViews,
    youtube: report.youtubeViews,
    twitter: report.twitterViews,
  };
  const platforms = (Object.keys(platformData) as string[])
    .filter((p) => platformData[p] > 0)
    .sort((a, b) => platformData[b] - platformData[a]);
  const total = platforms.reduce((a, p) => a + platformData[p], 0);
  if (total === 0) return null;

  const pieData = platforms.map((p) => ({
    name: p, value: platformData[p],
    gradId: `ag-dg-${report.id}-${p}`,
    grad: DONUT_GRADIENTS[p] ?? (["#9CA3AF", "#4B5563"] as [string, string]),
    color: PLATFORM_COLORS[p] ?? "#8A93A6",
  }));
  const emptySlice = [{ name: "empty", value: 1, color: "rgba(255,255,255,0.07)", gradId: `ag-dg-${report.id}-empty`, grad: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.07)"] as [string, string] }];

  return (
    <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#8A93A6" }}>Platform Breakdown</p>
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
          <PieChart width={110} height={110}>
            <defs>
              {(pieData.length > 0 ? pieData : emptySlice).map((e) => (
                <linearGradient key={e.gradId} id={e.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={e.grad[0]} stopOpacity={1} />
                  <stop offset="100%" stopColor={e.grad[1]} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <Pie data={pieData.length > 0 ? pieData : emptySlice} cx={50} cy={50} innerRadius={32} outerRadius={48} dataKey="value" paddingAngle={pieData.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
              {(pieData.length > 0 ? pieData : emptySlice).map((e, i) => (
                <Cell key={i} fill={`url(#${e.gradId})`} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(total)}</span>
            <span className="text-xs mt-0.5" style={{ color: "#8A93A6", fontSize: "0.65rem" }}>views</span>
          </div>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {platforms.map((p) => {
            const val = platformData[p];
            const pct = Math.round((val / total) * 100);
            const color = PLATFORM_COLORS[p] ?? "#8A93A6";
            return (
              <div key={p}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PlatformIcon platform={p} size={11} />
                    <span className="text-xs truncate" style={{ color: "#F5F6FA" }}>{PLATFORM_LABELS[p] ?? p}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs" style={{ color: "#8A93A6" }}>{fmt(val)}</span>
                    <span className="text-xs font-semibold w-7 text-right" style={{ color }}>{pct}%</span>
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

function ReportPreview({ report, prev }: { report: Report; prev: Report | null }) {
  const approvalRate = report.clipsSubmitted > 0 ? (report.clipsApproved / report.clipsSubmitted) * 100 : null;
  const prevApprovalRate = prev && prev.clipsSubmitted > 0 ? (prev.clipsApproved / prev.clipsSubmitted) * 100 : null;
  const statCards = [
    { icon: <Eye size={12} color="#3DFFA2" />, label: "Views This Week", value: fmt(report.totalViews), curr: report.totalViews, prev: prev?.totalViews ?? null, lastWeek: prev ? fmt(prev.totalViews) : null },
    { icon: <DollarSign size={12} color="#3DFFA2" />, label: "Paid Out", value: fmtCurrency(report.paidOut), curr: report.paidOut, prev: prev?.paidOut ?? null, lastWeek: prev ? fmtCurrency(prev.paidOut) : null },
    { icon: <Target size={12} color="#FF3B3B" />, label: "Effective CPM", value: report.effectiveCpm != null ? fmtCurrency(report.effectiveCpm) : "—", curr: report.effectiveCpm ?? 0, prev: prev?.effectiveCpm ?? null, lastWeek: prev?.effectiveCpm != null ? fmtCurrency(prev.effectiveCpm) : null, inverted: true },
    { icon: <Wallet size={12} color="#8A93A6" />, label: "Budget Remaining", value: report.budgetRemaining != null ? fmtCurrency(report.budgetRemaining) : "—", curr: report.budgetRemaining ?? 0, prev: prev?.budgetRemaining ?? null, lastWeek: prev?.budgetRemaining != null ? fmtCurrency(prev.budgetRemaining) : null, grey: true },
    { icon: <CheckCircle size={12} color="#3DFFA2" />, label: "Approval Rate", value: approvalRate != null ? `${approvalRate.toFixed(1)}%` : "—", curr: approvalRate ?? 0, prev: prevApprovalRate, lastWeek: prevApprovalRate != null ? `${prevApprovalRate.toFixed(1)}%` : null },
    { icon: <Scissors size={12} color="#FF3B3B" />, label: "Clips", value: `${report.clipsApproved} approved`, sublabel: `out of ${report.clipsSubmitted} submitted`, curr: report.clipsApproved, prev: prev?.clipsApproved ?? null, lastWeek: prev ? `${prev.clipsApproved} of ${prev.clipsSubmitted}` : null },
  ];

  return (
    <div className="rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
      <p className="text-xs font-medium mb-5" style={{ color: "#8A93A6" }}>{fmtWeek(report.weekStartDate, report.weekEndDate)}</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-2 mb-2">{c.icon}<p className="text-xs font-medium leading-tight" style={{ color: "#8A93A6" }}>{c.label}</p></div>
            <p className="text-xl font-bold mb-1 leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{c.value}</p>
            {c.sublabel && <p className="text-xs mb-1.5" style={{ color: "#8A93A6" }}>{c.sublabel}</p>}
            <WowBadge curr={c.curr} prev={c.prev} inverted={c.inverted} grey={c.grey} />
            {c.lastWeek && <p className="text-xs mt-1" style={{ color: "#4A5568" }}>Last week: {c.lastWeek}</p>}
          </div>
        ))}
      </div>
      <div className="mb-4"><ReportDonut report={report} /></div>
      {(report.weeklySummary || report.whatsWorking || report.whatsNotWorking || report.nextWeekFocus) && (
        <div className="space-y-3">
          {report.weeklySummary && (
            <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A93A6" }}>Weekly Summary</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#F5F6FA" }}>{report.weeklySummary}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {report.whatsWorking && (
              <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(61,255,162,0.12)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#3DFFA2" }}>What&apos;s Working</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#F5F6FA" }}>{report.whatsWorking}</p>
              </div>
            )}
            {report.whatsNotWorking && (
              <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,59,59,0.12)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF3B3B" }}>What&apos;s Not Working</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#F5F6FA" }}>{report.whatsNotWorking}</p>
              </div>
            )}
          </div>
          {report.nextWeekFocus && (
            <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,136,0,0.15)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#FF8800" }}>Next Week&apos;s Focus</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#F5F6FA" }}>{report.nextWeekFocus}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ongoing Report Detail ────────────────────────────────────────────────────

function OngoingReportDetail({ report, prev }: { report: OngoingReport; prev: OngoingReport | null }) {
  const approvalRate = report.totalSubmissions > 0 ? (report.approved / report.totalSubmissions) * 100 : null;
  const prevApprovalRate = prev && prev.totalSubmissions > 0 ? (prev.approved / prev.totalSubmissions) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={report.status} />
        <span className="text-sm" style={{ color: "#8A93A6" }}>
          {dayOfWeekName(report.date)} · {fmtDate(report.date)}
        </span>
      </div>
      {report.campaignName && (
        <p className="text-base font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{report.campaignName}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Submissions", value: report.totalSubmissions, prev: prev?.totalSubmissions ?? null, color: "#F5F6FA" },
          { label: "Approved", value: report.approved, prev: prev?.approved ?? null, color: "#3DFFA2" },
          { label: "Pending", value: report.pending, prev: prev?.pending ?? null, color: "#8A93A6" },
          { label: "Rejected", value: report.rejected, prev: prev?.rejected ?? null, color: "#FF3B3B" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>{c.label}</p>
            <p className="text-xl font-bold" style={{ color: c.color, fontFamily: "Space Grotesk, sans-serif" }}>{c.value}</p>
            <WowBadge curr={c.value} prev={c.prev} />
          </div>
        ))}
      </div>
      {approvalRate !== null && (
        <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
          <p className="text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Approval Rate</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{approvalRate.toFixed(1)}%</p>
            {prevApprovalRate !== null && <WowBadge curr={approvalRate} prev={prevApprovalRate} />}
          </div>
        </div>
      )}
      {[
        { key: "mainTrend", label: "Main Trend in Approved Clips", value: report.mainTrend, color: ONGOING_COLOR },
        { key: "clipperFeedback", label: "Clipper Feedback", value: report.clipperFeedback, color: "#8A93A6" },
        { key: "mainOptimization", label: "Main Optimization", value: report.mainOptimization, color: "#FF8800" },
      ].filter((s) => s.value).map((s) => (
        <div key={s.key} className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: s.color }}>{s.label}</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#F5F6FA" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly Report Form ───────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  clientId: "", weekStartDate: "", weekEndDate: "",
  totalViews: "", tiktokViews: "", instagramViews: "", youtubeViews: "", twitterViews: "",
  paidOut: "", effectiveCpm: "", budgetRemaining: "", clipsSubmitted: "", clipsApproved: "",
  weeklySummary: "", whatsWorking: "", whatsNotWorking: "", nextWeekFocus: "", campaignLink: "",
};

function WeeklyReportForm({
  clients, initial, onSave, onCancel, saving, onNewClient, referenceOngoing,
}: {
  clients: ClientOption[];
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  onNewClient: (currentForm: FormState) => void;
  referenceOngoing: OngoingReport[];
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [refOpen, setRefOpen] = useState(referenceOngoing.length > 0);

  function set(k: keyof FormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleStartDate(iso: string) {
    set("weekStartDate", iso);
    if (!form.weekEndDate) {
      const end = new Date(iso + "T00:00:00");
      end.setDate(end.getDate() + 6);
      set("weekEndDate", isoDate(end));
    }
  }

  const weekOngoing = referenceOngoing.filter((r) => {
    if (!form.weekStartDate || !form.weekEndDate) return true;
    const d = r.date.slice(0, 10);
    return d >= form.weekStartDate && d <= form.weekEndDate;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500/40";
  const inputStyle = { background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" };
  const labelStyle: React.CSSProperties = { color: "#8A93A6", fontSize: "0.75rem", fontWeight: 500, marginBottom: "4px", display: "block" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Reference panel */}
      {referenceOngoing.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid rgba(123,159,249,0.2)`, background: `rgba(123,159,249,0.04)` }}>
          <button
            type="button"
            onClick={() => setRefOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Activity size={13} color={ONGOING_COLOR} />
              <span className="text-xs font-semibold" style={{ color: ONGOING_COLOR }}>
                {weekOngoing.length} Ongoing Report{weekOngoing.length !== 1 ? "s" : ""} This Week
              </span>
            </div>
            <ChevronDown size={13} color={ONGOING_COLOR} style={{ transform: refOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          {refOpen && weekOngoing.length > 0 && (
            <div className="px-4 pb-4 space-y-3">
              {weekOngoing.map((r) => (
                <div key={r.id} className="rounded-lg p-3" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "#F5F6FA" }}>{dayOfWeekName(r.date)} · {fmtDate(r.date)}</span>
                    <StatusBadge status={r.status} size="xs" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <span className="text-xs" style={{ color: "#8A93A6" }}>Submitted: <strong style={{ color: "#F5F6FA" }}>{r.totalSubmissions}</strong></span>
                    <span className="text-xs" style={{ color: "#8A93A6" }}>Approved: <strong style={{ color: "#3DFFA2" }}>{r.approved}</strong></span>
                    <span className="text-xs" style={{ color: "#8A93A6" }}>Rejected: <strong style={{ color: "#FF3B3B" }}>{r.rejected}</strong></span>
                  </div>
                  {r.mainTrend && <p className="text-xs" style={{ color: "#C8CDD8" }}><span style={{ color: ONGOING_COLOR }}>Trend: </span>{r.mainTrend}</p>}
                  {r.mainOptimization && <p className="text-xs mt-1" style={{ color: "#C8CDD8" }}><span style={{ color: "#FF8800" }}>Optimization: </span>{r.mainOptimization}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Client */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label style={labelStyle}>Client</label>
          <button type="button" onClick={() => onNewClient(form)} className="flex items-center gap-1 text-xs" style={{ color: "#FF3B3B" }}>
            <UserPlus size={11} />New client
          </button>
        </div>
        <select
          required value={form.clientId} onChange={(e) => set("clientId", e.target.value)}
          className={inputCls} style={{ ...inputStyle, appearance: "none" } as React.CSSProperties}
          disabled={!!initial.clientId}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {/* Week dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>Week start (Saturday)</label>
          <CalendarPicker label="start date" value={form.weekStartDate} onChange={handleStartDate} />
        </div>
        <div>
          <label style={labelStyle}>Week end (Friday)</label>
          <CalendarPicker label="end date" value={form.weekEndDate} onChange={(v) => set("weekEndDate", v)} />
        </div>
      </div>

      {/* Views */}
      <div>
        <label style={labelStyle}>Views this week</label>
        <input type="number" min={0} value={form.totalViews} onChange={(e) => set("totalViews", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
      </div>

      {/* Platform views */}
      <div>
        <p style={{ ...labelStyle, marginBottom: "8px" }}>Platform views this week</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "tiktokViews" as const, label: "TikTok views" },
            { key: "instagramViews" as const, label: "Instagram views" },
            { key: "youtubeViews" as const, label: "YouTube Shorts views" },
            { key: "twitterViews" as const, label: "X views" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type="number" min={0} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      {/* Financial */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label style={labelStyle}>Paid out ($)</label>
          <input type="number" min={0} step="0.01" value={form.paidOut} onChange={(e) => set("paidOut", e.target.value)} placeholder="0.00" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Effective CPM ($)</label>
          <input type="number" min={0} step="0.01" value={form.effectiveCpm} onChange={(e) => set("effectiveCpm", e.target.value)} placeholder="—" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Budget remaining ($)</label>
          <input type="number" min={0} step="0.01" value={form.budgetRemaining} onChange={(e) => set("budgetRemaining", e.target.value)} placeholder="—" className={inputCls} style={inputStyle} />
        </div>
      </div>

      {/* Clips */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>Clips submitted</label>
          <input type="number" min={0} value={form.clipsSubmitted} onChange={(e) => set("clipsSubmitted", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Clips approved</label>
          <input type="number" min={0} value={form.clipsApproved} onChange={(e) => set("clipsApproved", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
      </div>

      {/* Narrative */}
      <div className="space-y-3">
        <div>
          <label style={labelStyle}>Weekly summary</label>
          <textarea rows={3} value={form.weeklySummary} onChange={(e) => set("weeklySummary", e.target.value)} placeholder="Brief overview of this week's performance…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>What&apos;s working</label>
            <textarea rows={3} value={form.whatsWorking} onChange={(e) => set("whatsWorking", e.target.value)} placeholder="Tactics, content types performing well…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>What&apos;s not working</label>
            <textarea rows={3} value={form.whatsNotWorking} onChange={(e) => set("whatsNotWorking", e.target.value)} placeholder="Areas to improve or drop…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Next week&apos;s focus</label>
          <textarea rows={3} value={form.nextWeekFocus} onChange={(e) => set("nextWeekFocus", e.target.value)} placeholder="Priorities and goals for next week…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Campaign link (optional)</label>
          <input type="url" value={form.campaignLink} onChange={(e) => set("campaignLink", e.target.value)} placeholder="https://…" className={inputCls} style={inputStyle} />
          <p className="text-xs mt-1" style={{ color: "#4A5568" }}>Shown as a clickable link at the top of the client report.</p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "#FF3B3B", color: "#fff", opacity: saving ? 0.6 : 1, boxShadow: saving ? "none" : "0 0 20px rgba(255,59,59,0.35)" }}>
          {saving ? "Saving…" : "Save Report"}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Ongoing Report Form ──────────────────────────────────────────────────────

const EMPTY_ONGOING: OngoingFormState = {
  clientId: "", date: "", campaignName: "",
  totalSubmissions: "", pending: "", approved: "", rejected: "",
  mainTrend: "", clipperFeedback: "", mainOptimization: "", status: "",
};

function OngoingReportForm({
  clients, initial, onSave, onCancel, saving,
}: {
  clients: ClientOption[];
  initial: OngoingFormState;
  onSave: (form: OngoingFormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<OngoingFormState>(initial);

  function set(k: keyof OngoingFormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const total = parseInt(form.totalSubmissions || "0", 10);
  const pend = parseInt(form.pending || "0", 10);
  const appr = parseInt(form.approved || "0", 10);
  const rej = parseInt(form.rejected || "0", 10);
  const showSumWarn = total > 0 && pend + appr + rej !== total;
  const showDayWarn = form.date.length > 0 && !isMonOrWed(form.date);
  const approvalRate = total > 0 ? (appr / total) * 100 : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.status) return;
    onSave(form);
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const inputStyle = { background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" };
  const labelStyle: React.CSSProperties = { color: "#8A93A6", fontSize: "0.75rem", fontWeight: 500, marginBottom: "4px", display: "block" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Date */}
      <div>
        <label style={labelStyle}>
          Date <span style={{ color: ONGOING_COLOR, fontSize: "0.7rem" }}>Mon/Wed highlighted</span>
        </label>
        <CalendarPicker label="report date" value={form.date} onChange={(v) => set("date", v)} highlightDows={[1, 3]} />
        {showDayWarn && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <AlertTriangle size={12} color="#FF8800" />
            <p className="text-xs" style={{ color: "#FF8800" }}>Ongoing reports are typically Monday or Wednesday — are you sure?</p>
          </div>
        )}
      </div>

      {/* Client */}
      <div>
        <label style={labelStyle}>Client</label>
        <select
          required value={form.clientId} onChange={(e) => set("clientId", e.target.value)}
          className={inputCls} style={{ ...inputStyle, appearance: "none" } as React.CSSProperties}
          disabled={!!initial.clientId}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>

      {/* Submission numbers */}
      <div>
        <label style={labelStyle}>Total Submissions</label>
        <input type="number" min={0} value={form.totalSubmissions} onChange={(e) => set("totalSubmissions", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label style={labelStyle}>Pending</label>
          <input type="number" min={0} value={form.pending} onChange={(e) => set("pending", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Approved</label>
          <input type="number" min={0} value={form.approved} onChange={(e) => set("approved", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Rejected</label>
          <input type="number" min={0} value={form.rejected} onChange={(e) => set("rejected", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
      </div>

      {showSumWarn && (
        <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "rgba(255,136,0,0.08)", border: "1px solid rgba(255,136,0,0.2)" }}>
          <AlertTriangle size={13} color="#FF8800" className="flex-shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: "#FF8800" }}>
            Pending ({pend}) + Approved ({appr}) + Rejected ({rej}) = {pend + appr + rej}, but Total is {total}. Double-check the numbers.
          </p>
        </div>
      )}

      {approvalRate !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(61,255,162,0.06)", border: "1px solid rgba(61,255,162,0.12)" }}>
          <CheckCircle size={12} color="#3DFFA2" />
          <p className="text-xs" style={{ color: "#3DFFA2" }}>Approval rate: <strong>{approvalRate.toFixed(1)}%</strong></p>
        </div>
      )}

      {/* Text sections */}
      <div>
        <label style={labelStyle}>Main Trend in Approved Clips</label>
        <textarea rows={3} value={form.mainTrend} onChange={(e) => set("mainTrend", e.target.value)} placeholder="What type of content/hooks/formats are working?" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div>
        <label style={labelStyle}>Clipper Feedback</label>
        <textarea rows={3} value={form.clipperFeedback} onChange={(e) => set("clipperFeedback", e.target.value)} placeholder="Any common questions, complaints, or issues?" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div>
        <label style={labelStyle}>Main Optimization</label>
        <textarea rows={3} value={form.mainOptimization} onChange={(e) => set("mainOptimization", e.target.value)} placeholder="What should we push, change, or fix tomorrow?" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Status */}
      <div>
        <label style={{ ...labelStyle, marginBottom: "8px" }}>Status <span style={{ color: "#FF3B3B" }}>*</span></label>
        <div className="flex gap-2">
          {(["Strong", "Normal", "NeedsAttention"] as const).map((s) => {
            const meta = STATUS_META[s];
            const selected = form.status === s;
            return (
              <button
                key={s} type="button" onClick={() => set("status", s)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: selected ? meta.bg : "rgba(255,255,255,0.04)",
                  color: selected ? meta.text : "#8A93A6",
                  border: `1px solid ${selected ? meta.border : "transparent"}`,
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit" disabled={saving || !form.status}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: ONGOING_COLOR, color: "#0B0E17", opacity: (saving || !form.status) ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Report"}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  clients: ClientOption[];
  initialReports: Report[];
  initialOngoingReports: OngoingReport[];
}

export default function CampaignReporting({ clients: initialClients, initialReports, initialOngoingReports }: Props) {
  const [clients, setClients] = useState<ClientOption[]>(initialClients);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [ongoingReports, setOngoingReports] = useState<OngoingReport[]>(initialOngoingReports);

  // Navigation
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [clientTab, setClientTab] = useState<"weekly" | "ongoing">("weekly");
  const [overviewFilter, setOverviewFilter] = useState<"all" | "attention">("all");

  // Weekly report modal state
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  // Ongoing report modal state
  const [showOngoingForm, setShowOngoingForm] = useState(false);
  const [editingOngoing, setEditingOngoing] = useState<OngoingReport | null>(null);
  const [viewingOngoing, setViewingOngoing] = useState<OngoingReport | null>(null);
  const [ongoingMonthFilter, setOngoingMonthFilter] = useState<string>("");

  // Shared state
  const [showNewClient, setShowNewClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    if (initialReports.length === 0) return new Set();
    const dates = initialReports.map((r) => r.weekEndDate).sort((a, b) => b.localeCompare(a));
    const d = new Date(dates[0]);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return new Set([key]);
  });
  const [copyingLink, setCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingFormState, setPendingFormState] = useState<FormState | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const clientReports = (id: string) => reports.filter((r) => r.clientId === id);
  const clientOngoing = (id: string) => ongoingReports.filter((r) => r.clientId === id);

  function prevWeeklyReport(report: Report): Report | null {
    const clientRpts = reports
      .filter((r) => r.clientId === report.clientId && r.id !== report.id)
      .sort((a, b) => new Date(b.weekEndDate).getTime() - new Date(a.weekEndDate).getTime());
    return clientRpts.find((r) => new Date(r.weekEndDate) < new Date(report.weekEndDate)) ?? null;
  }

  function prevOngoingReport(report: OngoingReport): OngoingReport | null {
    const clientRpts = ongoingReports
      .filter((r) => r.clientId === report.clientId && r.id !== report.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    return clientRpts.find((r) => r.date < report.date) ?? null;
  }

  // ── Weekly report CRUD ──────────────────────────────────────────────────────

  function formToPayload(form: FormState) {
    return {
      clientId: form.clientId,
      weekStartDate: form.weekStartDate,
      weekEndDate: form.weekEndDate,
      totalViews: parseInt(form.totalViews || "0", 10),
      tiktokViews: parseInt(form.tiktokViews || "0", 10),
      instagramViews: parseInt(form.instagramViews || "0", 10),
      youtubeViews: parseInt(form.youtubeViews || "0", 10),
      twitterViews: parseInt(form.twitterViews || "0", 10),
      paidOut: parseFloat(form.paidOut || "0"),
      effectiveCpm: form.effectiveCpm ? parseFloat(form.effectiveCpm) : null,
      budgetRemaining: form.budgetRemaining ? parseFloat(form.budgetRemaining) : null,
      clipsSubmitted: parseInt(form.clipsSubmitted || "0", 10),
      clipsApproved: parseInt(form.clipsApproved || "0", 10),
      weeklySummary: form.weeklySummary || null,
      whatsWorking: form.whatsWorking || null,
      whatsNotWorking: form.whatsNotWorking || null,
      nextWeekFocus: form.nextWeekFocus || null,
      campaignLink: form.campaignLink || null,
    };
  }

  function reportToForm(r: Report): FormState {
    return {
      clientId: r.clientId,
      weekStartDate: r.weekStartDate.slice(0, 10),
      weekEndDate: r.weekEndDate.slice(0, 10),
      totalViews: r.totalViews.toString(),
      tiktokViews: r.tiktokViews.toString(),
      instagramViews: r.instagramViews.toString(),
      youtubeViews: r.youtubeViews.toString(),
      twitterViews: r.twitterViews.toString(),
      paidOut: r.paidOut.toString(),
      effectiveCpm: r.effectiveCpm?.toString() ?? "",
      budgetRemaining: r.budgetRemaining?.toString() ?? "",
      clipsSubmitted: r.clipsSubmitted.toString(),
      clipsApproved: r.clipsApproved.toString(),
      weeklySummary: r.weeklySummary ?? "",
      whatsWorking: r.whatsWorking ?? "",
      whatsNotWorking: r.whatsNotWorking ?? "",
      nextWeekFocus: r.nextWeekFocus ?? "",
      campaignLink: r.campaignLink ?? "",
    };
  }

  function getWeeklyFormInitial(): FormState {
    if (pendingFormState) return pendingFormState;
    if (editingReport) return reportToForm(editingReport);
    return { ...EMPTY_FORM, clientId: selectedClientId === "all" ? "" : selectedClientId };
  }

  async function handleWeeklyCreate(form: FormState) {
    setSaving(true);
    const res = await fetch("/api/agency/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    if (res.ok) {
      const created = await res.json();
      setReports((prev) => [created, ...prev]);
      setShowWeeklyForm(false);
    }
    setSaving(false);
  }

  async function handleWeeklyEdit(form: FormState) {
    if (!editingReport) return;
    setSaving(true);
    const res = await fetch(`/api/agency/reports/${editingReport.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    if (res.ok) {
      const updated = await res.json();
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditingReport(null);
    }
    setSaving(false);
  }

  async function handleWeeklyDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/agency/reports/${id}`, { method: "DELETE" });
    if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id));
    setDeletingId(null);
  }

  async function handleTogglePublish(id: string) {
    setPublishingId(id);
    const res = await fetch(`/api/agency/reports/${id}/publish`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setReports((prev) => prev.map((r) => r.id === updated.id ? { ...r, published: updated.published, publishedAt: updated.publishedAt } : r));
    }
    setPublishingId(null);
  }

  // ── Ongoing report CRUD ─────────────────────────────────────────────────────

  function ongoingToForm(r: OngoingReport): OngoingFormState {
    return {
      clientId: r.clientId,
      date: r.date.slice(0, 10),
      campaignName: r.campaignName,
      totalSubmissions: r.totalSubmissions.toString(),
      pending: r.pending.toString(),
      approved: r.approved.toString(),
      rejected: r.rejected.toString(),
      mainTrend: r.mainTrend ?? "",
      clipperFeedback: r.clipperFeedback ?? "",
      mainOptimization: r.mainOptimization ?? "",
      status: r.status,
    };
  }

  function getOngoingFormInitial(): OngoingFormState {
    if (editingOngoing) return ongoingToForm(editingOngoing);
    const clientId = selectedClientId === "all" ? "" : selectedClientId;
    const lastOngoing = ongoingReports
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return { ...EMPTY_ONGOING, clientId, date: isoDate(new Date()) };
  }

  function ongoingFormToPayload(form: OngoingFormState) {
    return {
      clientId: form.clientId,
      date: form.date,
      campaignName: clients.find((c) => c.id === form.clientId)?.name ?? "",
      totalSubmissions: parseInt(form.totalSubmissions || "0", 10),
      pending: parseInt(form.pending || "0", 10),
      approved: parseInt(form.approved || "0", 10),
      rejected: parseInt(form.rejected || "0", 10),
      mainTrend: form.mainTrend || null,
      clipperFeedback: form.clipperFeedback || null,
      mainOptimization: form.mainOptimization || null,
      status: form.status,
    };
  }

  async function handleOngoingCreate(form: OngoingFormState) {
    setSaving(true);
    const res = await fetch("/api/agency/reports/ongoing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ongoingFormToPayload(form)),
    });
    if (res.ok) {
      const created = await res.json();
      setOngoingReports((prev) => [created, ...prev]);
      setShowOngoingForm(false);
    }
    setSaving(false);
  }

  async function handleOngoingEdit(form: OngoingFormState) {
    if (!editingOngoing) return;
    setSaving(true);
    const res = await fetch(`/api/agency/reports/ongoing/${editingOngoing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ongoingFormToPayload(form)),
    });
    if (res.ok) {
      const updated = await res.json();
      setOngoingReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditingOngoing(null);
    }
    setSaving(false);
  }

  async function handleOngoingDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/agency/reports/ongoing/${id}`, { method: "DELETE" });
    if (res.ok) setOngoingReports((prev) => prev.filter((r) => r.id !== id));
    setDeletingId(null);
  }

  // ── Share link ──────────────────────────────────────────────────────────────

  async function handleCopyLink() {
    if (selectedClientId === "all" || copyingLink) return;
    setCopyingLink(true);
    const res = await fetch(`/api/agency/clients/${selectedClientId}/share-token`, { method: "POST" });
    if (res.ok) {
      const { token } = await res.json();
      await navigator.clipboard.writeText(`${window.location.origin}/share/reports/${token}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
    setCopyingLink(false);
  }

  // ── Client modal ────────────────────────────────────────────────────────────

  function handleClientCreated(client: ClientOption) {
    setClients((prev) => [...prev, client]);
    setShowNewClient(false);
    if (pendingFormState !== null) {
      const updated = { ...pendingFormState, clientId: client.id };
      setPendingFormState(updated);
    }
    setPendingFormState(null);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function toggleMonth(key: string) {
    setExpandedMonths((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  function groupByMonth(rpts: Report[]) {
    const map = new Map<string, Report[]>();
    for (const r of rpts) {
      const d = new Date(r.weekEndDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const monthReports = map.get(key)!.sort((a, b) => new Date(b.weekEndDate).getTime() - new Date(a.weekEndDate).getTime());
      const totalViews = monthReports.reduce((s, r) => s + r.totalViews, 0);
      const totalPaid = monthReports.reduce((s, r) => s + r.paidOut, 0);
      const publishedCount = monthReports.filter((r) => r.published).length;
      return { key, label, reports: monthReports, totalViews, totalPaid, publishedCount };
    });
  }

  // Reference ongoing reports for weekly form (client + week range)
  function getRefOngoing(clientId: string, weekStart: string, weekEnd: string): OngoingReport[] {
    if (!clientId) return [];
    return ongoingReports.filter((r) => {
      if (r.clientId !== clientId) return false;
      if (!weekStart || !weekEnd) return false;
      const d = r.date.slice(0, 10);
      return d >= weekStart && d <= weekEnd;
    });
  }

  const activeWeeklyFormClientId = pendingFormState?.clientId ?? editingReport?.clientId ?? (selectedClientId !== "all" ? selectedClientId : "");
  const activeWeeklyFormStart = (pendingFormState ?? (editingReport ? reportToForm(editingReport) : null))?.weekStartDate ?? "";
  const activeWeeklyFormEnd = (pendingFormState ?? (editingReport ? reportToForm(editingReport) : null))?.weekEndDate ?? "";
  const refOngoing = getRefOngoing(activeWeeklyFormClientId, activeWeeklyFormStart, activeWeeklyFormEnd);

  const showWeeklyFormModal = (showWeeklyForm || editingReport !== null) && !showNewClient;
  const showOngoingFormModal = (showOngoingForm || editingOngoing !== null) && !showNewClient;

  // ── Overview: client card data ───────────────────────────────────────────────

  const today = new Date();

  interface ClientCardData {
    client: ClientOption;
    latestOngoingStatus: "Strong" | "Normal" | "NeedsAttention" | null;
    lastWeeklyDate: string | null;
    lastOngoingDate: string | null;
    missingFlags: string[];
  }

  const clientCardData: ClientCardData[] = clients.map((c) => {
    const cReports = clientReports(c.id);
    const cOngoing = clientOngoing(c.id);
    const latestOngoing = cOngoing.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const latestWeekly = cReports.sort((a, b) => b.weekEndDate.localeCompare(a.weekEndDate))[0] ?? null;
    return {
      client: c,
      latestOngoingStatus: latestOngoing?.status ?? null,
      lastWeeklyDate: latestWeekly?.weekEndDate ?? null,
      lastOngoingDate: latestOngoing?.date ?? null,
      missingFlags: getMissingFlags(today, cOngoing, cReports),
    };
  });

  const visibleClientCards = overviewFilter === "attention"
    ? clientCardData.filter((cd) => cd.latestOngoingStatus === "NeedsAttention" || cd.missingFlags.length > 0)
    : [...clientCardData].sort((a, b) => {
        const aAttention = a.latestOngoingStatus === "NeedsAttention" || a.missingFlags.length > 0;
        const bAttention = b.latestOngoingStatus === "NeedsAttention" || b.missingFlags.length > 0;
        if (aAttention && !bAttention) return -1;
        if (!aAttention && bAttention) return 1;
        return 0;
      });

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {showNewClient && (
        <NewClientModal
          onCreated={handleClientCreated}
          onClose={() => { setShowNewClient(false); setPendingFormState(null); }}
        />
      )}

      {showWeeklyFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(61,255,162,0.12)", color: WEEKLY_COLOR, border: "1px solid rgba(61,255,162,0.25)" }}>Weekly (F)</span>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>{editingReport ? "Edit Report" : "New Weekly Report"}</h2>
              </div>
              <button onClick={() => { setShowWeeklyForm(false); setEditingReport(null); setPendingFormState(null); }}>
                <X size={16} color="#8A93A6" />
              </button>
            </div>
            <WeeklyReportForm
              clients={clients}
              initial={getWeeklyFormInitial()}
              onSave={editingReport ? handleWeeklyEdit : handleWeeklyCreate}
              onCancel={() => { setShowWeeklyForm(false); setEditingReport(null); setPendingFormState(null); }}
              saving={saving}
              onNewClient={(currentForm) => { setPendingFormState(currentForm); setShowNewClient(true); }}
              referenceOngoing={refOngoing}
            />
          </div>
        </div>
      )}

      {showOngoingFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(123,159,249,0.12)", color: ONGOING_COLOR, border: "1px solid rgba(123,159,249,0.25)" }}>Ongoing (M/W)</span>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>{editingOngoing ? "Edit Report" : "New Ongoing Report"}</h2>
              </div>
              <button onClick={() => { setShowOngoingForm(false); setEditingOngoing(null); }}>
                <X size={16} color="#8A93A6" />
              </button>
            </div>
            <OngoingReportForm
              clients={clients}
              initial={getOngoingFormInitial()}
              onSave={editingOngoing ? handleOngoingEdit : handleOngoingCreate}
              onCancel={() => { setShowOngoingForm(false); setEditingOngoing(null); }}
              saving={saving}
            />
          </div>
        </div>
      )}

      {viewingOngoing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(123,159,249,0.12)", color: ONGOING_COLOR, border: "1px solid rgba(123,159,249,0.25)" }}>Ongoing (M/W)</span>
                </div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>{viewingOngoing.client.name}</h2>
              </div>
              <button onClick={() => setViewingOngoing(null)}><X size={16} color="#8A93A6" /></button>
            </div>
            <OngoingReportDetail report={viewingOngoing} prev={prevOngoingReport(viewingOngoing)} />
          </div>
        </div>
      )}

      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 1px rgba(255,59,59,0.04), 0 8px 32px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>{previewReport.client.name}</h2>
                <p className="text-xs" style={{ color: "#8A93A6" }}>Client preview — {fmtWeek(previewReport.weekStartDate, previewReport.weekEndDate)}</p>
              </div>
              <button onClick={() => setPreviewReport(null)}><X size={16} color="#8A93A6" /></button>
            </div>
            <ReportPreview report={previewReport} prev={prevWeeklyReport(previewReport)} />
          </div>
        </div>
      )}

      {/* ── OVERVIEW (all clients) ────────────────────────────────────────── */}

      {selectedClientId === "all" ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Campaign Reporting</h1>
              <p className="text-sm" style={{ color: "#8A93A6" }}>Weekly and ongoing reports by client.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowNewClient(true); setPendingFormState(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "#F5F6FA" }}
              >
                <UserPlus size={15} />New Client
              </button>
              <button
                onClick={() => { setShowOngoingForm(true); setEditingOngoing(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: `rgba(123,159,249,0.15)`, color: ONGOING_COLOR, border: `1px solid rgba(123,159,249,0.25)` }}
              >
                <Plus size={15} />Ongoing (M/W)
              </button>
              <button
                onClick={() => { setShowWeeklyForm(true); setEditingReport(null); setPendingFormState(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#FF3B3B", color: "#fff", boxShadow: "0 0 20px rgba(255,59,59,0.35)" }}
              >
                <Plus size={15} />Weekly (F)
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 mb-6">
            {(["all", "attention"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setOverviewFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: overviewFilter === f ? "rgba(255,59,59,0.12)" : "rgba(255,255,255,0.04)",
                  color: overviewFilter === f ? "#FF3B3B" : "#8A93A6",
                  border: `1px solid ${overviewFilter === f ? "rgba(255,59,59,0.25)" : "transparent"}`,
                }}
              >
                {f === "all" ? "All Clients" : "Needs Attention"}
              </button>
            ))}
          </div>

          {/* Client cards grid */}
          {visibleClientCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl py-24" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
              <BarChart2 size={36} style={{ color: "#FF3B3B", opacity: 0.4 }} className="mb-3" />
              <p className="text-sm" style={{ color: "#8A93A6" }}>
                {overviewFilter === "attention" ? "No clients need attention right now." : "No clients yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleClientCards.map(({ client, latestOngoingStatus, lastWeeklyDate, lastOngoingDate, missingFlags }) => (
                <button
                  key={client.id}
                  onClick={() => { setSelectedClientId(client.id); setClientTab("weekly"); setOngoingMonthFilter(""); }}
                  className="text-left rounded-2xl p-5 transition-all group"
                  style={{
                    background: "#0B0E17",
                    border: `1px solid ${latestOngoingStatus === "NeedsAttention" || missingFlags.length > 0 ? "rgba(255,59,59,0.2)" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  {/* Client name + status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <span className="text-sm font-bold" style={{ color: "#8A93A6" }}>{client.name.charAt(0)}</span>
                        </div>
                      )}
                      <p className="text-sm font-bold truncate" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{client.name}</p>
                    </div>
                    {latestOngoingStatus ? (
                      <StatusBadge status={latestOngoingStatus} size="xs" />
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded-lg flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", color: "#4A5568" }}>No status</span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "#4A5568" }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: WEEKLY_COLOR }} />
                        Last Weekly
                      </p>
                      <p className="text-xs font-medium" style={{ color: lastWeeklyDate ? "#F5F6FA" : "#4A5568" }}>
                        {lastWeeklyDate ? fmtDate(lastWeeklyDate) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "#4A5568" }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: ONGOING_COLOR }} />
                        Last Ongoing
                      </p>
                      <p className="text-xs font-medium" style={{ color: lastOngoingDate ? "#F5F6FA" : "#4A5568" }}>
                        {lastOngoingDate ? fmtDate(lastOngoingDate) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Missing flags */}
                  {missingFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {missingFlags.map((flag) => (
                        <span key={flag} className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-lg" style={{ background: "rgba(255,136,0,0.1)", color: "#FF8800", border: "1px solid rgba(255,136,0,0.2)" }}>
                          <AlertTriangle size={10} />
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── CLIENT VIEW ───────────────────────────────────────────────────── */
        <>
          {/* Back + header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedClientId("all")}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "#8A93A6" }}
              >
                <ArrowLeft size={14} />
                All Clients
              </button>
              <span style={{ color: "#2A2E3A" }}>/</span>
              <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{selectedClient?.name}</p>
            </div>
            <button
              onClick={handleCopyLink}
              disabled={copyingLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: linkCopied ? "rgba(61,255,162,0.12)" : "rgba(255,255,255,0.06)",
                color: linkCopied ? "#3DFFA2" : "#8A93A6",
                border: `1px solid ${linkCopied ? "rgba(61,255,162,0.3)" : "transparent"}`,
                opacity: copyingLink ? 0.6 : 1,
              }}
            >
              {linkCopied ? <Check size={12} /> : <Link2 size={12} />}
              {linkCopied ? "Link copied!" : "Copy client link"}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button
              onClick={() => setClientTab("weekly")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: clientTab === "weekly" ? `rgba(61,255,162,0.12)` : "transparent",
                color: clientTab === "weekly" ? WEEKLY_COLOR : "#8A93A6",
                border: clientTab === "weekly" ? `1px solid rgba(61,255,162,0.25)` : "1px solid transparent",
              }}
            >
              <Calendar size={13} />
              Weekly (F)
            </button>
            <button
              onClick={() => setClientTab("ongoing")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: clientTab === "ongoing" ? `rgba(123,159,249,0.12)` : "transparent",
                color: clientTab === "ongoing" ? ONGOING_COLOR : "#8A93A6",
                border: clientTab === "ongoing" ? `1px solid rgba(123,159,249,0.25)` : "1px solid transparent",
              }}
            >
              <Activity size={13} />
              Ongoing (M/W)
            </button>
          </div>

          {/* ── WEEKLY TAB ──────────────────────────────────────────────────── */}

          {clientTab === "weekly" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: WEEKLY_COLOR }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: WEEKLY_COLOR }} />
                  Weekly Reports (F)
                </p>
                <button
                  onClick={() => { setShowWeeklyForm(true); setEditingReport(null); setPendingFormState(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(61,255,162,0.1)", color: WEEKLY_COLOR, border: "1px solid rgba(61,255,162,0.2)" }}
                >
                  <Plus size={12} />New Weekly Report
                </button>
              </div>

              {clientReports(selectedClientId).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl py-16" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <BarChart2 size={30} style={{ color: WEEKLY_COLOR, opacity: 0.35 }} className="mb-3" />
                  <p className="text-sm" style={{ color: "#8A93A6" }}>No weekly reports yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupByMonth(clientReports(selectedClientId)).map(({ key, label, reports: monthReports, totalViews: mViews, totalPaid: mPaid, publishedCount }) => {
                    const monthOpen = expandedMonths.has(key);
                    return (
                      <div key={key} className="rounded-lg overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <button className="w-full flex items-center gap-3 px-5 py-4 text-left" onClick={() => toggleMonth(key)}>
                          <div className="flex-shrink-0" style={{ color: WEEKLY_COLOR }}>
                            {monthOpen ? <FolderOpen size={18} /> : <Folder size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{label}</p>
                            <p className="text-xs" style={{ color: "#8A93A6" }}>
                              {monthReports.length} {monthReports.length === 1 ? "report" : "reports"} · {publishedCount} published
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Total views</p>
                              <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(mViews)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Total paid</p>
                              <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtCurrency(mPaid)}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 transition-transform duration-200" style={{ transform: monthOpen ? "rotate(180deg)" : "none", color: "#8A93A6" }}>
                            <ChevronDown size={16} />
                          </div>
                        </button>

                        {monthOpen && (
                          <div className="px-3 pb-3 space-y-2">
                            {monthReports.map((report) => {
                              const prev = prevWeeklyReport(report);
                              const expanded = expandedIds.has(report.id);
                              return (
                                <div key={report.id} className="rounded-lg overflow-hidden" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.05)" }}>
                                  <div className="flex items-center gap-4 px-4 py-3">
                                    <div className="w-px self-stretch flex-shrink-0 rounded-full" style={{ background: "rgba(61,255,162,0.15)" }} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtWeek(report.weekStartDate, report.weekEndDate)}</span>
                                        {report.published ? (
                                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.12)", color: "#3DFFA2" }}>Published</span>
                                        ) : (
                                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>Draft</span>
                                        )}
                                      </div>
                                      <div className="hidden md:flex items-center gap-4 mt-1">
                                        <span className="text-xs" style={{ color: "#8A93A6" }}>Views: <strong style={{ color: "#F5F6FA" }}>{fmt(report.totalViews)}</strong></span>
                                        <span className="text-xs" style={{ color: "#8A93A6" }}>Paid: <strong style={{ color: "#F5F6FA" }}>{fmtCurrency(report.paidOut)}</strong></span>
                                        <span className="text-xs" style={{ color: "#8A93A6" }}>Clips: <strong style={{ color: "#F5F6FA" }}>{report.clipsApproved}/{report.clipsSubmitted}</strong></span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <button title="Preview" onClick={() => setPreviewReport(report)} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                                        <Eye size={13} />
                                      </button>
                                      <button title={report.published ? "Unpublish" : "Publish"} onClick={() => handleTogglePublish(report.id)} disabled={publishingId === report.id} className="p-1.5 rounded-lg" style={{ color: report.published ? "#3DFFA2" : "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                                        {report.published ? <EyeOff size={13} /> : <Eye size={13} />}
                                      </button>
                                      <button title="Edit" onClick={() => { setEditingReport(report); setPendingFormState(null); }} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                                        <Edit2 size={13} />
                                      </button>
                                      <button title="Delete" onClick={() => handleWeeklyDelete(report.id)} disabled={deletingId === report.id} className="p-1.5 rounded-lg" style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)" }}>
                                        <Trash2 size={13} />
                                      </button>
                                      <button onClick={() => toggleExpand(report.id)} className="p-1.5 rounded-lg transition-transform duration-200" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)", transform: expanded ? "rotate(180deg)" : "none" }}>
                                        <ChevronDown size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  {expanded && (
                                    <div className="px-4 pb-4">
                                      <ReportPreview report={report} prev={prev} />
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
              )}
            </>
          )}

          {/* ── ONGOING TAB ─────────────────────────────────────────────────── */}

          {clientTab === "ongoing" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: ONGOING_COLOR }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: ONGOING_COLOR }} />
                  Ongoing Reports (M/W)
                </p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const allOngoing = clientOngoing(selectedClientId).sort((a, b) => b.date.localeCompare(a.date));
                    const monthKeys = Array.from(new Set(allOngoing.map((r) => r.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
                    if (monthKeys.length <= 1) return null;
                    return (
                      <select
                        value={ongoingMonthFilter}
                        onChange={(e) => setOngoingMonthFilter(e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={{ background: "#05070D", border: "1px solid rgba(123,159,249,0.2)", color: ongoingMonthFilter ? ONGOING_COLOR : "#8A93A6", appearance: "none" } as React.CSSProperties}
                      >
                        <option value="">All months</option>
                        {monthKeys.map((k) => {
                          const [y, m] = k.split("-").map(Number);
                          const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                          return <option key={k} value={k}>{label}</option>;
                        })}
                      </select>
                    );
                  })()}
                  <button
                    onClick={() => { setShowOngoingForm(true); setEditingOngoing(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(123,159,249,0.1)", color: ONGOING_COLOR, border: "1px solid rgba(123,159,249,0.2)" }}
                  >
                    <Plus size={12} />New Ongoing Report
                  </button>
                </div>
              </div>

              {clientOngoing(selectedClientId).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl py-16" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Activity size={30} style={{ color: ONGOING_COLOR, opacity: 0.35 }} className="mb-3" />
                  <p className="text-sm" style={{ color: "#8A93A6" }}>No ongoing reports yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientOngoing(selectedClientId)
                    .filter((r) => !ongoingMonthFilter || r.date.startsWith(ongoingMonthFilter))
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((report) => {
                      const prev = prevOngoingReport(report);
                      const approvalRate = report.totalSubmissions > 0 ? (report.approved / report.totalSubmissions) * 100 : null;
                      const prevApprovalRate = prev && prev.totalSubmissions > 0 ? (prev.approved / prev.totalSubmissions) * 100 : null;

                      return (
                        <div key={report.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="w-px self-stretch flex-shrink-0 rounded-full" style={{ background: "rgba(123,159,249,0.2)" }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtDate(report.date)}</span>
                              <span className="text-xs font-medium" style={{ color: ONGOING_COLOR }}>{dayOfWeekName(report.date)}</span>
                              <StatusBadge status={report.status} size="xs" />
                            </div>
                            {report.campaignName && (
                              <p className="text-xs" style={{ color: "#8A93A6" }}>{report.campaignName}</p>
                            )}
                          </div>
                          <div className="hidden md:flex items-center gap-5 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Submissions</p>
                              <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{report.totalSubmissions}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Approved</p>
                              <div className="flex items-center justify-end gap-1">
                                <p className="text-sm font-semibold" style={{ color: "#3DFFA2" }}>{report.approved}</p>
                                {prev && <WowBadge curr={report.approved} prev={prev.approved} />}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: "#8A93A6" }}>Approval</p>
                              <div className="flex items-center justify-end gap-1">
                                <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{approvalRate != null ? `${approvalRate.toFixed(0)}%` : "—"}</p>
                                {prevApprovalRate != null && <WowBadge curr={approvalRate ?? 0} prev={prevApprovalRate} />}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button title="View" onClick={() => setViewingOngoing(report)} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                              <Eye size={13} />
                            </button>
                            <button title="Edit" onClick={() => { setEditingOngoing(report); }} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                              <Edit2 size={13} />
                            </button>
                            <button title="Delete" onClick={() => handleOngoingDelete(report.id)} disabled={deletingId === report.id} className="p-1.5 rounded-lg" style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
