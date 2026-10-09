"use client";

import { useState } from "react";
import { CheckCircle2, Circle, AlertTriangle, MessageCircle, CalendarDays, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface Step {
  id: string;
  label: string;
  sub?: string;
}

interface Section {
  id: string;
  title: string;
  steps: Step[];
}

const MW_SECTIONS: Section[] = [
  {
    id: "mw-where",
    title: "Where to log it",
    steps: [
      { id: "mw1", label: "Go to Campaign Reporting in the sidebar" },
      { id: "mw2", label: "Click on the client card in the overview" },
      { id: "mw3", label: 'Switch to the "M/W Reports" tab inside the client view' },
      { id: "mw4", label: 'Click "+ New Ongoing Report"' },
    ],
  },
  {
    id: "mw-fill",
    title: "What to fill in",
    steps: [
      { id: "mw5", label: "Set the date to today (Monday or Wednesday)" },
      { id: "mw6", label: "Enter total views and views today" },
      { id: "mw7", label: "Enter clip counts: submitted, pending, approved, rejected" },
      { id: "mw8", label: "Fill in Main Trend — what style or format performed best" },
      { id: "mw9", label: "Fill in Clipper Feedback — any standouts or issues" },
      { id: "mw10", label: "Fill in Main Optimization — one thing to adjust going forward" },
      { id: "mw11", label: "Set the Status: Strong, Normal, or Needs Attention" },
      { id: "mw12", label: "Hit Save" },
    ],
  },
];

const WEEKLY_SECTIONS: Section[] = [
  {
    id: "w-where",
    title: "Where to log it",
    steps: [
      { id: "w1", label: "Go to Campaign Reporting in the sidebar" },
      { id: "w2", label: "Click on the client card in the overview" },
      { id: "w3", label: 'Switch to the "Weekly Reports" tab inside the client view' },
      { id: "w4", label: 'Click "+ New Weekly Report"' },
    ],
  },
  {
    id: "w-fill",
    title: "What to fill in",
    steps: [
      { id: "w5", label: "Set the week date range (Mon–Fri of the current week)" },
      { id: "w6", label: "Enter total views and per-platform breakdown" },
      { id: "w7", label: "Enter Paid Out amount and Budget Remaining" },
      { id: "w8", label: "Enter clips submitted and approved" },
      { id: "w9", label: "Write the Weekly Summary — 2-3 sentences on the week overall" },
      { id: "w10", label: "Fill in What's Working, What's Not Working, Next Week Focus" },
      { id: "w11", label: 'Hit Save, then click "Publish" to make it visible to the client' },
    ],
  },
];

const CONTACT_SECTIONS: Section[] = [
  {
    id: "c-where",
    title: "Where to log it",
    steps: [
      { id: "c1", label: "Go to Campaign Reporting in the sidebar" },
      { id: "c2", label: 'Find the client card in the overview — look for the "Last Contacted" button at the bottom' },
      { id: "c3", label: "Click that button — it shows the current contact status (green / yellow / red)" },
      { id: "c4", label: "Pick today's date from the date picker that opens" },
      { id: "c5", label: 'Click "Save" — the badge updates immediately' },
    ],
  },
  {
    id: "c-rules",
    title: "The rules",
    steps: [
      { id: "c6", label: "Message every client at least every 3 days", sub: "Badge turns yellow at 3 days, red at 4+" },
      { id: "c7", label: "Log the contact the same day you message — don't wait" },
      { id: "c8", label: "Red badge = overdue. Message immediately, then log it" },
      { id: "c9", label: "The Overview tab in the Agency dashboard also shows red flags on overdue clients" },
    ],
  },
];

const CONTACT_COLORS = [
  { color: "var(--success)", label: "Green", detail: "Contacted within 2 days. All good." },
  { color: "var(--warning)", label: "Yellow", detail: "3 days since contact. Message today." },
  { color: "var(--danger)", label: "Red (pulsing)", detail: "4+ days. Overdue — message immediately." },
];

function CheckSection({ section }: { section: Section }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);

  function toggle(id: string) {
    setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const done = checked.size === section.steps.length && section.steps.length > 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${done ? "rgba(61,214,140,0.25)" : "var(--border-default)"}`, transition: "border-color 0.3s" }}>
      <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{section.title}</p>
          {done && <span className="label-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(61,214,140,0.1)", color: "var(--success)", border: "1px solid rgba(61,214,140,0.25)" }}>Done</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="label-mono">{checked.size}/{section.steps.length}</span>
          {open ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {section.steps.map((step, i) => {
            const isDone = checked.has(step.id);
            return (
              <button key={step.id} onClick={() => toggle(step.id)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{ background: isDone ? "rgba(61,214,140,0.04)" : "transparent" }}>
                <div className="mt-0.5 flex-shrink-0" style={{ color: isDone ? "var(--success)" : "var(--text-tertiary)" }}>
                  {isDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                </div>
                <div>
                  <p className="text-sm" style={{ color: isDone ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: isDone ? "line-through" : "none" }}>
                    <span className="label-mono tabular-nums mr-2" style={{ color: isDone ? "var(--text-tertiary)" : "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
                    {step.label}
                  </p>
                  {step.sub && <p className="metric-sub mt-0.5 ml-7">{step.sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportingGuide() {
  const [tab, setTab] = useState<"mw" | "weekly" | "contact">("mw");

  return (
    <div className="p-8 max-w-2xl">
      <style>{`
        @keyframes guideGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .guide-badge { animation: guideGlow 3s ease-in-out infinite; }
      `}</style>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Client Reporting Guide
        </h1>
        <p className="metric-sub">
          Where to click and what to log for each report type.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { id: "mw" as const, label: "M/W Report", icon: <CalendarDays size={13} /> },
          { id: "weekly" as const, label: "Weekly Report", icon: <Clock size={13} /> },
          { id: "contact" as const, label: "Client Contact", icon: <MessageCircle size={13} /> },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium relative"
            style={{ color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            {t.icon}{t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--accent)" }} />}
          </button>
        ))}
      </div>

      {tab === "mw" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-5 rounded-xl px-4 py-3" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.15)" }}>
            <CalendarDays size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <p className="metric-sub">
              Log on <strong style={{ color: "var(--text-primary)" }}>Monday</strong> and <strong style={{ color: "var(--text-primary)" }}>Wednesday</strong> for every active client.
            </p>
          </div>
          {MW_SECTIONS.map((s) => <CheckSection key={s.id} section={s} />)}
          <p className="metric-sub pt-1 px-1">Checkboxes reset on page reload — use as a live walkthrough.</p>
        </div>
      )}

      {tab === "weekly" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-5 rounded-xl px-4 py-3" style={{ background: "rgba(61,214,140,0.06)", border: "1px solid rgba(61,214,140,0.15)" }}>
            <Clock size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
            <p className="metric-sub">
              Log every <strong style={{ color: "var(--text-primary)" }}>Friday</strong> for every active client.
            </p>
          </div>
          {WEEKLY_SECTIONS.map((s) => <CheckSection key={s.id} section={s} />)}
          <p className="metric-sub pt-1 px-1">Checkboxes reset on page reload — use as a live walkthrough.</p>
        </div>
      )}

      {tab === "contact" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-5 rounded-xl px-4 py-3" style={{ background: "rgba(245,185,74,0.06)", border: "1px solid rgba(245,185,74,0.18)" }}>
            <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
            <p className="metric-sub">
              Message every client at least every <strong style={{ color: "var(--text-primary)" }}>3 days</strong>. Log it the same day you message.
            </p>
          </div>

          {CONTACT_SECTIONS.map((s) => <CheckSection key={s.id} section={s} />)}

          {/* Badge legend */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <p className="label-mono">Badge Colors</p>
            {CONTACT_COLORS.map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <span className="guide-badge w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                <span className="label-mono w-28 flex-shrink-0" style={{ color: c.color }}>{c.label}</span>
                <span className="metric-sub">{c.detail}</span>
              </div>
            ))}
          </div>

          <p className="metric-sub pt-1 px-1">Checkboxes reset on page reload — use as a live walkthrough.</p>
        </div>
      )}
    </div>
  );
}
