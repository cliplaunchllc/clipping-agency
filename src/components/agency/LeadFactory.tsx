"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, X,
  Zap, Mail, AtSign, Link, Globe, User, Play, Square, RotateCcw, Download,
} from "lucide-react";

interface RunLog {
  id: string;
  stage: string;
  message: string;
  level: string;
  createdAt: string;
}

interface LeadRun {
  id: string;
  prompt: string;
  offer: string | null;
  criteria: string | null;
  count: number;
  mode: string;
  status: string;
  stage: string | null;
  totalCost: number;
  testMode: boolean;
  stats: Record<string, number> | null;
  leadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Lead {
  id: string;
  runId: string;
  num: number;
  grade: string | null;
  score: number | null;
  segment: string | null;
  company: string;
  website: string;
  whatItIs: string | null;
  decisionMaker: string | null;
  dmRole: string | null;
  xHandle: string | null;
  instagramHandle: string | null;
  linkedinUrl: string | null;
  dmEmail: string | null;
  status: string;
  createdAt: string;
}

const COST_PER_LEAD = { bulk: 0.008, deep: 0.032 } as const;
function estimateCost(count: number) { return count * COST_PER_LEAD.bulk; }
function fmtCost(n: number) { return n < 0.01 ? "<$0.01" : `~$${n.toFixed(2)}`; }

const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8", queued: "#f59e0b", planning: "#fbbf24",
  discovering: "#818cf8", researching: "#60a5fa", verifying: "#f59e0b",
  scoring: "#a78bfa", building: "#22d3ee",
  completed: "#3DD68C", stopped: "#64748b", failed: "#FF3B3B",
};

const GRADE: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: "#3DD68C", bg: "rgba(61,214,140,0.1)",  border: "rgba(61,214,140,0.25)" },
  B: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)" },
  C: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" },
  D: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  F: { color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)" },
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "9px 13px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

const ACTIVE_STATUSES = new Set(["queued", "planning", "discovering", "researching", "verifying", "scoring", "building"]);

export default function LeadFactory({ initialRuns }: { initialRuns: LeadRun[] }) {
  const [runs, setRuns] = useState<LeadRun[]>(initialRuns);
  const [selectedRun, setSelectedRun] = useState<LeadRun | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showCriteriaPanel, setShowCriteriaPanel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [criteria, setCriteria] = useState("");
  const [count, setCount] = useState(25);
  const [runSaving, setRunSaving] = useState(false);

  const [leadForm, setLeadForm] = useState({
    company: "", website: "", decisionMaker: "", dmRole: "",
    xHandle: "", instagramHandle: "", linkedinUrl: "", dmEmail: "",
    whatItIs: "", grade: "", score: "", segment: "",
  });
  const [leadSaving, setLeadSaving] = useState(false);

  const pollRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/agency/lead-factory/${runId}`);
      if (!res.ok) return;
      const updated = await res.json() as LeadRun;
      setRuns((prev) => prev.map((r) => r.id === runId ? updated : r));
      setSelectedRun((prev) => prev?.id === runId ? updated : prev);
      if (ACTIVE_STATUSES.has(updated.status)) {
        const lr = await fetch(`/api/agency/lead-factory/${runId}/leads`);
        if (lr.ok) setLeads(await lr.json());
      }
      if (!ACTIVE_STATUSES.has(updated.status)) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (["completed", "failed", "stopped"].includes(updated.status)) {
          const [lr, ll] = await Promise.all([
            fetch(`/api/agency/lead-factory/${runId}/leads`),
            fetch(`/api/agency/lead-factory/${runId}/logs`),
          ]);
          if (lr.ok) setLeads(await lr.json());
          if (ll.ok) setLogs(await ll.json());
        }
      }
    } catch { /* skip */ }
  }, []);

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (selectedRun && ACTIVE_STATUSES.has(selectedRun.status)) {
      pollRef.current = setInterval(() => pollRun(selectedRun.id), 3000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [selectedRun?.id, selectedRun?.status, pollRun]);

  async function loadLeads(run: LeadRun) {
    setSelectedRun(run);
    setLeadsLoading(true);
    setLeads([]); setLogs([]);
    setShowCriteriaPanel(false); setShowAddLead(false);
    try {
      const [lr, ll] = await Promise.all([
        fetch(`/api/agency/lead-factory/${run.id}/leads`),
        fetch(`/api/agency/lead-factory/${run.id}/logs`),
      ]);
      if (lr.ok) setLeads(await lr.json());
      if (ll.ok) setLogs(await ll.json());
    } finally { setLeadsLoading(false); }
  }

  async function handleCreateRun() {
    setRunSaving(true);
    const res = await fetch("/api/agency/lead-factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, count, mode: "bulk" }),
    });
    if (res.ok) {
      const run = await res.json();
      setRuns((prev) => [run, ...prev]);
      setCriteria(""); setCount(25); setShowNewRun(false);
    }
    setRunSaving(false);
  }

  async function handleStartRun(id: string) {
    setStartingId(id);
    const res = await fetch(`/api/agency/lead-factory/${id}/start`, { method: "POST" });
    if (res.ok) {
      const updated = await fetch(`/api/agency/lead-factory/${id}`).then((r) => r.json()) as LeadRun;
      setRuns((prev) => prev.map((r) => r.id === id ? updated : r));
      if (selectedRun?.id === id) setSelectedRun(updated);
    }
    setStartingId(null);
  }

  async function handleStopRun(id: string) {
    setStoppingId(id);
    const res = await fetch(`/api/agency/lead-factory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    if (res.ok) {
      const updated = await res.json() as LeadRun;
      setRuns((prev) => prev.map((r) => r.id === id ? updated : r));
      if (selectedRun?.id === id) setSelectedRun(updated);
    }
    setStoppingId(null);
  }

  async function handleDeleteRun(id: string) {
    if (!confirm("Delete this run and all its leads?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/agency/lead-factory/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRuns((prev) => prev.filter((r) => r.id !== id));
      if (selectedRun?.id === id) { setSelectedRun(null); setLeads([]); }
    }
    setDeletingId(null);
  }

  async function handleAddLead() {
    if (!selectedRun || !leadForm.company.trim()) return;
    setLeadSaving(true);
    const res = await fetch(`/api/agency/lead-factory/${selectedRun.id}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...leadForm, score: leadForm.score ? parseInt(leadForm.score) : null }),
    });
    if (res.ok) {
      const lead = await res.json();
      setLeads((prev) => [lead, ...prev]);
      setRuns((prev) => prev.map((r) => r.id === selectedRun.id ? { ...r, leadCount: r.leadCount + 1 } : r));
      setLeadForm({ company: "", website: "", decisionMaker: "", dmRole: "", xHandle: "", instagramHandle: "", linkedinUrl: "", dmEmail: "", whatItIs: "", grade: "", score: "", segment: "" });
      setShowAddLead(false);
    }
    setLeadSaving(false);
  }

  async function handleLeadStatus(leadId: string, status: string) {
    const res = await fetch(`/api/agency/lead-factory/${selectedRun!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, status }),
    });
    if (res.ok) setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
  }

  const isActive = (run: LeadRun) => ACTIVE_STATUSES.has(run.status);
  const canStart = (run: LeadRun) => ["pending", "stopped", "failed"].includes(run.status);

  return (
    <div className="h-full flex flex-col px-8 py-7 gap-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            Lead Factory
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {runs.length} run{runs.length !== 1 ? "s" : ""} · {runs.reduce((s, r) => s + r.leadCount, 0)} leads
          </p>
        </div>
        <button
          onClick={() => setShowNewRun((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)", color: "var(--accent)" }}
        >
          {showNewRun ? <X size={13} /> : <Plus size={13} />}
          {showNewRun ? "Cancel" : "New Run"}
        </button>
      </div>

      {/* ── New run form ─────────────────────────────────────────────────────── */}
      {showNewRun && (
        <div className="rounded-2xl flex-shrink-0 overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div className="px-6 pt-5 pb-4 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Criteria</label>
              <textarea
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                rows={3}
                placeholder="e.g. must have active downloads, backed by VC, has instagram, min 100k subscribers…"
                style={{ ...inputStyle, resize: "none" }}
                autoFocus
              />
              {criteria.trim() && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([
                    [/download|install|app store/i, "active downloads"],
                    [/vc|funded|investor|capital|backed/i, "VC-backed"],
                    [/instagram|social/i, "social presence"],
                    [/linkedin|b2b|professional/i, "LinkedIn"],
                    [/subscriber|youtube|creator/i, "YouTube boost"],
                    [/roblox/i, "Roblox focus"],
                    [/active|engagement|popular/i, "high engagement"],
                    [/indie|small.{0,15}(company|studio|dev)|not.{0,15}(big|large)|no.{0,15}(big|large)/i, "indie/small"],
                    [/must have email|require email/i, "email required"],
                    [/must have instagram|require instagram/i, "Instagram required"],
                  ] as [RegExp, string][]).filter(([rx]) => rx.test(criteria)).map(([, label]) => (
                    <span key={label} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.2)", color: "#3DD68C" }}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ width: 120 }}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}># Leads</label>
              <input
                type="number" min={1} max={200} value={count}
                onChange={(e) => setCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="px-6 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span style={{ color: "#3DD68C", fontWeight: 600 }}>{fmtCost(estimateCost(count))}</span>
              &nbsp;· {count} lead{count !== 1 ? "s" : ""}
            </span>
            <button
              onClick={handleCreateRun}
              disabled={runSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent)",
                opacity: runSaving ? 0.4 : 1, cursor: runSaving ? "not-allowed" : "pointer",
              }}
            >
              <Zap size={11} />
              {runSaving ? "Creating…" : "Create Run"}
            </button>
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto">
          {runs.length === 0 ? (
            <div className="rounded-xl p-5 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <Zap size={18} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No runs yet</p>
            </div>
          ) : runs.map((run) => {
            const color = STATUS_COLOR[run.status] ?? STATUS_COLOR.pending;
            const active = isActive(run);
            const selected = selectedRun?.id === run.id;
            const progress = run.stats ? Math.round(((run.stats.saved ?? 0) / (run.count || 1)) * 100) : 0;
            return (
              <div
                key={run.id}
                onClick={() => loadLeads(run)}
                className="group rounded-xl px-3.5 py-3 cursor-pointer transition-all"
                style={{
                  background: selected ? "rgba(255,59,59,0.06)" : "var(--bg-surface)",
                  border: `1px solid ${selected ? "rgba(255,59,59,0.28)" : "var(--border-default)"}`,
                }}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "animate-pulse" : ""}`}
                      style={{ background: color }} />
                    <span className="text-xs font-medium truncate" style={{ color }}>{run.status}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {canStart(run) && (
                      <button onClick={(e) => { e.stopPropagation(); handleStartRun(run.id); }}
                        disabled={startingId === run.id}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                        style={{ color: "#3DD68C" }}>
                        {startingId === run.id ? <RotateCcw size={11} className="animate-spin" /> : <Play size={11} />}
                      </button>
                    )}
                    {active && (
                      <button onClick={(e) => { e.stopPropagation(); handleStopRun(run.id); }}
                        disabled={stoppingId === run.id}
                        className="p-1 rounded hover:bg-white/5"
                        style={{ color: "#f87171" }}>
                        <Square size={11} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                      disabled={deletingId === run.id || active}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                      style={{ color: "var(--text-tertiary)" }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Criteria preview */}
                <p className="text-xs leading-snug line-clamp-2 mb-2" style={{ color: "var(--text-primary)" }}>
                  {run.criteria || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>No criteria</span>}
                </p>

                {/* Active: slim progress bar */}
                {active && (
                  <div className="mb-2">
                    <div className="h-0.5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(3, progress)}%`, background: color }} />
                    </div>
                    {run.stage && (
                      <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{run.stage}</p>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between">
                  <span className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    {run.leadCount} lead{run.leadCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(run.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>

          {!selectedRun ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <Zap size={22} style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Select a run</p>
            </div>
          ) : (
            <>
              {/* ── Panel top bar ─────────────────────────────────────────────── */}
              <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}>

                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive(selectedRun) ? "animate-pulse" : ""}`}
                  style={{ background: STATUS_COLOR[selectedRun.status] ?? STATUS_COLOR.pending }} />

                {/* Criteria — truncated, click to expand */}
                <button
                  onClick={() => setShowCriteriaPanel((v) => !v)}
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-left group"
                >
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {selectedRun.criteria || "No criteria"}
                  </span>
                  {selectedRun.criteria && (
                    <span className="flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity">
                      {showCriteriaPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  )}
                </button>

                {/* Lead count */}
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {leads.length} / {selectedRun.count}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {canStart(selectedRun) && (
                    <button onClick={() => handleStartRun(selectedRun.id)} disabled={startingId === selectedRun.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DD68C" }}>
                      {startingId === selectedRun.id ? <RotateCcw size={10} className="animate-spin" /> : <Play size={10} />}
                      {startingId === selectedRun.id ? "Starting…" : "Start"}
                    </button>
                  )}
                  {isActive(selectedRun) && (
                    <button onClick={() => handleStopRun(selectedRun.id)} disabled={stoppingId === selectedRun.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                      <Square size={10} /> Stop
                    </button>
                  )}
                  {!isActive(selectedRun) && selectedRun.leadCount > 0 && (
                    <a href={`/api/agency/lead-factory/${selectedRun.id}/export`} download
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
                      <Download size={10} /> Export
                    </a>
                  )}
                  {!isActive(selectedRun) && (
                    <button onClick={() => setShowAddLead((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.18)", color: "var(--accent)" }}>
                      {showAddLead ? <X size={10} /> : <Plus size={10} />}
                      {showAddLead ? "Cancel" : "Add"}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Criteria dropdown (outside top bar so it's not clipped) ──── */}
              {showCriteriaPanel && selectedRun.criteria && (
                <div className="flex-shrink-0 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.015)" }}>
                  <p className="text-xs leading-relaxed" style={{
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 160,
                    overflowY: "auto",
                  }}>
                    {selectedRun.criteria}
                  </p>
                </div>
              )}

              {/* ── Active run progress bar ───────────────────────────────────── */}
              {isActive(selectedRun) && (() => {
                const progress = selectedRun.stats
                  ? Math.round(((selectedRun.stats.saved ?? 0) / (selectedRun.count || 1)) * 100)
                  : 0;
                const color = STATUS_COLOR[selectedRun.status] ?? STATUS_COLOR.discovering;
                return (
                  <div className="flex-shrink-0 px-5 py-2.5 flex items-center gap-3"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(3, progress)}%`, background: color }} />
                    </div>
                    <span className="text-xs flex-shrink-0 tabular-nums" style={{ color }}>
                      {selectedRun.stats?.saved ?? 0} / {selectedRun.count}
                    </span>
                    {selectedRun.stage && (
                      <span className="text-xs flex-shrink-0 max-w-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                        {selectedRun.stage}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* ── Failed: error message ─────────────────────────────────────── */}
              {selectedRun.status === "failed" && selectedRun.stage && (
                <div className="flex-shrink-0 px-5 py-2.5" style={{ borderBottom: "1px solid rgba(255,59,59,0.12)", background: "rgba(255,59,59,0.04)" }}>
                  <p className="text-xs" style={{ color: "#FF3B3B", wordBreak: "break-word" }}>{selectedRun.stage}</p>
                  {logs.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                      {logs.map((l) => (
                        <div key={l.id} className="flex gap-2 text-xs">
                          <span className="flex-shrink-0 font-mono opacity-50" style={{ color: l.level === "error" ? "#FF3B3B" : "var(--text-tertiary)" }}>
                            [{l.stage}]
                          </span>
                          <span style={{ color: l.level === "error" ? "#FF3B3B" : "var(--text-secondary)", wordBreak: "break-word" }}>
                            {l.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Add lead form ─────────────────────────────────────────────── */}
              {showAddLead && (
                <div className="flex-shrink-0 px-5 py-4"
                  style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { key: "company", label: "Company *", placeholder: "Acme Corp" },
                      { key: "website", label: "Website", placeholder: "acme.com" },
                      { key: "decisionMaker", label: "Contact", placeholder: "Jane Smith" },
                      { key: "dmRole", label: "Role", placeholder: "CMO" },
                      { key: "dmEmail", label: "Email", placeholder: "jane@acme.com" },
                      { key: "instagramHandle", label: "Instagram", placeholder: "@acme" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</label>
                        <input value={leadForm[key as keyof typeof leadForm]}
                          onChange={(e) => setLeadForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder} style={{ ...inputStyle, fontSize: 12 }} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>What it is</label>
                      <input value={leadForm.whatItIs}
                        onChange={(e) => setLeadForm((p) => ({ ...p, whatItIs: e.target.value }))}
                        placeholder="Brief description…" style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Grade</label>
                      <select value={leadForm.grade}
                        onChange={(e) => setLeadForm((p) => ({ ...p, grade: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, appearance: "none", cursor: "pointer" }}>
                        <option value="">—</option>
                        {["A","B","C","D","F"].map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleAddLead} disabled={leadSaving || !leadForm.company.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)",
                      color: "var(--accent)", opacity: leadSaving || !leadForm.company.trim() ? 0.4 : 1 }}>
                    {leadSaving ? "Adding…" : "Add Lead"}
                  </button>
                </div>
              )}

              {/* ── Leads list ───────────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--text-tertiary)" }}>Loading…</div>
                ) : leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-1.5">
                    <User size={18} style={{ color: "var(--text-tertiary)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                      {isActive(selectedRun) ? "Finding leads…" : "No leads yet"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    {leads.map((lead) => {
                      const g = lead.grade ? GRADE[lead.grade] : null;
                      const isExpanded = expandedLead === lead.id;
                      const dnc = lead.status === "do_not_contact";
                      return (
                        <div key={lead.id}>
                          <div
                            onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                            className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.015]"
                            style={{ opacity: dnc ? 0.5 : 1 }}
                          >
                            {/* Grade badge */}
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                              style={g
                                ? { background: g.bg, color: g.color, border: `1px solid ${g.border}` }
                                : { background: "rgba(255,255,255,0.04)", color: "var(--text-tertiary)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              {lead.grade ?? "—"}
                            </div>

                            {/* Name + desc */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lead.company}</span>
                                {lead.score != null && (
                                  <span className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>{lead.score}</span>
                                )}
                                {dnc && (
                                  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: "rgba(255,59,59,0.08)", color: "var(--accent)", border: "1px solid rgba(255,59,59,0.15)" }}>
                                    DNC
                                  </span>
                                )}
                              </div>
                              {lead.whatItIs && (
                                <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>{lead.whatItIs}</p>
                              )}
                            </div>

                            {/* Icons */}
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {lead.website && (
                                <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                  target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-tertiary)" }}>
                                  <Globe size={12} />
                                </a>
                              )}
                              {lead.dmEmail && (
                                <a href={`mailto:${lead.dmEmail}`} onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-tertiary)" }}>
                                  <Mail size={12} />
                                </a>
                              )}
                              {(lead.instagramHandle || lead.xHandle) && (
                                <span className="p-1.5 rounded-lg" style={{ color: "var(--text-tertiary)" }}>
                                  <AtSign size={12} />
                                </span>
                              )}
                              {lead.linkedinUrl && (
                                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text-tertiary)" }}>
                                  <Link size={12} />
                                </a>
                              )}
                              <span className="p-1.5" style={{ color: "var(--text-tertiary)" }}>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </span>
                            </div>
                          </div>

                          {/* Expanded */}
                          {isExpanded && (
                            <div className="px-5 pb-4 pt-0.5 mx-5 mb-3 rounded-xl"
                              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mt-3 mb-3">
                                {lead.decisionMaker && (
                                  <div className="flex items-center gap-1.5">
                                    <User size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    <span style={{ color: "var(--text-primary)" }}>{lead.decisionMaker}</span>
                                    {lead.dmRole && <span style={{ color: "var(--text-tertiary)" }}>· {lead.dmRole}</span>}
                                  </div>
                                )}
                                {lead.dmEmail && (
                                  <div className="flex items-center gap-1.5">
                                    <Mail size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    <span style={{ color: "var(--text-primary)" }}>{lead.dmEmail}</span>
                                  </div>
                                )}
                                {lead.instagramHandle && (
                                  <div className="flex items-center gap-1.5">
                                    <AtSign size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    <span style={{ color: "var(--text-primary)" }}>{lead.instagramHandle}</span>
                                    <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>ig</span>
                                  </div>
                                )}
                                {lead.xHandle && (
                                  <div className="flex items-center gap-1.5">
                                    <AtSign size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    <span style={{ color: "var(--text-primary)" }}>{lead.xHandle}</span>
                                    <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>x</span>
                                  </div>
                                )}
                                {lead.linkedinUrl && (
                                  <div className="flex items-center gap-1.5">
                                    <Link size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                    <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1" style={{ color: "#60a5fa" }}>
                                      LinkedIn <ExternalLink size={9} />
                                    </a>
                                  </div>
                                )}
                                {lead.segment && (
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ color: "var(--text-tertiary)" }}>Segment:</span>
                                    <span style={{ color: "var(--text-primary)" }}>{lead.segment}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleLeadStatus(lead.id, dnc ? "active" : "do_not_contact")}
                                className="text-xs px-3 py-1 rounded-lg font-medium"
                                style={dnc
                                  ? { background: "rgba(61,255,162,0.08)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DD68C" }
                                  : { background: "rgba(255,59,59,0.07)", border: "1px solid rgba(255,59,59,0.18)", color: "var(--accent)" }}>
                                {dnc ? "Remove DNC" : "Mark DNC"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
