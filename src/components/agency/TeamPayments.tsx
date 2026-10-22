"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Check, X, Edit2, DollarSign, Bell, CalendarClock, BadgeCheck, ChevronDown, ChevronUp, Calculator } from "lucide-react";

export interface CommissionEntry {
  id: string;
  campaignName: string;
  budget: number;
  commission: number;
}

interface Member {
  id: string;
  name: string;
  role: string | null;
  category: string;
  payRate: number | null;
  payFrequency: string | null;
  lastPaidAt: string | null;
  nextPaymentDue: string | null;
  notes: string | null;
  basePay: number | null;
  commissions: CommissionEntry[] | null;
}

interface Props {
  initialMembers: Member[];
}

const CATEGORIES = [
  { id: "head_campaign",    label: "Head of Campaign Management", color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)" },
  { id: "campaign_manager", label: "Campaign Managers",           color: "var(--accent)", bg: "var(--accent-muted)", border: "var(--accent-border)" },
  { id: "va",               label: "VAs",                         color: "#38bdf8",  bg: "rgba(56,189,248,0.1)",  border: "rgba(56,189,248,0.25)" },
  { id: "discord_mod",      label: "Discord Moderators",          color: "#f472b6",  bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.25)" },
  { id: "freelance",        label: "Freelance Work",              color: "#f59e0b",  bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
];

const FREQ_OPTIONS = [
  { value: "monthly",  label: "Monthly"  },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "weekly",   label: "Weekly"   },
  { value: "one_time", label: "One-Time" },
];

const COMMISSION_RATE = 0.025;

// ── Commission calculator — module-level so React never remounts it ──────────
function CommissionCalculator({
  list,
  setList,
  basePay,
  setBasePay,
}: {
  list: CommissionEntry[];
  setList: (v: CommissionEntry[]) => void;
  basePay: string;
  setBasePay: (v: string) => void;
}) {
  const commissionTotal = list.reduce((s, c) => s + c.commission, 0);
  const baseNum = parseFloat(basePay) || 0;
  const grandTotal = baseNum + commissionTotal;

  function addRow() {
    setList([...list, { id: Math.random().toString(36).slice(2, 10), campaignName: "", budget: 0, commission: 0 }]);
  }

  function updateRow(id: string, field: "campaignName" | "budget", value: string) {
    setList(list.map((c) => {
      if (c.id !== id) return c;
      const budget = field === "budget" ? (parseFloat(value) || 0) : c.budget;
      return { ...c, [field]: field === "budget" ? budget : value, commission: budget * COMMISSION_RATE };
    }));
  }

  function removeRow(id: string) {
    setList(list.filter((c) => c.id !== id));
  }

  return (
    <div className="rounded-xl overflow-hidden mt-1"
      style={{ border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.04)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(167,139,250,0.2)" }}>
        <div className="flex items-center gap-2">
          <Calculator size={13} style={{ color: "#a78bfa" }} />
          <span className="text-xs font-semibold" style={{ color: "#a78bfa" }}>Commission Calculator</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
            2.5% per campaign
          </span>
        </div>
        <button type="button" onClick={addRow}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
          <Plus size={10} /> Add Campaign
        </button>
      </div>

      {/* Base pay row */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="label-mono mb-1 block" style={{ fontSize: 10 }}>Base Pay ($/mo)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={basePay}
              onChange={(e) => setBasePay(e.target.value)}
              placeholder="e.g. 1000"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div className="flex-1">
            <p className="label-mono mb-1" style={{ fontSize: 10 }}>Base Amount</p>
            <div className="flex items-center px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-default)", height: 30 }}>
              <span className="text-xs tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                {baseNum > 0 ? fmtUSD(baseNum) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      {list.length > 0 && (
        <div className="mx-4 mb-2" style={{ borderTop: "1px solid rgba(167,139,250,0.15)" }} />
      )}

      {/* Campaign rows */}
      {list.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 140px 110px 28px" }}>
            <span className="label-mono" style={{ fontSize: 10 }}>Campaign Name</span>
            <span className="label-mono" style={{ fontSize: 10 }}>Budget ($)</span>
            <span className="label-mono" style={{ fontSize: 10 }}>Commission (2.5%)</span>
            <span />
          </div>

          {list.map((c) => (
            <div key={c.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 140px 110px 28px" }}>
              <input
                value={c.campaignName}
                onChange={(e) => updateRow(c.id, "campaignName", e.target.value)}
                placeholder="e.g. Nike Summer 2025"
                style={{ ...inputStyle, width: "100%" }}
              />
              <input
                type="number" min={0} step={100}
                value={c.budget || ""}
                onChange={(e) => updateRow(c.id, "budget", e.target.value)}
                placeholder="50000"
                style={{ ...inputStyle, width: "100%" }}
              />
              <div className="flex items-center px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.2)" }}>
                <span className="text-xs font-semibold tabular-nums" style={{ color: "rgb(61,214,140)" }}>
                  {fmtUSD(c.commission)}
                </span>
              </div>
              <button type="button" onClick={() => removeRow(c.id)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text-tertiary)" }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Grand total */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.04)" }}>
        <div className="space-y-0.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Total owed this period
          </span>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {baseNum > 0 && <span>Base {fmtUSD(baseNum)}</span>}
            {baseNum > 0 && commissionTotal > 0 && <span>+</span>}
            {commissionTotal > 0 && <span>Commission {fmtUSD(commissionTotal)}</span>}
            {baseNum === 0 && commissionTotal === 0 && <span>Enter base pay or add campaigns above</span>}
          </div>
        </div>
        <span className="text-base font-bold tabular-nums" style={{ color: "#a78bfa" }}>
          {grandTotal > 0 ? fmtUSD(grandTotal) : "—"}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border-default)",
  borderRadius: 7,
  padding: "6px 10px",
  fontSize: 12,
  color: "var(--text-primary)",
  outline: "none",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRate(rate: number | null, freq: string | null) {
  if (rate == null) return "—";
  const f = freq === "biweekly" ? "/bi-wk" : freq === "monthly" ? "/mo" : freq === "weekly" ? "/wk" : "";
  return `$${rate.toLocaleString()}${f}`;
}

function fmtUSD(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

function calcNext(lastPaidAt: string, freq: string | null): string {
  const d = new Date(lastPaidAt);
  if (freq === "biweekly") d.setDate(d.getDate() + 14);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function endOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const EMPTY_FORM = {
  name: "", role: "", payRate: "", payFrequency: "monthly",
  lastPaidAt: "", nextPaymentDue: "", notes: "", basePay: "",
};

export default function TeamPayments({ initialMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addCommissions, setAddCommissions] = useState<CommissionEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editCommissions, setEditCommissions] = useState<CommissionEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [expandedCommissions, setExpandedCommissions] = useState<Set<string>>(new Set());

  const alerts = useMemo(() => {
    return members
      .map((m) => ({ m, days: daysUntil(m.nextPaymentDue) }))
      .filter(({ days }) => days !== null && days <= 5)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  }, [members]);

  function toggleExpand(id: string) {
    setExpandedCommissions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openAdd(categoryId: string) {
    setAddingCategory(categoryId);
    setAddForm({ ...EMPTY_FORM });
    setAddCommissions([]);
    setEditingId(null);
  }

  function openEdit(m: Member) {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      role: m.role ?? "",
      payRate: m.payRate != null ? m.payRate.toString() : "",
      payFrequency: m.payFrequency ?? "monthly",
      lastPaidAt: m.lastPaidAt ? m.lastPaidAt.slice(0, 10) : "",
      nextPaymentDue: m.nextPaymentDue ? m.nextPaymentDue.slice(0, 10) : "",
      notes: m.notes ?? "",
      basePay: m.basePay != null ? m.basePay.toString() : "",
    });
    setEditCommissions(m.commissions ?? []);
    setAddingCategory(null);
  }

  async function handleAdd(categoryId: string) {
    if (!addForm.name.trim()) return;
    setSaving(true);
    const isHead = categoryId === "head_campaign";
    const commTotal = addCommissions.reduce((s, c) => s + c.commission, 0);
    const baseNum = isHead ? (parseFloat(addForm.basePay) || 0) : 0;
    const total = isHead ? baseNum + commTotal : null;
    const res = await fetch("/api/agency/team-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        category: categoryId,
        payRate: isHead ? (total ?? null) : (addForm.payRate || null),
        basePay: isHead ? (baseNum || null) : null,
        commissions: isHead && addCommissions.length > 0 ? addCommissions : null,
      }),
    });
    if (res.ok) {
      const m = await res.json();
      setMembers((prev) => [...prev, m]);
      setAddingCategory(null);
      setAddForm(EMPTY_FORM);
      setAddCommissions([]);
    }
    setSaving(false);
  }

  async function handleEdit(id: string) {
    setSaving(true);
    const member = members.find((m) => m.id === id);
    const isHead = member?.category === "head_campaign";
    const commTotal = editCommissions.reduce((s, c) => s + c.commission, 0);
    const baseNum = isHead ? (parseFloat(editForm.basePay) || 0) : 0;
    const total = isHead ? baseNum + commTotal : null;
    const res = await fetch(`/api/agency/team-payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        payRate: isHead ? (total ?? null) : (editForm.payRate || null),
        basePay: isHead ? (baseNum || null) : null,
        commissions: isHead ? (editCommissions.length > 0 ? editCommissions : null) : undefined,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/agency/team-payments/${id}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  }

  async function markPaid(m: Member, undo = false) {
    setMarkingId(m.id);
    const body = undo
      ? { lastPaidAt: null, nextPaymentDue: null }
      : (() => {
          const today = new Date().toISOString().slice(0, 10);
          return { lastPaidAt: today, nextPaymentDue: calcNext(today, m.payFrequency) };
        })();
    const res = await fetch(`/api/agency/team-payments/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    }
    setMarkingId(null);
  }

  // Shared date fields (same for all categories)
  function DateFields({
    form,
    setForm,
  }: {
    form: typeof EMPTY_FORM;
    setForm: (f: typeof EMPTY_FORM) => void;
  }) {
    const dateStyle: React.CSSProperties = { ...inputStyle, width: "100%", colorScheme: "dark" };
    return (
      <>
        <div>
          <label className="label-mono mb-1 block">Last Paid</label>
          <input
            type="date"
            value={form.lastPaidAt}
            onChange={(e) =>
              setForm({
                ...form,
                lastPaidAt: e.target.value,
                // Auto-fill next due only if it hasn't been manually set
                nextPaymentDue: e.target.value
                  ? calcNext(e.target.value, form.payFrequency)
                  : form.nextPaymentDue,
              })
            }
            style={dateStyle}
          />
        </div>
        <div>
          <label className="label-mono mb-1 block">
            Next Payment Due
            {!form.lastPaidAt && (
              <span className="ml-1.5 normal-case font-normal" style={{ color: "var(--text-tertiary)" }}>
                — set manually if not started yet
              </span>
            )}
          </label>
          <input
            type="date"
            value={form.nextPaymentDue}
            onChange={(e) => setForm({ ...form, nextPaymentDue: e.target.value })}
            style={dateStyle}
          />
        </div>
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center gap-3 mb-2">
        <DollarSign size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Team Payments
        </h1>
      </div>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Track pay rates, payment history, and upcoming due dates by team role.
      </p>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-8 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <Bell size={15} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1.5" style={{ color: "#f59e0b" }}>
              {alerts.filter(({ days }) => (days ?? 1) <= 0).length > 0 ? "Payment(s) overdue" : "Payment(s) due soon"}
            </p>
            <div className="flex flex-wrap gap-2">
              {alerts.map(({ m, days }) => {
                const overdue = (days ?? 1) <= 0;
                return (
                  <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: overdue ? "rgba(255,59,59,0.12)" : "rgba(245,158,11,0.12)", color: overdue ? "rgb(255,90,90)" : "#f59e0b", border: `1px solid ${overdue ? "rgba(255,59,59,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                    <CalendarClock size={10} />
                    {m.name}
                    <span style={{ opacity: 0.75 }}>
                      {overdue ? `${Math.abs(days ?? 0)}d overdue` : days === 0 ? "due today" : `in ${days}d`}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-8">
        {CATEGORIES.map((cat) => {
          const catMembers = members.filter((m) => m.category === cat.id);
          const isAdding = addingCategory === cat.id;
          const isHead = cat.id === "head_campaign";

          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>

              {/* Category header */}
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: (catMembers.length > 0 || isAdding) ? "1px solid var(--border-subtle)" : undefined }}>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                    {cat.label}
                  </h2>
                  {catMembers.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
                      {catMembers.length}
                    </span>
                  )}
                </div>
                {!isAdding && (
                  <button onClick={() => openAdd(cat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.color }}>
                    <Plus size={11} /> Add Member
                  </button>
                )}
              </div>

              {/* ── Add form ── */}
              {isAdding && (
                <div className="px-6 py-4 space-y-3"
                  style={{ borderBottom: catMembers.length > 0 ? "1px solid var(--border-subtle)" : undefined, background: "rgba(255,255,255,0.015)" }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-mono mb-1 block">Name</label>
                      <input autoFocus value={addForm.name}
                        onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Full name" style={{ ...inputStyle, width: "100%" }} />
                    </div>
                    <div>
                      <label className="label-mono mb-1 block">Role / Title</label>
                      <input value={addForm.role}
                        onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                        placeholder="e.g. Senior Manager" style={{ ...inputStyle, width: "100%" }} />
                    </div>

                    {!isHead && (
                      <>
                        <div>
                          <label className="label-mono mb-1 block">Pay Rate ($)</label>
                          <input type="number" min={0} value={addForm.payRate}
                            onChange={(e) => setAddForm((f) => ({ ...f, payRate: e.target.value }))}
                            placeholder="e.g. 500" style={{ ...inputStyle, width: "100%" }} />
                        </div>
                        <div>
                          <label className="label-mono mb-1 block">Frequency</label>
                          <select value={addForm.payFrequency}
                            onChange={(e) => setAddForm((f) => ({
                              ...f,
                              payFrequency: e.target.value,
                              nextPaymentDue: f.lastPaidAt ? calcNext(f.lastPaidAt, e.target.value) : f.nextPaymentDue,
                            }))}
                            style={{ ...inputStyle, width: "100%", cursor: "pointer" }}>
                            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </>
                    )}

                    <DateFields form={addForm} setForm={setAddForm} />
                  </div>

                  {isHead && (
                    <div>
                      <label className="label-mono mb-1.5 block">Pay Breakdown</label>
                      <CommissionCalculator
                        list={addCommissions}
                        setList={setAddCommissions}
                        basePay={addForm.basePay}
                        setBasePay={(v) => setAddForm((f) => ({ ...f, basePay: v }))}
                      />
                    </div>
                  )}

                  <div>
                    <label className="label-mono mb-1 block">Notes</label>
                    <input value={addForm.notes}
                      onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional notes" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleAdd(cat.id)} disabled={saving || !addForm.name.trim()}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: cat.color === "var(--accent)" ? "var(--accent)" : cat.color, color: "#fff", opacity: (!addForm.name.trim() || saving) ? 0.5 : 1 }}>
                      {saving ? "Saving…" : "Add Member"}
                    </button>
                    <button onClick={() => setAddingCategory(null)}
                      className="px-4 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
                      style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Members table ── */}
              {catMembers.length > 0 && (
                <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="grid px-6 py-2"
                    style={{ gridTemplateColumns: isHead ? "1fr 150px 120px 130px 130px" : "1fr 100px 110px 120px 130px 120px", gap: 8 }}>
                    {(isHead
                      ? ["Name / Role", "Total Pay / Mo", "Last Paid", "Next Due", ""]
                      : ["Name / Role", "Pay Rate", "Frequency", "Last Paid", "Next Due", ""]
                    ).map((h) => (
                      <span key={h} className="label-mono" style={{ fontSize: 10 }}>{h}</span>
                    ))}
                  </div>

                  {catMembers.map((m) => {
                    const days = daysUntil(m.nextPaymentDue);
                    const overdue = days !== null && days <= 0;
                    const dueSoon = days !== null && days > 0 && days <= 5;
                    const isEditing = editingId === m.id;
                    const memberIsHead = m.category === "head_campaign";
                    const commList: CommissionEntry[] = Array.isArray(m.commissions) ? m.commissions : [];
                    const commTotal = commList.reduce((s, c) => s + c.commission, 0);
                    const isExpanded = expandedCommissions.has(m.id);

                    if (isEditing) {
                      return (
                        <div key={m.id} className="px-6 py-4 space-y-3" style={{ background: "rgba(255,255,255,0.015)" }}>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label-mono mb-1 block">Name</label>
                              <input value={editForm.name}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                style={{ ...inputStyle, width: "100%" }} />
                            </div>
                            <div>
                              <label className="label-mono mb-1 block">Role / Title</label>
                              <input value={editForm.role}
                                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                                style={{ ...inputStyle, width: "100%" }} />
                            </div>

                            {!memberIsHead && (
                              <>
                                <div>
                                  <label className="label-mono mb-1 block">Pay Rate ($)</label>
                                  <input type="number" min={0} value={editForm.payRate}
                                    onChange={(e) => setEditForm((f) => ({ ...f, payRate: e.target.value }))}
                                    style={{ ...inputStyle, width: "100%" }} />
                                </div>
                                <div>
                                  <label className="label-mono mb-1 block">Frequency</label>
                                  <select value={editForm.payFrequency}
                                    onChange={(e) => setEditForm((f) => ({
                                      ...f,
                                      payFrequency: e.target.value,
                                      nextPaymentDue: f.lastPaidAt ? calcNext(f.lastPaidAt, e.target.value) : f.nextPaymentDue,
                                    }))}
                                    style={{ ...inputStyle, width: "100%", cursor: "pointer" }}>
                                    {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </div>
                              </>
                            )}

                            <DateFields form={editForm} setForm={setEditForm} />
                          </div>

                          {memberIsHead && (
                            <div>
                              <label className="label-mono mb-1.5 block">Pay Breakdown</label>
                              <CommissionCalculator
                                list={editCommissions}
                                setList={setEditCommissions}
                                basePay={editForm.basePay}
                                setBasePay={(v) => setEditForm((f) => ({ ...f, basePay: v }))}
                              />
                            </div>
                          )}

                          <div>
                            <label className="label-mono mb-1 block">Notes</label>
                            <input value={editForm.notes}
                              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                              placeholder="Optional notes" style={{ ...inputStyle, width: "100%" }} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => handleEdit(m.id)} disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: "var(--accent)", color: "var(--text-on-accent)", opacity: saving ? 0.6 : 1 }}>
                              <Check size={11} /> Save
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
                              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id}>
                        <div className="grid px-6 py-3.5 items-center"
                          style={{ gridTemplateColumns: memberIsHead ? "1fr 150px 120px 130px 130px" : "1fr 100px 110px 120px 130px 120px", gap: 8 }}>

                          {/* Name / Role */}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.name}</p>
                            {m.role && <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{m.role}</p>}
                            {m.notes && <p className="text-xs truncate mt-0.5 italic" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>{m.notes}</p>}
                            {memberIsHead && (commList.length > 0 || m.basePay) && (
                              <button onClick={() => toggleExpand(m.id)}
                                className="flex items-center gap-1 mt-1 text-xs transition-opacity hover:opacity-80"
                                style={{ color: "#a78bfa" }}>
                                <Calculator size={10} />
                                {commList.length > 0 ? `${commList.length} campaign${commList.length !== 1 ? "s" : ""}` : "Base only"}
                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              </button>
                            )}
                          </div>

                          {/* Total pay (head) or pay rate (others) */}
                          {memberIsHead ? (
                            <div>
                              <p className="text-sm tabular-nums font-semibold" style={{ color: "#a78bfa" }}>
                                {m.payRate != null ? fmtUSD(m.payRate) : "—"}
                              </p>
                              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                {m.basePay != null && commTotal > 0
                                  ? `${fmtUSD(m.basePay)} base + ${fmtUSD(commTotal)} comm`
                                  : m.basePay != null
                                  ? `${fmtUSD(m.basePay)} base`
                                  : commTotal > 0
                                  ? `${fmtUSD(commTotal)} commission`
                                  : "this month"}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm tabular-nums font-semibold" style={{ color: "var(--success)" }}>
                              {fmtRate(m.payRate, m.payFrequency)}
                            </p>
                          )}

                          {/* Frequency (non-head only) */}
                          {!memberIsHead && (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {FREQ_OPTIONS.find((o) => o.value === m.payFrequency)?.label ?? "—"}
                            </p>
                          )}

                          {/* Last Paid */}
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmtDate(m.lastPaidAt)}</p>

                          {/* Next Due */}
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs" style={{ color: overdue ? "rgb(255,90,90)" : dueSoon ? "#f59e0b" : "var(--text-secondary)" }}>
                              {fmtDate(m.nextPaymentDue)}
                            </p>
                            {(overdue || dueSoon) && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                                style={{ background: overdue ? "rgb(255,90,90)" : "#f59e0b" }} />
                            )}
                          </div>

                          {/* Actions */}
                          {(() => {
                            const paidThisCycle = m.nextPaymentDue != null && (daysUntil(m.nextPaymentDue) ?? -1) > 0;
                            return (
                              <div className="flex items-center gap-1 justify-end">
                                {paidThisCycle ? (
                                  <div className="flex items-center gap-1">
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                                      style={{ background: "rgba(61,214,140,0.1)", border: "1px solid rgba(61,214,140,0.25)", color: "rgb(61,214,140)" }}>
                                      <BadgeCheck size={11} /> Paid
                                    </span>
                                    <button onClick={() => markPaid(m, true)} disabled={markingId === m.id}
                                      title="Undo — mark as unpaid"
                                      className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                      style={{ color: "var(--text-tertiary)", opacity: markingId === m.id ? 0.5 : 1 }}>
                                      <X size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => markPaid(m)} disabled={markingId === m.id}
                                    title="Mark as paid today"
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", opacity: markingId === m.id ? 0.5 : 1 }}>
                                    <BadgeCheck size={11} /> Mark Paid
                                  </button>
                                )}
                                <button onClick={() => openEdit(m)}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: "var(--text-tertiary)" }}>
                                  <Edit2 size={12} />
                                </button>
                                <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                  style={{ color: "var(--danger)", opacity: deletingId === m.id ? 0.5 : 1 }}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Commission breakdown (expandable) */}
                        {memberIsHead && isExpanded && (
                          <div className="px-6 pb-4">
                            <div className="rounded-xl overflow-hidden"
                              style={{ border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.04)" }}>
                              {/* Base pay row */}
                              {m.basePay != null && (
                                <div className="flex items-center justify-between px-4 py-2.5"
                                  style={{ borderBottom: commList.length > 0 ? "1px solid rgba(167,139,250,0.15)" : undefined }}>
                                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Base Pay</span>
                                  <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                                    {fmtUSD(m.basePay)}/mo
                                  </span>
                                </div>
                              )}

                              {/* Campaign rows */}
                              {commList.length > 0 && (
                                <>
                                  <div className="grid px-4 py-2" style={{ gridTemplateColumns: "1fr 140px 110px" }}>
                                    <span className="label-mono" style={{ fontSize: 10 }}>Campaign</span>
                                    <span className="label-mono" style={{ fontSize: 10 }}>Budget</span>
                                    <span className="label-mono" style={{ fontSize: 10 }}>Commission (2.5%)</span>
                                  </div>
                                  <div className="divide-y" style={{ borderColor: "rgba(167,139,250,0.12)" }}>
                                    {commList.map((c) => (
                                      <div key={c.id} className="grid px-4 py-2.5 items-center"
                                        style={{ gridTemplateColumns: "1fr 140px 110px" }}>
                                        <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                          {c.campaignName || "—"}
                                        </span>
                                        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                          {c.budget > 0 ? fmtUSD(c.budget) : "—"}
                                        </span>
                                        <span className="text-xs tabular-nums font-semibold" style={{ color: "rgb(61,214,140)" }}>
                                          {fmtUSD(c.commission)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              {/* Total */}
                              <div className="flex items-center justify-between px-4 py-2.5"
                                style={{ borderTop: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)" }}>
                                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                                  Total owed · due {endOfMonth()}
                                </span>
                                <span className="text-sm font-bold tabular-nums" style={{ color: "#a78bfa" }}>
                                  {fmtUSD((m.basePay ?? 0) + commTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {catMembers.length === 0 && !isAdding && (
                <div className="px-6 py-4">
                  <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>No members yet.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
