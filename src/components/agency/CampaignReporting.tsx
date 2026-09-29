"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, X, Edit2, Trash2, Eye, EyeOff, TrendingUp, TrendingDown,
  Minus, BarChart2, ChevronDown, Link2, Check, ChevronLeft, ChevronRight,
  UserPlus, DollarSign, Target, Wallet, CheckCircle, Scissors,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { PlatformIcon, PLATFORM_COLORS, PLATFORM_LABELS } from "@/components/shared/PlatformIcon";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  published: boolean;
  publishedAt: string | null;
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function wow(curr: number, prev: number | null | undefined, inverted = false): {
  pct: string; positive: boolean; neutral: boolean; firstWeek: boolean;
} {
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

const EMPTY_FORM: FormState = {
  clientId: "", weekStartDate: "", weekEndDate: "",
  totalViews: "", tiktokViews: "", instagramViews: "", youtubeViews: "", twitterViews: "",
  paidOut: "", effectiveCpm: "", budgetRemaining: "", clipsSubmitted: "", clipsApproved: "",
  weeklySummary: "", whatsWorking: "", whatsNotWorking: "", nextWeekFocus: "",
};

// ─── Calendar Picker ─────────────────────────────────────────────────────────

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function CalendarPicker({ value, onChange, label }: {
  value: string;
  onChange: (iso: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  // Close on outside click
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

  // Build grid: days of the month + leading/trailing blanks
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
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
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/5">
              <ChevronLeft size={14} color="#8A93A6" />
            </button>
            <span className="text-xs font-semibold" style={{ color: "#F5F6FA" }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/5">
              <ChevronRight size={14} color="#8A93A6" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs py-1" style={{ color: "#4A5568" }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button
                    type="button"
                    onClick={() => selectDay(day)}
                    className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: isSelected(day) ? "#FF3B3B" : isToday(day) ? "rgba(255,59,59,0.12)" : "transparent",
                      color: isSelected(day) ? "#fff" : isToday(day) ? "#FF3B3B" : "#F5F6FA",
                    }}
                  >
                    {day}
                  </button>
                ) : <div className="w-8 h-8" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

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
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>New Client</h2>
          <button onClick={onClose}><X size={16} color="#8A93A6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Client name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" }}
            />
            {error && <p className="text-xs mt-1.5" style={{ color: "#FF3B3B" }}>{error}</p>}
          </div>
          <p className="text-xs" style={{ color: "#4A5568" }}>
            Login credentials can be added later from the Clients page.
          </p>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: "#FF3B3B", color: "#fff", opacity: saving || !name.trim() ? 0.5 : 1 }}
            >
              {saving ? "Creating…" : "Create Client"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Donut + Report Preview ───────────────────────────────────────────────────

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
    name: p,
    value: platformData[p],
    gradId: `ag-dg-${report.id}-${p}`,
    grad: DONUT_GRADIENTS[p] ?? (["#9CA3AF", "#4B5563"] as [string, string]),
    color: PLATFORM_COLORS[p] ?? "#8A93A6",
  }));
  const emptySlice = [{
    name: "empty", value: 1, color: "rgba(255,255,255,0.07)",
    gradId: `ag-dg-${report.id}-empty`,
    grad: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0.07)"] as [string, string],
  }];

  return (
    <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.06)" }}>
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
            <Pie
              data={pieData.length > 0 ? pieData : emptySlice}
              cx={50} cy={50}
              innerRadius={32} outerRadius={48}
              dataKey="value"
              paddingAngle={pieData.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90} endAngle={-270}
            >
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
    <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs font-medium mb-5" style={{ color: "#8A93A6" }}>{fmtWeek(report.weekStartDate, report.weekEndDate)}</p>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              {c.icon}
              <p className="text-xs font-medium leading-tight" style={{ color: "#8A93A6" }}>{c.label}</p>
            </div>
            <p className="text-xl font-bold mb-1 leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{c.value}</p>
            {c.sublabel && <p className="text-xs mb-1.5" style={{ color: "#8A93A6" }}>{c.sublabel}</p>}
            <WowBadge curr={c.curr} prev={c.prev} inverted={c.inverted} grey={c.grey} />
            {c.lastWeek && <p className="text-xs mt-1" style={{ color: "#4A5568" }}>Last week: {c.lastWeek}</p>}
          </div>
        ))}
      </div>

      {/* Donut */}
      <div className="mb-4">
        <ReportDonut report={report} />
      </div>

      {/* Narrative */}
      {(report.weeklySummary || report.whatsWorking || report.whatsNotWorking || report.nextWeekFocus) && (
        <div className="space-y-3">
          {report.weeklySummary && (
            <div className="rounded-xl p-4" style={{ background: "#05070D", border: "1px solid rgba(255,255,255,0.06)" }}>
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

// ─── Report Form ─────────────────────────────────────────────────────────────

function ReportForm({
  clients,
  initial,
  onSave,
  onCancel,
  saving,
  onNewClient,
}: {
  clients: ClientOption[];
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  onNewClient: (currentForm: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set(k: keyof FormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // When week start changes, auto-fill end to start + 6 days if end is empty
  function handleStartDate(iso: string) {
    set("weekStartDate", iso);
    if (!form.weekEndDate) {
      const end = new Date(iso + "T00:00:00");
      end.setDate(end.getDate() + 6);
      set("weekEndDate", isoDate(end));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500/40";
  const inputStyle = { background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" };
  const labelStyle: React.CSSProperties = { color: "#8A93A6", fontSize: "0.75rem", fontWeight: 500, marginBottom: "4px", display: "block" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label style={labelStyle}>Client</label>
          <button
            type="button"
            onClick={() => onNewClient(form)}
            className="flex items-center gap-1 text-xs"
            style={{ color: "#FF3B3B" }}
          >
            <UserPlus size={11} />
            New client
          </button>
        </div>
        <select
          required
          value={form.clientId}
          onChange={(e) => set("clientId", e.target.value)}
          className={inputCls}
          style={{ ...inputStyle, appearance: "none" } as React.CSSProperties}
          disabled={!!initial.clientId}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Week dates — calendar pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>Week start (Saturday)</label>
          <CalendarPicker
            label="start date"
            value={form.weekStartDate}
            onChange={handleStartDate}
          />
        </div>
        <div>
          <label style={labelStyle}>Week end (Friday)</label>
          <CalendarPicker
            label="end date"
            value={form.weekEndDate}
            onChange={(v) => set("weekEndDate", v)}
          />
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
            { key: "tiktokViews" as const, label: "TikTok views this week" },
            { key: "instagramViews" as const, label: "Instagram views this week" },
            { key: "youtubeViews" as const, label: "YouTube Shorts views this week" },
            { key: "twitterViews" as const, label: "X views this week" },
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
          <label style={labelStyle}>Paid out this week ($)</label>
          <input type="number" min={0} step="0.01" value={form.paidOut} onChange={(e) => set("paidOut", e.target.value)} placeholder="0.00" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Effective CPM this week ($)</label>
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
          <label style={labelStyle}>Clips submitted this week</label>
          <input type="number" min={0} value={form.clipsSubmitted} onChange={(e) => set("clipsSubmitted", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Clips approved this week</label>
          <input type="number" min={0} value={form.clipsApproved} onChange={(e) => set("clipsApproved", e.target.value)} placeholder="0" className={inputCls} style={inputStyle} />
        </div>
      </div>

      {/* Narrative sections */}
      <div className="space-y-3">
        <div>
          <label style={labelStyle}>Weekly summary</label>
          <textarea rows={3} value={form.weeklySummary} onChange={(e) => set("weeklySummary", e.target.value)} placeholder="Brief overview of this week's performance…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>What's working</label>
            <textarea rows={3} value={form.whatsWorking} onChange={(e) => set("whatsWorking", e.target.value)} placeholder="Tactics, content types, or strategies performing well…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>What's not working</label>
            <textarea rows={3} value={form.whatsNotWorking} onChange={(e) => set("whatsNotWorking", e.target.value)} placeholder="Areas to improve or drop…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Next week's focus</label>
          <textarea rows={3} value={form.nextWeekFocus} onChange={(e) => set("nextWeekFocus", e.target.value)} placeholder="Priorities and goals for next week…" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity" style={{ background: "#FF3B3B", color: "#fff", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Report"}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm transition-colors" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>
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
}

export default function CampaignReporting({ clients: initialClients, initialReports }: Props) {
  const [clients, setClients] = useState<ClientOption[]>(initialClients);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copyingLink, setCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Pending client form — when user clicks "New client" inside the report form
  const [pendingFormState, setPendingFormState] = useState<FormState | null>(null);

  const filteredReports = selectedClientId === "all"
    ? reports
    : reports.filter((r) => r.clientId === selectedClientId);

  function prevReport(report: Report): Report | null {
    const clientReports = reports
      .filter((r) => r.clientId === report.clientId && r.id !== report.id)
      .sort((a, b) => new Date(b.weekEndDate).getTime() - new Date(a.weekEndDate).getTime());
    return clientReports.find(r => new Date(r.weekEndDate) < new Date(report.weekEndDate)) ?? null;
  }

  function toggleExpand(id: string) {
    setExpandedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

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
    };
  }

  async function handleCreate(form: FormState) {
    setSaving(true);
    const res = await fetch("/api/agency/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    if (res.ok) {
      const created = await res.json();
      setReports((prev) => [created, ...prev]);
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleEdit(form: FormState) {
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

  async function handleDelete(id: string) {
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
    };
  }

  // Called from inside the report form when user wants to create a new client
  function openNewClientFromForm(currentForm: FormState) {
    setPendingFormState(currentForm);
    setShowNewClient(true);
  }

  function handleClientCreated(client: ClientOption) {
    setClients((prev) => [...prev, client]);
    setShowNewClient(false);
    // If the new client modal was opened from inside the report form, re-open form with new client selected
    if (pendingFormState !== null) {
      const updated = { ...pendingFormState, clientId: client.id };
      if (showForm) {
        setPendingFormState(updated);
      } else if (editingReport) {
        setEditingReport((r) => r ? { ...r, clientId: client.id } : r);
      }
      setPendingFormState(updated);
    }
    setPendingFormState(null);
  }

  // The form initial state (new or edit), with pending client pre-selected if applicable
  function getFormInitial(): FormState {
    if (pendingFormState) return pendingFormState;
    if (editingReport) return reportToForm(editingReport);
    return { ...EMPTY_FORM, clientId: selectedClientId === "all" ? "" : selectedClientId };
  }

  const showReportForm = (showForm || editingReport !== null) && !showNewClient;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Campaign Reporting</h1>
          <p className="text-sm" style={{ color: "#8A93A6" }}>Weekly performance reports by client.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowNewClient(true); setPendingFormState(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "#F5F6FA" }}
          >
            <UserPlus size={15} />
            New Client
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingReport(null); setPendingFormState(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#FF3B3B", color: "#fff" }}
          >
            <Plus size={15} />
            New Report
          </button>
        </div>
      </div>

      {/* Client filter + share link */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {[{ id: "all", name: "All Clients" }, ...clients].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: selectedClientId === c.id ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.04)",
                color: selectedClientId === c.id ? "#FF3B3B" : "#8A93A6",
                border: `1px solid ${selectedClientId === c.id ? "rgba(255,59,59,0.3)" : "transparent"}`,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        {selectedClientId !== "all" && (
          <button
            onClick={handleCopyLink}
            disabled={copyingLink}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            style={{
              background: linkCopied ? "rgba(61,255,162,0.12)" : "rgba(255,255,255,0.06)",
              color: linkCopied ? "#3DFFA2" : "#8A93A6",
              border: `1px solid ${linkCopied ? "rgba(61,255,162,0.3)" : "transparent"}`,
              opacity: copyingLink ? 0.6 : 1,
            }}
          >
            {linkCopied ? <Check size={12} /> : <Link2 size={12} />}
            {linkCopied ? "Link copied!" : "Copy report link"}
          </button>
        )}
      </div>

      {/* New Client modal */}
      {showNewClient && (
        <NewClientModal
          onCreated={handleClientCreated}
          onClose={() => { setShowNewClient(false); setPendingFormState(null); }}
        />
      )}

      {/* New / Edit report modal */}
      {showReportForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>
                {editingReport ? "Edit Report" : "New Weekly Report"}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingReport(null); setPendingFormState(null); }}>
                <X size={16} color="#8A93A6" />
              </button>
            </div>
            <ReportForm
              clients={clients}
              initial={getFormInitial()}
              onSave={editingReport ? handleEdit : handleCreate}
              onCancel={() => { setShowForm(false); setEditingReport(null); setPendingFormState(null); }}
              saving={saving}
              onNewClient={(currentForm) => {
                setPendingFormState(currentForm);
                setShowNewClient(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>{previewReport.client.name}</h2>
                <p className="text-xs" style={{ color: "#8A93A6" }}>Client preview — {fmtWeek(previewReport.weekStartDate, previewReport.weekEndDate)}</p>
              </div>
              <button onClick={() => setPreviewReport(null)}><X size={16} color="#8A93A6" /></button>
            </div>
            <ReportPreview report={previewReport} prev={prevReport(previewReport)} />
          </div>
        </div>
      )}

      {/* Report list */}
      {filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl py-24" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
          <BarChart2 size={36} style={{ color: "#FF3B3B", opacity: 0.4 }} className="mb-3" />
          <p className="text-sm" style={{ color: "#8A93A6" }}>No reports yet. Create the first weekly report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => {
            const prev = prevReport(report);
            const expanded = expandedIds.has(report.id);
            return (
              <div key={report.id} className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{report.client.name}</span>
                      {report.published ? (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(61,255,162,0.12)", color: "#3DFFA2" }}>Published</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}>Draft</span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "#8A93A6" }}>{fmtWeek(report.weekStartDate, report.weekEndDate)}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#8A93A6" }}>Views</p>
                      <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(report.totalViews)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#8A93A6" }}>Paid Out</p>
                      <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmtCurrency(report.paidOut)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#8A93A6" }}>Clips</p>
                      <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{report.clipsApproved}/{report.clipsSubmitted}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button title="Preview" onClick={() => setPreviewReport(report)} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                      <Eye size={14} />
                    </button>
                    <button title={report.published ? "Unpublish" : "Publish"} onClick={() => handleTogglePublish(report.id)} disabled={publishingId === report.id} className="p-1.5 rounded-lg" style={{ color: report.published ? "#3DFFA2" : "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                      {report.published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button title="Edit" onClick={() => { setEditingReport(report); setPendingFormState(null); }} className="p-1.5 rounded-lg" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}>
                      <Edit2 size={14} />
                    </button>
                    <button title="Delete" onClick={() => handleDelete(report.id)} disabled={deletingId === report.id} className="p-1.5 rounded-lg" style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)" }}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => toggleExpand(report.id)} className="p-1.5 rounded-lg transition-transform" style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)", transform: expanded ? "rotate(180deg)" : "none" }}>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="px-5 pb-5">
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
}
