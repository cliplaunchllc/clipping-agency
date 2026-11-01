"use client";

import { useState } from "react";
import { CheckCircle2, Circle, CalendarDays, Clock, ChevronDown, ChevronRight } from "lucide-react";

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
      { id: "mw2", label: "Click the client's card in the overview" },
      { id: "mw3", label: 'Click the "Mid-Week Reports" tab inside the client view' },
      { id: "mw4", label: 'Click "+ Mid-Week (Tue)"' },
    ],
  },
  {
    id: "mw-fill",
    title: "What to fill in",
    steps: [
      { id: "mw5", label: "Select the active campaign (required)" },
      { id: "mw6", label: "Set the date to today (Tuesday)" },
      { id: "mw7", label: "Enter Views Total and Views Today" },
      { id: "mw8", label: "Enter clip counts: submitted, pending, approved, rejected" },
      { id: "mw9", label: "Enter Amount Spent if available (optional)" },
      { id: "mw10", label: "Write a brief Note — 2 to 3 sentences on momentum, one action, any flags" },
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
      { id: "w2", label: "Click the client's card in the overview" },
      { id: "w3", label: 'Click the "Weekly Reports" tab inside the client view' },
      { id: "w4", label: 'Click "+ New Weekly Report"' },
    ],
  },
  {
    id: "w-fill",
    title: "What to fill in",
    steps: [
      { id: "w5", label: "Select the active campaign (required)" },
      { id: "w6", label: "Set the week date range (Mon – Fri)" },
      { id: "w7", label: "Enter total views and per-platform breakdown (TikTok, Instagram, YouTube, X)" },
      { id: "w8", label: "Enter Paid Out and Budget Remaining" },
      { id: "w9", label: "Enter clips submitted and approved" },
      { id: "w10", label: "Enter Effective CPM if available (optional)" },
      { id: "w11", label: "Write the Weekly Notes — overview, what worked, what didn't, next week focus, client note" },
      { id: "w12", label: "Fill in What's Working, What's Not Working, Next Week Focus fields" },
      { id: "w13", label: 'Hit Save, then click "Publish" to make it visible to the client' },
    ],
  },
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
  const [tab, setTab] = useState<"mw" | "weekly">("mw");

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Reporting Guide
        </h1>
        <p className="metric-sub">
          Step-by-step for each report type. Checkboxes reset on reload — use as a live walkthrough.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { id: "mw" as const, label: "Mid-Week (Tue)", icon: <CalendarDays size={13} /> },
          { id: "weekly" as const, label: "Weekly (Fri)", icon: <Clock size={13} /> },
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
              File every <strong style={{ color: "var(--text-primary)" }}>Tuesday</strong> for every active client. Brief and high-level — 2 to 3 sentences max.
            </p>
          </div>
          {MW_SECTIONS.map((s) => <CheckSection key={s.id} section={s} />)}
        </div>
      )}

      {tab === "weekly" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-5 rounded-xl px-4 py-3" style={{ background: "rgba(61,214,140,0.06)", border: "1px solid rgba(61,214,140,0.15)" }}>
            <Clock size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
            <p className="metric-sub">
              File every <strong style={{ color: "var(--text-primary)" }}>Friday</strong> for every active client. Detailed — full breakdown of the week.
            </p>
          </div>
          {WEEKLY_SECTIONS.map((s) => <CheckSection key={s.id} section={s} />)}
        </div>
      )}
    </div>
  );
}
