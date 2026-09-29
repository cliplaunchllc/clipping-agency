"use client";

import { useState } from "react";
import {
  Plus, X, Edit2, Trash2, Eye, EyeOff, TrendingUp, TrendingDown,
  Minus, BarChart2, ChevronDown, Link2, Check,
} from "lucide-react";

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

// WoW % change. inverted = lower is better (CPM). Returns null if no prev.
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

const EMPTY_FORM: FormState = {
  clientId: "",
  weekStartDate: "",
  weekEndDate: "",
  totalViews: "",
  tiktokViews: "",
  instagramViews: "",
  youtubeViews: "",
  twitterViews: "",
  paidOut: "",
  effectiveCpm: "",
  budgetRemaining: "",
  clipsSubmitted: "",
  clipsApproved: "",
};

// ─── Report Preview Card ──────────────────────────────────────────────────────

function ReportPreview({ report, prev }: { report: Report; prev: Report | null }) {
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
    <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs font-medium mb-5" style={{ color: "#8A93A6" }}>
        {fmtWeek(report.weekStartDate, report.weekEndDate)}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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

      {/* Platform breakdown */}
      {report.totalViews > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#05070D" }}>
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

// ─── Report Form ─────────────────────────────────────────────────────────────

function ReportForm({
  clients,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  clients: ClientOption[];
  initial: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set(k: keyof FormState, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500/40";
  const inputStyle = { background: "#05070D", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA" };
  const labelStyle = { color: "#8A93A6", fontSize: "0.75rem", fontWeight: 500, marginBottom: "4px", display: "block" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client */}
      <div>
        <label style={labelStyle}>Client</label>
        <select
          required
          value={form.clientId}
          onChange={(e) => set("clientId", e.target.value)}
          className={inputCls}
          style={inputStyle}
          disabled={!!initial.clientId}
        >
          <option value="">Select client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Week dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>Week start (Saturday)</label>
          <input
            type="date"
            required
            value={form.weekStartDate}
            onChange={(e) => set("weekStartDate", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Week end (Friday)</label>
          <input
            type="date"
            required
            value={form.weekEndDate}
            onChange={(e) => set("weekEndDate", e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Views */}
      <div>
        <label style={labelStyle}>Views this week</label>
        <input
          type="number"
          min={0}
          value={form.totalViews}
          onChange={(e) => set("totalViews", e.target.value)}
          placeholder="0"
          className={inputCls}
          style={inputStyle}
        />
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
              <input
                type="number"
                min={0}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder="0"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Financial */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label style={labelStyle}>Paid out this week ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.paidOut}
            onChange={(e) => set("paidOut", e.target.value)}
            placeholder="0.00"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Effective CPM this week ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.effectiveCpm}
            onChange={(e) => set("effectiveCpm", e.target.value)}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Budget remaining ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.budgetRemaining}
            onChange={(e) => set("budgetRemaining", e.target.value)}
            placeholder="—"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Clips */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>Clips submitted this week</label>
          <input
            type="number"
            min={0}
            value={form.clipsSubmitted}
            onChange={(e) => set("clipsSubmitted", e.target.value)}
            placeholder="0"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Clips approved this week</label>
          <input
            type="number"
            min={0}
            value={form.clipsApproved}
            onChange={(e) => set("clipsApproved", e.target.value)}
            placeholder="0"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
          style={{ background: "#FF3B3B", color: "#fff", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Report"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", color: "#8A93A6" }}
        >
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

export default function CampaignReporting({ clients, initialReports }: Props) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copyingLink, setCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Reports for the selected client, sorted newest first
  const filteredReports = selectedClientId === "all"
    ? reports
    : reports.filter((r) => r.clientId === selectedClientId);

  // For a given report, find the previous published report for the same client
  function prevReport(report: Report): Report | null {
    const clientReports = reports
      .filter((r) => r.clientId === report.clientId && r.published && r.id !== report.id)
      .sort((a, b) => new Date(b.weekEndDate).getTime() - new Date(a.weekEndDate).getTime());

    const idx = clientReports.findIndex(
      (r) => new Date(r.weekEndDate) < new Date(report.weekEndDate)
    );
    return idx >= 0 ? clientReports[idx] : null;
  }

  async function handleCopyLink() {
    if (selectedClientId === "all" || copyingLink) return;
    setCopyingLink(true);
    const res = await fetch(`/api/agency/clients/${selectedClientId}/share-token`, { method: "POST" });
    if (res.ok) {
      const { token } = await res.json();
      const url = `${window.location.origin}/share/reports/${token}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
    setCopyingLink(false);
  }

  function toggleExpand(id: string) {
    setExpandedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    };
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            Campaign Reporting
          </h1>
          <p className="text-sm" style={{ color: "#8A93A6" }}>Weekly performance reports by client.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingReport(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#FF3B3B", color: "#fff" }}
        >
          <Plus size={15} />
          New Report
        </button>
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

      {/* New report modal */}
      {showForm && !editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>New Weekly Report</h2>
              <button onClick={() => setShowForm(false)}><X size={16} color="#8A93A6" /></button>
            </div>
            <ReportForm
              clients={clients}
              initial={{ ...EMPTY_FORM, clientId: selectedClientId === "all" ? "" : selectedClientId }}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "#F5F6FA" }}>Edit Report</h2>
              <button onClick={() => setEditingReport(null)}><X size={16} color="#8A93A6" /></button>
            </div>
            <ReportForm
              clients={clients}
              initial={reportToForm(editingReport)}
              onSave={handleEdit}
              onCancel={() => setEditingReport(null)}
              saving={saving}
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
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-24"
          style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}
        >
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
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Client + week */}
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

                  {/* Quick stats */}
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      title="Preview"
                      onClick={() => setPreviewReport(report)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      title={report.published ? "Unpublish" : "Publish"}
                      onClick={() => handleTogglePublish(report.id)}
                      disabled={publishingId === report.id}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: report.published ? "#3DFFA2" : "#8A93A6", background: "rgba(255,255,255,0.04)" }}
                    >
                      {report.published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      title="Edit"
                      onClick={() => setEditingReport(report)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDelete(report.id)}
                      disabled={deletingId === report.id}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => toggleExpand(report.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)", transform: expanded ? "rotate(180deg)" : "none" }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded preview */}
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
