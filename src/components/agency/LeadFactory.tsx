"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, X,
  Zap, Mail, AtSign, Link, Globe, User, Play, Square, RotateCcw, Download,
} from "lucide-react";

interface LeadRun {
  id: string;
  prompt: string;
  offer: string | null;
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

// ─── Cost model ──────────────────────────────────────────────────────────────
const COST_PER_LEAD = { bulk: 0.008, deep: 0.032 } as const;

function estimateCost(count: number, mode: string) {
  const rate = COST_PER_LEAD[mode as keyof typeof COST_PER_LEAD] ?? COST_PER_LEAD.bulk;
  return count * rate;
}

function fmtCost(n: number) {
  if (n < 0.01) return "<$0.01";
  return `~$${n.toFixed(2)}`;
}

// ─── Status / grade maps ──────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  pending:     "#94a3b8",
  queued:      "#f59e0b",
  planning:    "#fbbf24",
  discovering: "#818cf8",
  researching: "#60a5fa",
  verifying:   "#f59e0b",
  scoring:     "#a78bfa",
  building:    "#22d3ee",
  completed:   "#3DD68C",
  stopped:     "#64748b",
  failed:      "#FF3B3B",
};

const STATUS_CHIP: Record<string, { bg: string; color: string; border: string }> = {
  pending:     { bg: "rgba(148,163,184,0.1)",  color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  queued:      { bg: "rgba(245,158,11,0.1)",   color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  planning:    { bg: "rgba(251,191,36,0.1)",   color: "#fbbf24", border: "rgba(251,191,36,0.2)" },
  discovering: { bg: "rgba(129,140,248,0.1)",  color: "#818cf8", border: "rgba(129,140,248,0.2)" },
  researching: { bg: "rgba(96,165,250,0.1)",   color: "#60a5fa", border: "rgba(96,165,250,0.2)" },
  verifying:   { bg: "rgba(245,158,11,0.1)",   color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  scoring:     { bg: "rgba(167,139,250,0.1)",  color: "#a78bfa", border: "rgba(167,139,250,0.2)" },
  building:    { bg: "rgba(34,211,238,0.1)",   color: "#22d3ee", border: "rgba(34,211,238,0.2)" },
  completed:   { bg: "rgba(61,255,162,0.08)",  color: "#3DD68C", border: "rgba(61,255,162,0.2)" },
  stopped:     { bg: "rgba(100,116,139,0.1)",  color: "#64748b", border: "rgba(100,116,139,0.2)" },
  failed:      { bg: "rgba(255,59,59,0.1)",    color: "#FF3B3B", border: "rgba(255,59,59,0.2)" },
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function LeadFactory({ initialRuns }: { initialRuns: LeadRun[] }) {
  const [runs, setRuns] = useState<LeadRun[]>(initialRuns);
  const [selectedRun, setSelectedRun] = useState<LeadRun | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // New run form
  const [prompt, setPrompt] = useState("");
  const [offer, setOffer] = useState("");
  const [count, setCount] = useState(25);
  const [mode, setMode] = useState<"bulk" | "deep">("bulk");
  const [runSaving, setRunSaving] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  // ── Polling ────────────────────────────────────────────────────────────────
  const pollRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/agency/lead-factory/${runId}`);
      if (!res.ok) return;
      const updated = await res.json() as LeadRun;
      setRuns((prev) => prev.map((r) => r.id === runId ? updated : r));
      setSelectedRun((prev) => prev?.id === runId ? updated : prev);
      // If run is now active, also refresh leads
      if (ACTIVE_STATUSES.has(updated.status)) {
        const lr = await fetch(`/api/agency/lead-factory/${runId}/leads`);
        if (lr.ok) setLeads(await lr.json());
      }
      // Stop polling when done
      if (!ACTIVE_STATUSES.has(updated.status)) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (["completed", "failed", "stopped"].includes(updated.status)) {
          const lr = await fetch(`/api/agency/lead-factory/${runId}/leads`);
          if (lr.ok) setLeads(await lr.json());
        }
      }
    } catch {
      // network error - just skip this tick
    }
  }, []);

  // Start polling when selected run is active
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (selectedRun && ACTIVE_STATUSES.has(selectedRun.status)) {
      pollRef.current = setInterval(() => pollRun(selectedRun.id), 3000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [selectedRun?.id, selectedRun?.status, pollRun]);

  // New lead form
  const [leadForm, setLeadForm] = useState({
    company: "", website: "", decisionMaker: "", dmRole: "",
    xHandle: "", instagramHandle: "", linkedinUrl: "", dmEmail: "",
    whatItIs: "", grade: "", score: "", segment: "",
  });
  const [leadSaving, setLeadSaving] = useState(false);

  const estCost = estimateCost(count, mode);
  const rateLabel = `$${COST_PER_LEAD[mode].toFixed(3)}/lead`;

  async function loadLeads(run: LeadRun) {
    setSelectedRun(run);
    setLeadsLoading(true);
    setLeads([]);
    try {
      const res = await fetch(`/api/agency/lead-factory/${run.id}/leads`);
      if (res.ok) setLeads(await res.json());
    } finally {
      setLeadsLoading(false);
    }
  }

  async function handleCreateRun() {
    if (!prompt.trim()) return;
    setRunSaving(true);
    const res = await fetch("/api/agency/lead-factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, offer, count, mode }),
    });
    if (res.ok) {
      const run = await res.json();
      setRuns((prev) => [run, ...prev]);
      setPrompt(""); setOffer(""); setCount(25); setMode("bulk");
      setShowNewRun(false); setShowOffer(false);
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

  const chip = (s: string) => STATUS_CHIP[s] ?? STATUS_CHIP.pending;

  return (
    <div className="h-full flex flex-col px-8 py-7 gap-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            Lead Factory
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {runs.length} run{runs.length !== 1 ? "s" : ""} &nbsp;·&nbsp; {runs.reduce((s, r) => s + r.leadCount, 0)} leads
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

      {/* ── New run form ────────────────────────────────────────────────── */}
      {showNewRun && (
        <div className="rounded-2xl flex-shrink-0 overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>

          <div className="px-6 pt-5 pb-4 space-y-4">
            {/* Target prompt */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Target audience
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="e.g. Gaming creators with 100K–2M subscribers focused on FPS content"
                style={{ ...inputStyle, resize: "none" }}
                autoFocus
              />
            </div>

            {/* Offer (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowOffer((v) => !v)}
                className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
              >
                {showOffer ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showOffer ? "Hide offer/pitch" : "Add offer/pitch"}
              </button>
              {showOffer && (
                <textarea
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  rows={2}
                  placeholder="What you're offering these leads…"
                  style={{ ...inputStyle, resize: "none", marginTop: 8 }}
                />
              )}
            </div>

            {/* Count + Mode */}
            <div className="flex items-end gap-4">
              <div style={{ width: 100 }}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  # Leads
                </label>
                <input
                  type="number" min={1} max={200} value={count}
                  onChange={(e) => setCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={inputStyle}
                />
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Mode</label>
                <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {(["bulk", "deep"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className="flex-1 py-2 text-xs font-medium transition-all"
                      style={{
                        background: mode === m ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.03)",
                        color: mode === m ? "var(--accent)" : "var(--text-tertiary)",
                        borderRight: m === "bulk" ? "1px solid rgba(255,255,255,0.08)" : undefined,
                      }}
                    >
                      {m === "bulk" ? "Bulk · fast" : "Deep · thorough"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cost estimate footer */}
          <div className="px-6 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#3DD68C" }} />
                <span className="text-xs font-semibold" style={{ color: "#3DD68C" }}>
                  {fmtCost(estCost)} estimated
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {rateLabel} &nbsp;·&nbsp; {count} lead{count !== 1 ? "s" : ""} &nbsp;·&nbsp; {mode} mode
              </span>
            </div>
            <button
              onClick={handleCreateRun}
              disabled={runSaving || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "rgba(255,59,59,0.15)",
                border: "1px solid rgba(255,59,59,0.3)",
                color: "var(--accent)",
                opacity: runSaving || !prompt.trim() ? 0.4 : 1,
                cursor: runSaving || !prompt.trim() ? "not-allowed" : "pointer",
              }}
            >
              <Zap size={11} />
              {runSaving ? "Creating…" : "Create Run"}
            </button>
          </div>
        </div>
      )}

      {/* ── Body: runs list + leads panel ──────────────────────────────── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Runs sidebar */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto">
          {runs.length === 0 ? (
            <div className="rounded-xl p-5 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <Zap size={18} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No runs yet</p>
            </div>
          ) : (
            runs.map((run) => {
              const dot = STATUS_DOT[run.status] ?? STATUS_DOT.pending;
              const isSelected = selectedRun?.id === run.id;
              const c = chip(run.status);
              const isActive = ACTIVE_STATUSES.has(run.status);
              const canStart = ["pending", "stopped", "failed"].includes(run.status);
              const progress = run.stats ? Math.round(((run.stats.saved ?? 0) / (run.count || 1)) * 100) : 0;
              return (
                <div
                  key={run.id}
                  onClick={() => loadLeads(run)}
                  className="group rounded-xl px-4 py-3 cursor-pointer transition-all"
                  style={{
                    background: isSelected ? "rgba(255,59,59,0.06)" : "var(--bg-surface)",
                    border: `1px solid ${isSelected ? "rgba(255,59,59,0.28)" : "var(--border-default)"}`,
                  }}
                >
                  {/* Status dot + actions */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "animate-pulse" : ""}`}
                        style={{ background: dot }} />
                      <span className="text-xs" style={{ color: c.color }}>{run.status}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {canStart && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartRun(run.id); }}
                          disabled={startingId === run.id}
                          title="Start run"
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                          style={{ color: "#3DD68C" }}
                        >
                          {startingId === run.id ? <RotateCcw size={11} className="animate-spin" /> : <Play size={11} />}
                        </button>
                      )}
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStopRun(run.id); }}
                          disabled={stoppingId === run.id}
                          title="Stop run"
                          className="p-1 rounded transition-opacity hover:bg-white/5"
                          style={{ color: "#f87171" }}
                        >
                          <Square size={11} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                        disabled={deletingId === run.id || isActive}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--text-tertiary)", opacity: isActive ? 0 : undefined }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Prompt */}
                  <p className="text-xs font-medium leading-snug line-clamp-2 mb-2"
                    style={{ color: "var(--text-primary)" }}>
                    {run.prompt}
                  </p>

                  {/* Progress bar (active only) */}
                  {isActive && (
                    <div className="mb-2">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, progress)}%`, background: c.color }} />
                      </div>
                      {run.stage && (
                        <p className="text-xs mt-1 truncate" style={{ color: "var(--text-tertiary)" }}>
                          {run.stage}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-tertiary)" }}>
                      {run.leadCount} lead{run.leadCount !== 1 ? "s" : ""}
                      {run.totalCost > 0 && <span className="ml-1.5 opacity-60">${run.totalCost.toFixed(3)}</span>}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(run.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Leads panel */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>

          {!selectedRun ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <Zap size={22} style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Select a run</p>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: chip(selectedRun.status).bg, color: chip(selectedRun.status).color, border: `1px solid ${chip(selectedRun.status).border}` }}>
                        {selectedRun.status}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {leads.length} lead{leads.length !== 1 ? "s" : ""}
                        &nbsp;·&nbsp; {selectedRun.mode}
                        {selectedRun.totalCost > 0 && <span>&nbsp;·&nbsp; ${selectedRun.totalCost.toFixed(4)} spent</span>}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
                      {selectedRun.prompt}
                    </p>
                    {selectedRun.stage && (
                      <p className="text-xs mt-1" style={{ color: selectedRun.status === "failed" ? "#FF3B3B" : "var(--text-tertiary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {selectedRun.stage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {["pending", "stopped", "failed"].includes(selectedRun.status) && (
                      <button
                        onClick={() => handleStartRun(selectedRun.id)}
                        disabled={startingId === selectedRun.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DD68C" }}
                      >
                        {startingId === selectedRun.id
                          ? <RotateCcw size={11} className="animate-spin" />
                          : <Play size={11} />}
                        {startingId === selectedRun.id ? "Starting…" : "Start Run"}
                      </button>
                    )}
                    {ACTIVE_STATUSES.has(selectedRun.status) && (
                      <button
                        onClick={() => handleStopRun(selectedRun.id)}
                        disabled={stoppingId === selectedRun.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}
                      >
                        <Square size={11} /> Stop
                      </button>
                    )}
                    {!ACTIVE_STATUSES.has(selectedRun.status) && selectedRun.leadCount > 0 && (
                      <a
                        href={`/api/agency/lead-factory/${selectedRun.id}/export`}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                        style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}
                      >
                        <Download size={11} /> Export CSV
                      </a>
                    )}
                    {!ACTIVE_STATUSES.has(selectedRun.status) && (
                      <button
                        onClick={() => setShowAddLead((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                        style={{ background: showAddLead ? "transparent" : "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)" }}
                      >
                        {showAddLead ? <X size={11} /> : <Plus size={11} />}
                        {showAddLead ? "Cancel" : "Add Lead"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Add lead form */}
              {showAddLead && (
                <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.01)" }}>
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
                        <input
                          value={leadForm[key as keyof typeof leadForm]}
                          onChange={(e) => setLeadForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ ...inputStyle, fontSize: 12 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>What it is</label>
                      <input
                        value={leadForm.whatItIs}
                        onChange={(e) => setLeadForm((p) => ({ ...p, whatItIs: e.target.value }))}
                        placeholder="Brief description…"
                        style={{ ...inputStyle, fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Grade</label>
                      <select
                        value={leadForm.grade}
                        onChange={(e) => setLeadForm((p) => ({ ...p, grade: e.target.value }))}
                        style={{ ...inputStyle, fontSize: 12, appearance: "none", cursor: "pointer" }}
                      >
                        <option value="">—</option>
                        {["A", "B", "C", "D", "F"].map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddLead}
                    disabled={leadSaving || !leadForm.company.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)",
                      color: "var(--accent)", opacity: leadSaving || !leadForm.company.trim() ? 0.4 : 1,
                    }}
                  >
                    {leadSaving ? "Adding…" : "Add Lead"}
                  </button>
                </div>
              )}

              {/* Leads list */}
              <div className="flex-1 overflow-y-auto">
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--text-tertiary)" }}>
                    Loading…
                  </div>
                ) : leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-1.5">
                    <User size={18} style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />
                    <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No leads yet</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    {leads.map((lead) => {
                      const g = lead.grade ? GRADE[lead.grade] : null;
                      const isExpanded = expandedLead === lead.id;
                      const dnc = lead.status === "do_not_contact";
                      return (
                        <div key={lead.id}>
                          {/* Lead row */}
                          <div
                            onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                            className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.015]"
                            style={{ opacity: dnc ? 0.5 : 1 }}
                          >
                            {/* Grade */}
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                              style={g
                                ? { background: g.bg, color: g.color, border: `1px solid ${g.border}` }
                                : { background: "rgba(255,255,255,0.04)", color: "var(--text-tertiary)", border: "1px solid rgba(255,255,255,0.06)" }
                              }>
                              {lead.grade ?? "—"}
                            </div>

                            {/* Name + description */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                  {lead.company}
                                </span>
                                {lead.score != null && (
                                  <span className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                                    {lead.score}
                                  </span>
                                )}
                                {dnc && (
                                  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: "rgba(255,59,59,0.08)", color: "var(--accent)", border: "1px solid rgba(255,59,59,0.15)" }}>
                                    DNC
                                  </span>
                                )}
                              </div>
                              {lead.whatItIs && (
                                <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                                  {lead.whatItIs}
                                </p>
                              )}
                            </div>

                            {/* Social icons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {lead.website && (
                                <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: "var(--text-tertiary)" }}>
                                  <Globe size={12} />
                                </a>
                              )}
                              {lead.dmEmail && (
                                <a href={`mailto:${lead.dmEmail}`} onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: "var(--text-tertiary)" }}>
                                  <Mail size={12} />
                                </a>
                              )}
                              {(lead.instagramHandle || lead.xHandle) && (
                                <span className="p-1.5 rounded-lg" style={{ color: "var(--text-tertiary)" }}>
                                  <AtSign size={12} />
                                </span>
                              )}
                              {lead.linkedinUrl && (
                                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: "var(--text-tertiary)" }}>
                                  <Link size={12} />
                                </a>
                              )}
                              <button className="p-1.5 ml-0.5" style={{ color: "var(--text-tertiary)" }}>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="px-5 pb-4 pt-1 mx-5 mb-3 rounded-xl"
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
                                  : { background: "rgba(255,59,59,0.07)", border: "1px solid rgba(255,59,59,0.18)", color: "var(--accent)" }
                                }
                              >
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
