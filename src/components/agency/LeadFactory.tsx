"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, X, Users, Zap } from "lucide-react";

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
  notes: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending:     { bg: "rgba(148,163,184,0.1)",  color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
  planning:    { bg: "rgba(251,191,36,0.1)",   color: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  discovering: { bg: "rgba(99,102,241,0.1)",   color: "#818cf8", border: "rgba(99,102,241,0.25)" },
  researching: { bg: "rgba(59,130,246,0.1)",   color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  verifying:   { bg: "rgba(245,158,11,0.1)",   color: "#f59e0b", border: "rgba(245,158,11,0.25)" },
  scoring:     { bg: "rgba(167,139,250,0.1)",  color: "#a78bfa", border: "rgba(167,139,250,0.25)" },
  building:    { bg: "rgba(34,211,238,0.1)",   color: "#22d3ee", border: "rgba(34,211,238,0.25)" },
  completed:   { bg: "rgba(61,255,162,0.1)",   color: "#3DD68C", border: "rgba(61,255,162,0.25)" },
  stopped:     { bg: "rgba(148,163,184,0.08)", color: "#64748b", border: "rgba(148,163,184,0.2)" },
  failed:      { bg: "rgba(255,59,59,0.1)",    color: "#FF3B3B", border: "rgba(255,59,59,0.25)" },
};

const GRADE_COLORS: Record<string, { color: string; bg: string }> = {
  A: { color: "#3DD68C", bg: "rgba(61,214,140,0.12)" },
  B: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  C: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  D: { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  F: { color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

export default function LeadFactory({ initialRuns }: { initialRuns: LeadRun[] }) {
  const [runs, setRuns] = useState<LeadRun[]>(initialRuns);
  const [selectedRun, setSelectedRun] = useState<LeadRun | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New run form
  const [prompt, setPrompt] = useState("");
  const [offer, setOffer] = useState("");
  const [count, setCount] = useState(25);
  const [mode, setMode] = useState("deep");
  const [runSaving, setRunSaving] = useState(false);

  // New lead form
  const [leadForm, setLeadForm] = useState({ company: "", website: "", decisionMaker: "", dmRole: "", xHandle: "", instagramHandle: "", linkedinUrl: "", dmEmail: "", whatItIs: "", grade: "", score: "", segment: "" });
  const [leadSaving, setLeadSaving] = useState(false);

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
      setPrompt(""); setOffer(""); setCount(25); setMode("deep");
      setShowNewRun(false);
    }
    setRunSaving(false);
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
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
    }
  }

  const statusStyle = (s: string) => STATUS_COLORS[s] ?? STATUS_COLORS.pending;

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Lead Factory</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{runs.length} run{runs.length !== 1 ? "s" : ""} · {runs.reduce((s, r) => s + r.leadCount, 0)} total leads</p>
        </div>
        <button
          onClick={() => setShowNewRun(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent)" }}
        >
          <Plus size={14} />
          New Run
        </button>
      </div>

      {/* New Run Form */}
      {showNewRun && (
        <div className="rounded-xl p-6 mb-6 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Lead Run</p>
            <button onClick={() => setShowNewRun(false)}><X size={15} color="var(--text-tertiary)" /></button>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Target Criteria / Prompt *</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              placeholder="e.g. Gaming YouTubers with 100K–2M subs focused on FPS games" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Offer / Pitch (optional)</label>
            <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={2}
              placeholder="What you're offering these leads..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Lead Count</label>
              <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 25)} style={inputStyle} />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                <option value="deep">Deep (detailed research)</option>
                <option value="bulk">Bulk (fast, less detail)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleCreateRun} disabled={runSaving || !prompt.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent)", opacity: runSaving || !prompt.trim() ? 0.5 : 1, cursor: runSaving || !prompt.trim() ? "not-allowed" : "pointer" }}>
              {runSaving ? "Creating..." : "Create Run"}
            </button>
            <button onClick={() => setShowNewRun(false)} className="px-4 py-2 rounded-xl text-sm"
              style={{ color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border-default)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Runs list */}
        <div className="w-72 flex-shrink-0 space-y-2">
          {runs.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <Zap size={24} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No runs yet. Create your first lead run.</p>
            </div>
          )}
          {runs.map((run) => {
            const s = statusStyle(run.status);
            const isSelected = selectedRun?.id === run.id;
            return (
              <div
                key={run.id}
                onClick={() => loadLeads(run)}
                className="rounded-xl p-4 cursor-pointer transition-all"
                style={{
                  background: isSelected ? "rgba(255,59,59,0.06)" : "var(--bg-surface)",
                  border: `1px solid ${isSelected ? "rgba(255,59,59,0.3)" : "var(--border-default)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium line-clamp-2" style={{ color: "var(--text-primary)" }}>{run.prompt}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                    disabled={deletingId === run.id}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {run.status}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <Users size={10} className="inline mr-1" />{run.leadCount}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {run.mode}
                  </span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(run.createdAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Leads panel */}
        <div className="flex-1 min-w-0">
          {!selectedRun ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              <Users size={32} className="mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Select a run to view its leads</p>
            </div>
          ) : (
            <div className="rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
              {/* Run header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-default)" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedRun.prompt}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {leads.length} lead{leads.length !== 1 ? "s" : ""}
                    {selectedRun.offer && <span className="ml-2 opacity-60">· {selectedRun.offer.slice(0, 40)}{selectedRun.offer.length > 40 ? "…" : ""}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)", color: "var(--accent)" }}
                >
                  <Plus size={12} />
                  Add Lead
                </button>
              </div>

              {/* Add lead form */}
              {showAddLead && (
                <div className="px-6 py-4 space-y-3" style={{ borderBottom: "1px solid var(--border-default)", background: "rgba(255,255,255,0.01)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>New Lead</p>
                    <button onClick={() => setShowAddLead(false)}><X size={13} color="var(--text-tertiary)" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Company *</label>
                      <input value={leadForm.company} onChange={(e) => setLeadForm((p) => ({ ...p, company: e.target.value }))} style={inputStyle} placeholder="Acme Corp" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Website</label>
                      <input value={leadForm.website} onChange={(e) => setLeadForm((p) => ({ ...p, website: e.target.value }))} style={inputStyle} placeholder="acme.com" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Decision Maker</label>
                      <input value={leadForm.decisionMaker} onChange={(e) => setLeadForm((p) => ({ ...p, decisionMaker: e.target.value }))} style={inputStyle} placeholder="Jane Smith" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Role</label>
                      <input value={leadForm.dmRole} onChange={(e) => setLeadForm((p) => ({ ...p, dmRole: e.target.value }))} style={inputStyle} placeholder="CMO" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                      <input value={leadForm.dmEmail} onChange={(e) => setLeadForm((p) => ({ ...p, dmEmail: e.target.value }))} style={inputStyle} placeholder="jane@acme.com" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Instagram</label>
                      <input value={leadForm.instagramHandle} onChange={(e) => setLeadForm((p) => ({ ...p, instagramHandle: e.target.value }))} style={inputStyle} placeholder="@acme" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>X / Twitter</label>
                      <input value={leadForm.xHandle} onChange={(e) => setLeadForm((p) => ({ ...p, xHandle: e.target.value }))} style={inputStyle} placeholder="@acme" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Grade</label>
                      <select value={leadForm.grade} onChange={(e) => setLeadForm((p) => ({ ...p, grade: e.target.value }))} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                        <option value="">—</option>
                        {["A", "B", "C", "D", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>What It Is</label>
                    <textarea value={leadForm.whatItIs} onChange={(e) => setLeadForm((p) => ({ ...p, whatItIs: e.target.value }))} rows={2}
                      style={{ ...inputStyle, resize: "vertical" }} placeholder="Brief description of this company..." />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddLead} disabled={leadSaving || !leadForm.company.trim()}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "var(--accent)", opacity: leadSaving || !leadForm.company.trim() ? 0.5 : 1 }}>
                      {leadSaving ? "Adding..." : "Add Lead"}
                    </button>
                    <button onClick={() => setShowAddLead(false)} className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Leads list */}
              {leadsLoading ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>Loading leads…</div>
              ) : leads.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No leads in this run yet.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  {leads.map((lead) => {
                    const gradeStyle = lead.grade ? (GRADE_COLORS[lead.grade] ?? {}) : {};
                    const isExpanded = expandedLead === lead.id;
                    return (
                      <div key={lead.id}>
                        <div
                          className="flex items-center gap-3 px-6 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                          onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                        >
                          {lead.grade && (
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: (gradeStyle as { bg?: string }).bg, color: (gradeStyle as { color?: string }).color }}>
                              {lead.grade}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lead.company}</span>
                              {lead.score != null && (
                                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{lead.score}/100</span>
                              )}
                              {lead.status === "do_not_contact" && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,59,59,0.1)", color: "var(--accent)", border: "1px solid rgba(255,59,59,0.2)" }}>DNC</span>
                              )}
                            </div>
                            {lead.whatItIs && (
                              <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{lead.whatItIs}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {lead.website && (
                              <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--text-tertiary)" }}>
                                <ExternalLink size={13} />
                              </a>
                            )}
                            {isExpanded ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-6 pb-4 pt-1" style={{ background: "rgba(255,255,255,0.01)" }}>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mb-3">
                              {lead.decisionMaker && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>Contact: </span><span style={{ color: "var(--text-primary)" }}>{lead.decisionMaker}{lead.dmRole ? ` · ${lead.dmRole}` : ""}</span></div>
                              )}
                              {lead.dmEmail && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>Email: </span><span style={{ color: "var(--text-primary)" }}>{lead.dmEmail}</span></div>
                              )}
                              {lead.instagramHandle && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>Instagram: </span><span style={{ color: "var(--text-primary)" }}>{lead.instagramHandle}</span></div>
                              )}
                              {lead.xHandle && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>X: </span><span style={{ color: "var(--text-primary)" }}>{lead.xHandle}</span></div>
                              )}
                              {lead.linkedinUrl && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>LinkedIn: </span>
                                  <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>View</a>
                                </div>
                              )}
                              {lead.segment && (
                                <div><span style={{ color: "var(--text-tertiary)" }}>Segment: </span><span style={{ color: "var(--text-primary)" }}>{lead.segment}</span></div>
                              )}
                            </div>
                            {lead.notes && (
                              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
                            )}
                            <div className="flex gap-2">
                              {lead.status === "active" ? (
                                <button onClick={() => handleLeadStatus(lead.id, "do_not_contact")}
                                  className="text-xs px-3 py-1 rounded-lg"
                                  style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)", color: "var(--accent)" }}>
                                  Mark DNC
                                </button>
                              ) : (
                                <button onClick={() => handleLeadStatus(lead.id, "active")}
                                  className="text-xs px-3 py-1 rounded-lg"
                                  style={{ background: "rgba(61,255,162,0.08)", border: "1px solid rgba(61,255,162,0.2)", color: "#3DD68C" }}>
                                  Mark Active
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
