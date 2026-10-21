"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Upload, Plus, Trash2, ChevronUp, ChevronDown, Search, X,
  ExternalLink, Phone, TrendingUp, Users, MessageSquare, Calendar,
  CheckCircle2, ChevronDown as DropIcon, Radio, AlertTriangle, Bookmark, Maximize2, Minimize2,
} from "lucide-react";

export interface CrmLead {
  id: string;
  leadName: string;
  instagram: string | null;
  email: string | null;
  linkedin: string | null;
  x: string | null;
  outreachedIg: boolean;
  outreachedEmail: boolean;
  outreachedLinkedin: boolean;
  outreachedX: boolean;
  dateMessaged: string | null;
  followUp1: string | null;
  followUp2: string | null;
  followUp3: string | null;
  lastFollowUpDate: string | null;
  replied: boolean;
  replyMessage: string | null;
  callBooked: boolean;
  showedUpToCall: boolean;
  closedCall: boolean;
  whoMessaged: string | null;
  notes: string | null;
  leadSource: string | null;
  inConvo: boolean;
  leadLost: boolean;
  markedDone: boolean;
  createdAt: string;
  updatedAt: string;
}

const WHO_OPTIONS = [
  { value: "andrew_instagram", label: "Andrew — Instagram" },
  { value: "evan_instagram", label: "Evan — Instagram" },
  { value: "andrew_email", label: "Andrew — Email" },
  { value: "evan_email", label: "Evan — Email" },
  { value: "andrew_x", label: "Andrew — X" },
  { value: "andrew_linkedin", label: "Andrew — LinkedIn" },
  { value: "cliplaunch_instagram", label: "ClipLaunch — Instagram" },
  { value: "cliplaunch_email", label: "ClipLaunch — Email" },
];

const SOURCE_OPTIONS = [
  { value: "cold_outbound", label: "Cold Outbound" },
  { value: "referral", label: "Referral" },
  { value: "inbound", label: "Inbound" },
  { value: "partnership", label: "Partnership" },
  { value: "other", label: "Other" },
];

function leadTemperature(lead: CrmLead): { label: string; color: string; bg: string; border: string } {
  if (lead.leadLost)         return { label: "Lost",    color: "rgb(160,80,80)",     bg: "rgba(160,80,80,0.1)",    border: "rgba(160,80,80,0.3)"   };
  if (lead.closedCall)       return { label: "Closed",  color: "rgb(61,214,140)",    bg: "rgba(61,214,140,0.12)",  border: "rgba(61,214,140,0.4)"  };
  if (lead.showedUpToCall)   return { label: "Hot 🔥",  color: "rgb(255,120,60)",    bg: "rgba(255,120,60,0.12)",  border: "rgba(255,120,60,0.4)"  };
  if (lead.callBooked)       return { label: "Hot",     color: "rgb(255,160,40)",    bg: "rgba(255,160,40,0.12)",  border: "rgba(255,160,40,0.4)"  };
  if (lead.replied || lead.inConvo) return { label: "Warm", color: "rgb(251,191,36)", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.4)" };
  if (lead.outreachedIg || lead.outreachedEmail || lead.outreachedLinkedin || lead.outreachedX)
    return { label: "Cold",  color: "rgb(140,160,200)", bg: "rgba(140,160,200,0.08)", border: "rgba(140,160,200,0.25)" };
  return { label: "Cold",    color: "var(--text-tertiary)", bg: "transparent",        border: "var(--border-subtle)"  };
}

type SortKey = "leadName" | "dateMessaged" | "createdAt" | "daysSince";
type SortDir = "asc" | "desc";

// ─── Brand SVG icons ────────────────────────────────────────────────
function IgIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TikTokIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z" />
    </svg>
  );
}
function LinkedInIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function XIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function GmailIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4CAF50" d="M45 16.2l-5 2.75-5 4.75V40h7a3 3 0 003-3V16.2z"/>
      <path fill="#1E88E5" d="M3 16.2l3.5 2.75L11 23.7V40H4a3 3 0 01-3-3V16.2z"/>
      <path fill="#E53935" d="M35 11.2l-11 8.4-11-8.4-1 5.8 1 6.8 11 8.4 11-8.4 1-6.8z"/>
      <path fill="#C62828" d="M3 12.298V16.2l8 6.5V11.2L7.498 9.044C5.726 7.86 3 9.374 3 11.298z"/>
      <path fill="#FBC02D" d="M45 12.298V16.2l-8 6.5V11.2l3.502-2.156C42.274 7.86 45 9.374 45 11.298z"/>
    </svg>
  );
}

function buildSocialLink(platform: "ig" | "email" | "linkedin" | "x", value: string): string {
  const v = value.trim().replace(/^@/, "");
  if (platform === "ig") return `https://instagram.com/${v}`;
  if (platform === "email") return `mailto:${value.trim()}`;
  if (platform === "x") return `https://x.com/${v}`;
  if (value.startsWith("http")) return value;
  return `https://linkedin.com/in/${v}`;
}

function daysSinceLastTouch(lead: CrmLead): number | null {
  const candidates = [lead.dateMessaged, lead.followUp1, lead.followUp2, lead.followUp3, lead.lastFollowUpDate];
  const valid = candidates.filter(Boolean).map((d) => new Date(d!).getTime());
  if (valid.length === 0) return null;
  const latest = Math.max(...valid);
  return Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
}

function StaleBadge({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>—</span>;
  let bg = "rgba(61,214,140,0.12)";
  let color = "var(--success)";
  let label = `${days}d ago`;
  if (days >= 7) { bg = "rgba(255,59,59,0.12)"; color = "var(--error, #ff5a5a)"; }
  else if (days >= 3) { bg = "rgba(255,179,0,0.12)"; color = "var(--warning, #ffb300)"; }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ background: bg, color, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{icon}</div>
      <div>
        <p className="text-xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{value}</p>
        <p className="label-mono mt-0.5">{label}</p>
        {sub && <p style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all mx-auto"
      style={{
        background: checked ? "rgba(61,214,140,0.22)" : "transparent",
        border: checked ? "1px solid rgba(61,214,140,0.7)" : "1px solid var(--border-default)",
        boxShadow: checked ? "0 0 10px rgba(61,214,140,0.4)" : undefined,
      }}
    >
      {checked && <CheckCircle2 size={15} color="rgb(61,214,140)" strokeWidth={2.5} />}
    </button>
  );
}

function DateCell({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-xs rounded px-1.5 py-1 w-[108px]"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: value ? "var(--text-primary)" : "var(--text-tertiary)", colorScheme: "dark" }}
    />
  );
}

function TextareaCell({ value, onChange, placeholder }: { value: string | null; onChange: (v: string | null) => void; placeholder?: string }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      rows={2}
      className="text-xs rounded px-2 py-1.5 resize-none w-[165px]"
      style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
    />
  );
}

function SocialRow({
  platform, label, icon, value, onChange, color,
}: {
  platform: "ig" | "email" | "linkedin" | "x";
  label: string;
  icon: React.ReactNode;
  value: string | null;
  onChange: (v: string | null) => void;
  color: string;
}) {
  const [editing, setEditing] = useState(false);
  const hasValue = !!(value && value.trim().length > 0);

  return (
    <div className="flex items-center gap-1.5 group min-h-[22px]">
      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, color }} title={label}>
        {icon}
      </div>
      {editing || (!hasValue && editing) ? (
        <input
          autoFocus
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          onBlur={() => setEditing(false)}
          placeholder={platform === "email" ? "email@…" : "@handle"}
          className="crm-social-input text-xs rounded px-1.5 py-0.5 w-[118px]"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        />
      ) : hasValue ? (
        <a
          href={buildSocialLink(platform, value!)}
          target="_blank"
          rel="noopener noreferrer"
          className="crm-social-val text-xs truncate max-w-[118px] hover:underline"
          style={{ color: "#4493f8", textDecorationColor: "#4493f8" }}
          title={value!}
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-1 py-0.5 rounded transition-opacity hover:opacity-100"
          style={{ color: "var(--text-tertiary)", opacity: 0.45 }}
          title="Click to add"
        >
          None
        </button>
      )}
      {hasValue && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          style={{ color: "var(--text-tertiary)" }}
          title="Edit"
        >
          <ExternalLink size={9} />
        </button>
      )}
    </div>
  );
}

function OutreachPills({ lead, patch }: { lead: CrmLead; patch: (id: string, field: string, value: unknown) => void }) {
  const platforms: { key: keyof CrmLead; label: string; icon: React.ReactNode }[] = [
    { key: "outreachedIg", label: "IG", icon: <IgIcon size={16} /> },
    { key: "outreachedEmail", label: "Gmail", icon: <GmailIcon size={16} /> },
    { key: "outreachedLinkedin", label: "LinkedIn", icon: <LinkedInIcon size={16} /> },
    { key: "outreachedX", label: "X", icon: <XIcon size={16} /> },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {platforms.map(({ key, label, icon }) => {
        const checked = lead[key] as boolean;
        return (
          <button
            key={key}
            onClick={() => patch(lead.id, key, !checked)}
            title={label}
            className="flex flex-col items-center justify-center gap-1 rounded-lg transition-all"
            style={{
              width: 36,
              height: 36,
              background: checked ? "rgba(61,214,140,0.15)" : "var(--bg-base)",
              border: `1px solid ${checked ? "rgba(61,214,140,0.6)" : "var(--border-subtle)"}`,
              boxShadow: checked ? "0 0 10px rgba(61,214,140,0.3)" : undefined,
              opacity: checked ? 1 : 0.45,
            }}
          >
            {icon}
            {checked && (
              <span style={{ fontSize: 7, fontWeight: 700, color: "rgb(61,214,140)", letterSpacing: "0.02em", lineHeight: 1 }}>✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Add Lead Modal ───────────────────────────────────────────────────
type NewLeadForm = { leadName: string; instagram: string; email: string; linkedin: string; x: string; whoMessaged: string; leadSource: string };

function AddLeadModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: NewLeadForm) => Promise<void> }) {
  const [form, setForm] = useState<NewLeadForm>({ leadName: "", instagram: "", email: "", linkedin: "", x: "", whoMessaged: "", leadSource: "cold_outbound" });
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function set(field: keyof NewLeadForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leadName.trim()) return;
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  }

  const inputCls = "w-full text-sm rounded-lg px-3 py-2";
  const inputSty: React.CSSProperties = { background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  const labelSty: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" as const, display: "block", marginBottom: 4 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-[460px] rounded-2xl p-6 flex flex-col gap-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>New Lead</h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label style={labelSty}>Name <span style={{ color: "var(--accent)" }}>*</span></label>
            <input ref={nameRef} required value={form.leadName} onChange={(e) => set("leadName", e.target.value)} placeholder="Full name or handle" className={inputCls} style={inputSty} />
          </div>

          {/* Socials 2-col grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSty}><span style={{ color: "#E1306C" }}>IG</span> Instagram</label>
              <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}><span style={{ color: "#4F8EF7" }}>@</span> Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@…" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}><span style={{ color: "#0A66C2" }}>in</span> LinkedIn</label>
              <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="@handle or URL" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}>X / Twitter</label>
              <input value={form.x} onChange={(e) => set("x", e.target.value)} placeholder="@handle" className={inputCls} style={inputSty} />
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <label style={labelSty}>Lead Source</label>
            <div className="relative">
              <select value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} className={`${inputCls} pr-8`} style={{ ...inputSty, appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}>
                {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </div>

          {/* Who will message */}
          <div>
            <label style={labelSty}>Who&apos;s messaging</label>
            <div className="relative">
              <select value={form.whoMessaged} onChange={(e) => set("whoMessaged", e.target.value)} className={`${inputCls} pr-8`} style={{ ...inputSty, appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}>
                <option value="">— select —</option>
                {WHO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.leadName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity" style={{ background: "var(--accent)", color: "white", opacity: saving || !form.leadName.trim() ? 0.6 : 1 }}>
              {saving ? "Adding…" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CSV Confirm Modal ────────────────────────────────────────────────
type CsvRow = { leadName: string; instagram: string; email: string; linkedin: string; x: string };

function CsvConfirmModal({ toAdd, duplicates, onConfirm, onCancel, importing }: {
  toAdd: CsvRow[];
  duplicates: string[];
  onConfirm: () => void;
  onCancel: () => void;
  importing: boolean;
}) {
  const [showDupes, setShowDupes] = useState(false);
  const total = toAdd.length + duplicates.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onCancel}>
      <div className="w-[480px] rounded-2xl p-6 flex flex-col gap-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Review CSV Import</h2>
          <button onClick={onCancel} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)" }}>
            <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{total}</p>
            <p style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>In CSV</p>
          </div>
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(255,59,59,0.06)", border: "1px solid rgba(255,59,59,0.2)" }}>
            <p className="text-2xl font-semibold" style={{ color: "var(--accent)", fontFamily: "var(--font-display)" }}>{duplicates.length}</p>
            <p style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.8 }}>Already Exist</p>
          </div>
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(61,214,140,0.06)", border: "1px solid rgba(61,214,140,0.2)" }}>
            <p className="text-2xl font-semibold" style={{ color: "var(--success)", fontFamily: "var(--font-display)" }}>{toAdd.length}</p>
            <p style={{ fontSize: 10, color: "var(--success)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.8 }}>Will Be Added</p>
          </div>
        </div>

        {/* Duplicate list */}
        {duplicates.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,59,59,0.2)", background: "rgba(255,59,59,0.04)" }}>
            <button className="w-full flex items-center justify-between px-4 py-2.5 text-left" onClick={() => setShowDupes((s) => !s)}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                  {duplicates.length} duplicate{duplicates.length !== 1 ? "s" : ""} will be skipped
                </span>
              </div>
              <DropIcon size={12} style={{ color: "var(--accent)", transform: showDupes ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {showDupes && (
              <div className="px-4 pb-3 max-h-36 overflow-y-auto" style={{ borderTop: "1px solid rgba(255,59,59,0.15)" }}>
                {duplicates.map((name) => (
                  <p key={name} className="py-1 text-xs" style={{ color: "var(--text-secondary)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{name}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {toAdd.length === 0 && (
          <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>All leads in this CSV already exist — nothing to import.</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={toAdd.length === 0 || importing} className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity" style={{ background: "var(--accent)", color: "white", opacity: toAdd.length === 0 || importing ? 0.5 : 1 }}>
            {importing ? "Importing…" : `Import ${toAdd.length} lead${toAdd.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrmDashboard({ initialLeads }: { initialLeads: CrmLead[] }) {
  const [leads, setLeads] = useState<CrmLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [newLeadId, setNewLeadId] = useState<string | null>(null);
  const [csvConfirm, setCsvConfirm] = useState<{ toAdd: CsvRow[]; duplicates: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const patchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [bookmarkId, setBookmarkId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("crm_bookmark");
  });

  // On load, scroll to bookmarked row
  useEffect(() => {
    if (!bookmarkId) return;
    const el = rowRefs.current.get(bookmarkId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkId((prev) => {
      const next = prev === id ? null : id;
      if (next) localStorage.setItem("crm_bookmark", next);
      else localStorage.removeItem("crm_bookmark");
      return next;
    });
  }, []);

  const patch = useCallback((id: string, field: string, value: unknown) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
    const key = `${id}:${field}`;
    const existing = patchTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      setSaving((prev) => new Set(prev).add(id));
      await fetch(`/api/agency/crm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      setSaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
      patchTimers.current.delete(key);
    }, 600);
    patchTimers.current.set(key, timer);
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/agency/crm/${id}`, { method: "DELETE" });
  }, []);

  const submitNewLead = useCallback(async (form: NewLeadForm) => {
    const res = await fetch("/api/agency/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadName: form.leadName.trim(),
        instagram: form.instagram || null,
        email: form.email || null,
        linkedin: form.linkedin || null,
        x: form.x || null,
        whoMessaged: form.whoMessaged || null,
      }),
    });
    if (!res.ok) return;
    const lead: CrmLead = await res.json();
    setLeads((prev) => [lead, ...prev]);
    setNewLeadId(lead.id);
    setTimeout(() => setNewLeadId(null), 2000);
    setFilterStage("all");
    setSearch("");
    setShowAddModal(false);
  }, []);

  const parseCsvRows = useCallback((text: string): CsvRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const cols: string[] = [];
      let cur = ""; let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cols.push(cur.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").replace(/^"|"$/g, ""); });
      const leadName = (obj["Lead Name"] || obj["leadName"] || obj["Name"] || obj["name"] || "").trim();
      return {
        leadName,
        instagram: obj["Instagram"] || obj["instagram"] || "",
        email: obj["Email"] || obj["email"] || "",
        linkedin: obj["LinkedIn"] || obj["linkedin"] || "",
        x: obj["X"] || obj["Twitter"] || obj["twitter"] || obj["x"] || "",
      };
    }).filter((r) => r.leadName.length > 0);
  }, []);

  const handleCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = "";
    const rows = parseCsvRows(text);
    if (rows.length === 0) return;

    // Deduplicate within the CSV itself first (keep first occurrence)
    const seenInCsv = new Set<string>();
    const csvDupeNames: string[] = [];
    const uniqueRows = rows.filter((r) => {
      const key = r.leadName.toLowerCase();
      if (seenInCsv.has(key)) { csvDupeNames.push(r.leadName); return false; }
      seenInCsv.add(key);
      return true;
    });

    // Then check against existing leads in state
    const existingNames = new Set(leads.map((l) => l.leadName.trim().toLowerCase()));
    const existingDupeNames = uniqueRows.filter((r) => existingNames.has(r.leadName.toLowerCase())).map((r) => r.leadName);
    const toAdd = uniqueRows.filter((r) => !existingNames.has(r.leadName.toLowerCase()));
    const dupeNames = [...csvDupeNames, ...existingDupeNames];

    setCsvConfirm({ toAdd, duplicates: dupeNames });
  }, [leads, parseCsvRows]);

  const confirmCsvImport = useCallback(async () => {
    if (!csvConfirm || csvConfirm.toAdd.length === 0) return;
    setImporting(true);
    const res = await fetch("/api/agency/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(csvConfirm.toAdd),
    });
    if (res.ok) {
      const result: { created: number; skipped: number } = await res.json();
      const fresh = await fetch("/api/agency/crm");
      if (fresh.ok) setLeads(await fresh.json());
      const skipped = csvConfirm.duplicates.length + result.skipped;
      const msg = skipped > 0
        ? `${result.created} added, ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped`
        : `${result.created} lead${result.created !== 1 ? "s" : ""} imported`;
      setImportMsg(msg);
      setTimeout(() => setImportMsg(null), 4000);
    }
    setImporting(false);
    setCsvConfirm(null);
  }, [csvConfirm]);

  const deduplicateLeads = useCallback(async () => {
    setDeduping(true);
    const res = await fetch("/api/agency/crm", { method: "DELETE" });
    if (res.ok) {
      const { removed }: { removed: number } = await res.json();
      const fresh = await fetch("/api/agency/crm");
      if (fresh.ok) setLeads(await fresh.json());
      const msg = removed > 0
        ? `${removed} duplicate${removed !== 1 ? "s" : ""} removed`
        : "No duplicates found";
      setImportMsg(msg);
      setTimeout(() => setImportMsg(null), 4000);
    }
    setDeduping(false);
  }, []);

  const deleteAllLeads = useCallback(async () => {
    setDeletingAll(true);
    const res = await fetch("/api/agency/crm?all=true", { method: "DELETE" });
    if (res.ok) {
      setLeads([]);
      setImportMsg("All leads deleted");
      setTimeout(() => setImportMsg(null), 4000);
    }
    setDeletingAll(false);
    setShowDeleteAll(false);
  }, []);

  const stats = useMemo(() => {
    const total = leads.length;
    const outreachedCount = leads.filter((l) => l.outreachedIg || l.outreachedEmail || l.outreachedLinkedin || l.outreachedX).length;
    const repliedCount = leads.filter((l) => l.replied).length;
    const bookedCount = leads.filter((l) => l.callBooked).length;
    const showedCount = leads.filter((l) => l.showedUpToCall).length;
    const closedCount = leads.filter((l) => l.closedCall).length;
    const pct = (n: number, d: number) => d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
    return { total, responseRate: pct(repliedCount, outreachedCount), bookingRate: pct(bookedCount, repliedCount), showUpRate: pct(showedCount, bookedCount), closeRate: pct(closedCount, showedCount), outreachedCount, repliedCount, bookedCount, showedCount, closedCount };
  }, [leads]);

  // Stable import-order numbers: 1 = oldest added, N = newest added
  const importOrder = useMemo(() => {
    const sorted = [...leads].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const map = new Map<string, number>();
    sorted.forEach((l, i) => map.set(l.id, i + 1));
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    let list = [...leads];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.leadName.toLowerCase().includes(q) || (l.instagram ?? "").toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q));
    }

    if (filterStage !== "all") {
      if (filterStage === "inConvo") list = list.filter((l) => l.inConvo);
      if (filterStage === "notOutreached") list = list.filter((l) => !l.outreachedIg && !l.outreachedEmail && !l.outreachedLinkedin && !l.outreachedX);
      if (filterStage === "outreached") list = list.filter((l) => l.outreachedIg || l.outreachedEmail || l.outreachedLinkedin || l.outreachedX);
      if (filterStage === "replied") list = list.filter((l) => l.replied);
      if (filterStage === "booked") list = list.filter((l) => l.callBooked);
      if (filterStage === "showed") list = list.filter((l) => l.showedUpToCall);
      if (filterStage === "closed") list = list.filter((l) => l.closedCall);
      if (filterStage === "lost") list = list.filter((l) => l.leadLost);
      if (filterStage === "overdue3") list = list.filter((l) => !l.replied && !l.closedCall && (daysSinceLastTouch(l) ?? -1) >= 3);
      if (filterStage === "overdue7") list = list.filter((l) => !l.replied && !l.closedCall && (daysSinceLastTouch(l) ?? -1) >= 7);
    }

    list.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      if (sortKey === "leadName") { va = a.leadName.toLowerCase(); vb = b.leadName.toLowerCase(); }
      else if (sortKey === "dateMessaged") { va = a.dateMessaged ?? ""; vb = b.dateMessaged ?? ""; }
      else if (sortKey === "daysSince") { va = daysSinceLastTouch(a) ?? -1; vb = daysSinceLastTouch(b) ?? -1; }
      else { va = a.createdAt; vb = b.createdAt; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [leads, search, filterStage, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const inputStyle: React.CSSProperties = { background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", colorScheme: "dark" };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "1.75rem", cursor: "pointer" };

  const sectionBg: Record<string, string> = {
    outreach: "rgba(79,142,247,0.05)",
    messages: "rgba(61,214,140,0.05)",
    pipeline: "rgba(255,59,59,0.05)",
  };

  const thBase: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.02em", borderBottom: "2px solid var(--border-default)", padding: "10px 12px", whiteSpace: "nowrap", background: "var(--bg-subtle)" };

  function ThCol({ children, sortable, k, center, section }: { children?: React.ReactNode; sortable?: boolean; k?: SortKey; center?: boolean; section?: string }) {
    return (
      <th
        className={center ? "text-center" : "text-left"}
        style={{ ...thBase, ...(section ? { background: sectionBg[section] } : {}), cursor: sortable ? "pointer" : "default" }}
        onClick={sortable && k ? () => toggleSort(k) : undefined}
      >
        <span className={`inline-flex items-center gap-1 ${center ? "justify-center w-full" : ""}`}>
          {children}
          {sortable && k && (sortKey !== k ? <ChevronUp size={11} style={{ opacity: 0.3 }} /> : sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
        </span>
      </th>
    );
  }

  const tdStyle = (section?: string): React.CSSProperties => ({
    padding: "10px 12px",
    verticalAlign: "top",
    borderBottom: "1px solid var(--border-subtle)",
    ...(section ? { background: sectionBg[section] } : {}),
  });

  const STAGE_FILTERS = [
    { v: "all", label: "All" },
    { v: "inConvo", label: "🔴 In Convo" },
    { v: "notOutreached", label: "Not Outreached" },
    { v: "outreached", label: "Outreached" },
    { v: "replied", label: "Replied" },
    { v: "overdue3", label: "Overdue 3+ days" },
    { v: "overdue7", label: "Overdue 7+ days" },
    { v: "booked", label: "Booked" },
    { v: "showed", label: "Showed" },
    { v: "closed", label: "Closed" },
  ];

  return (
    <div className="p-8">
      <style>{`
        tr:hover .crm-pin { opacity: 0.45 !important; }
        tr:hover .crm-pin[style*="opacity: 1"] { opacity: 1 !important; }
        .crm-expanded textarea { width: 280px !important; min-height: 72px; }
        .crm-expanded .crm-social-val { max-width: none !important; white-space: normal !important; overflow: visible !important; width: auto !important; min-width: 160px; }
        .crm-expanded .crm-lead-input { width: 200px !important; }
        .crm-expanded .crm-social-input { width: 220px !important; }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>CRM</h1>
          <p className="metric-sub mt-0.5">{leads.length} leads total</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: expanded ? "var(--accent-muted)" : "var(--bg-surface)", border: `1px solid ${expanded ? "var(--accent-border)" : "var(--border-default)"}`, color: expanded ? "var(--accent)" : "var(--text-secondary)" }}
            title={expanded ? "Collapse columns" : "Expand columns to see full content"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button
            onClick={() => setShowDeleteAll(true)}
            disabled={leads.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.25)", color: "rgb(255,80,80)", opacity: leads.length === 0 ? 0.4 : 1 }}
          >
            <Trash2 size={14} />
            Delete All
          </button>
          <button
            onClick={deduplicateLeads}
            disabled={deduping}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
            title="Find and remove duplicate lead names (keeps the oldest entry)"
          >
            {deduping ? "Checking…" : "Remove Dupes"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
          >
            <Upload size={14} />
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Import / dedup feedback toast */}
      {importMsg && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 rounded-lg" style={{ background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.25)" }}>
          <p className="text-sm" style={{ color: "var(--success)" }}>{importMsg}</p>
          <button onClick={() => setImportMsg(null)} style={{ color: "var(--text-tertiary)" }}><X size={13} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-7">
        <StatCard label="Total Leads" value={stats.total} icon={<Users size={16} />} />
        <StatCard label="Response Rate" value={stats.responseRate} sub={`${stats.repliedCount} / ${stats.outreachedCount} outreached`} icon={<MessageSquare size={16} />} />
        <StatCard label="Booking Rate" value={stats.bookingRate} sub={`${stats.bookedCount} / ${stats.repliedCount} replied`} icon={<Calendar size={16} />} />
        <StatCard label="Show Up Rate" value={stats.showUpRate} sub={`${stats.showedCount} / ${stats.bookedCount} booked`} icon={<Phone size={16} />} />
        <StatCard label="Close Rate" value={stats.closeRate} sub={`${stats.closedCount} / ${stats.showedCount} showed`} icon={<TrendingUp size={16} />} />
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-5 flex flex-col gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
        {/* Row 1: search + sort toggles */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="pl-8 pr-8 py-2 rounded-lg text-sm w-[220px]"
              style={inputStyle}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Stale sort */}
          <button
            onClick={() => sortKey === "daysSince"
              ? (setSortKey("createdAt"), setSortDir("asc"))
              : (setSortKey("daysSince"), setSortDir("desc"))
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              fontFamily: "var(--font-display)",
              background: sortKey === "daysSince" ? "rgba(255,179,0,0.1)" : "transparent",
              color: sortKey === "daysSince" ? "#ffb300" : "var(--text-tertiary)",
              border: `1px solid ${sortKey === "daysSince" ? "rgba(255,179,0,0.35)" : "var(--border-default)"}`,
            }}
          >
            {sortKey === "daysSince" && <X size={10} />}
            No contact longest
          </button>
        </div>

        {/* Row 2: stage pills grouped */}
        <div className="flex gap-5 items-start pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {[
            {
              label: "Status",
              accent: "var(--text-tertiary)",
              filters: [
                { v: "all", label: "All" },
                { v: "inConvo", label: "In Convo", dot: "rgba(255,59,59,0.8)" },
              ],
            },
            {
              label: "Outreach",
              accent: "var(--text-tertiary)",
              filters: [
                { v: "all", label: "All" },
                { v: "notOutreached", label: "Not Outreached" },
                { v: "outreached", label: "Outreached" },
                { v: "overdue3", label: "Overdue 3+ days" },
                { v: "overdue7", label: "Overdue 7+ days" },
              ],
            },
            {
              label: "Pipeline",
              accent: "var(--text-tertiary)",
              filters: [
                { v: "all", label: "All" },
                { v: "inConvo", label: "In Convo", dot: "rgba(255,59,59,0.8)", red: true },
                { v: "replied", label: "Replied" },
                { v: "booked", label: "Booked" },
                { v: "showed", label: "Showed" },
                { v: "closed", label: "Closed" },
                { v: "lost", label: "Lost", red: true },
              ],
            },
          ].map((group, gi) => (
            <div key={group.label} className="flex flex-col gap-2 min-w-0" style={{ paddingTop: 10, ...(gi > 0 ? { paddingLeft: 20, borderLeft: "1px solid var(--border-subtle)" } : {}) }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
              }}>
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {group.filters.map((f) => {
                  const active = filterStage === f.v;
                  const isRed = "red" in f && f.red;
                  return (
                    <button
                      key={f.v}
                      onClick={() => setFilterStage(active ? "all" : f.v)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                      style={{
                        fontFamily: "var(--font-display)",
                        background: active ? (isRed ? "rgba(255,59,59,0.12)" : "var(--accent-muted)") : "transparent",
                        color: active ? (isRed ? "rgb(255,80,80)" : "var(--accent)") : "var(--text-secondary)",
                        border: `1px solid ${active ? (isRed ? "rgba(255,59,59,0.4)" : "var(--accent-border)") : "var(--border-subtle)"}`,
                        boxShadow: active && isRed ? "0 0 8px rgba(255,59,59,0.25)" : undefined,
                      }}
                    >
                      {"dot" in f && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.dot as string }} />}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl overflow-hidden${expanded ? " crm-expanded" : ""}`} style={{ border: "1px solid var(--border-default)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: 12, tableLayout: "auto" }}>
            <thead>
              <tr>
                <ThCol center>#</ThCol>
                <ThCol sortable k="createdAt">Lead</ThCol>
                <ThCol>Source</ThCol>
                <ThCol>Socials</ThCol>
                <ThCol section="outreach">
                  <div className="flex flex-col gap-0.5">
                    <span>Outreached</span>
                    <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text-tertiary)", letterSpacing: "0.01em", textTransform: "none", fontFamily: "var(--font-mono)" }}>tap icon to mark</span>
                  </div>
                </ThCol>
                <ThCol section="outreach" sortable k="dateMessaged">Date Sent</ThCol>
                <ThCol section="outreach">Follow-ups</ThCol>
                <ThCol section="outreach">Last Follow-up</ThCol>
                <ThCol section="outreach" sortable k="daysSince">Days Since</ThCol>
                <ThCol section="messages">Outreach Msg</ThCol>
                <ThCol section="messages" center>Replied</ThCol>
                <ThCol section="messages">Reply Msg</ThCol>
                <ThCol section="pipeline" center>Booked</ThCol>
                <ThCol section="pipeline" center>Showed</ThCol>
                <ThCol section="pipeline" center>Closed</ThCol>
                <ThCol />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-6 py-14 text-center" style={{ color: "var(--text-tertiary)", fontSize: 13, background: "var(--bg-surface)" }}>
                    {leads.length === 0 ? "No leads yet — import a CSV or add one manually." : "No leads match your filters."}
                  </td>
                </tr>
              )}
              {filtered.map((lead, i) => {
                const isSaving = saving.has(lead.id);
                const isNew = lead.id === newLeadId;
                const isBookmarked = lead.id === bookmarkId;
                const isLost = lead.leadLost;
                const isDone = lead.markedDone;
                const days = daysSinceLastTouch(lead);
                const base: React.CSSProperties = {
                  background: isBookmarked
                    ? "rgba(251,191,36,0.09)"
                    : isDone
                    ? "rgba(61,214,140,0.06)"
                    : isNew
                    ? "rgba(61,214,140,0.07)"
                    : isLost
                    ? "rgba(100,60,60,0.06)"
                    : i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
                  opacity: isSaving ? 0.8 : isLost ? 0.55 : isDone ? 0.7 : 1,
                  transition: "background 0.4s, opacity 0.15s",
                  // Bookmark: thick solid amber outline = banner effect
                  outline: isBookmarked
                    ? "2px solid rgba(251,191,36,0.75)"
                    : isNew ? "1px solid rgba(61,214,140,0.3)" : undefined,
                  boxShadow: isBookmarked
                    ? "inset 5px 0 0 rgb(251,191,36)"
                    : isDone
                    ? "inset 4px 0 0 rgb(61,214,140)"
                    : isLost
                    ? "inset 3px 0 0 rgba(160,80,80,0.5)"
                    : undefined,
                };
                return (
                  <tr
                    key={lead.id}
                    ref={(el) => { if (el) rowRefs.current.set(lead.id, el); else rowRefs.current.delete(lead.id); }}
                    style={base}
                  >
                    {/* Row number + bookmark + done */}
                    <td style={{ ...tdStyle(), textAlign: "center", width: 44, minWidth: 44, padding: "8px 4px" }}>
                      <div className="flex flex-col items-center gap-1">
                        <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                          {importOrder.get(lead.id) ?? "—"}
                        </span>
                        <button
                          onClick={() => toggleBookmark(lead.id)}
                          title={isBookmarked ? "Clear bookmark" : "Bookmark — I'm here"}
                          className="crm-pin transition-all"
                          style={{ opacity: isBookmarked ? 1 : 0, color: "rgb(251,191,36)" }}
                        >
                          <Bookmark size={14} fill="rgb(251,191,36)" />
                        </button>
                        <button
                          onClick={() => patch(lead.id, "markedDone", !isDone)}
                          title={isDone ? "Mark as not done" : "Mark as done"}
                          className="crm-pin transition-all"
                          style={{ opacity: isDone ? 1 : 0, color: "rgb(61,214,140)" }}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      </div>
                    </td>
                    {/* Lead Name + In Convo toggle + warm/cold badge */}
                    <td style={tdStyle()}>
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          value={lead.leadName}
                          onChange={(e) => patch(lead.id, "leadName", e.target.value || "Lead")}
                          className="crm-lead-input text-sm font-medium rounded px-2 py-1 w-[145px]"
                          style={inputStyle}
                        />
                        <div className="flex items-center gap-1.5">
                          {(() => { const t = leadTemperature(lead); return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "var(--font-display)", color: t.color, background: t.bg, border: `1px solid ${t.border}` }}>
                              {t.label}
                            </span>
                          ); })()}
                          <button
                            onClick={() => patch(lead.id, "inConvo", !lead.inConvo)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-left transition-all w-fit"
                            style={{
                              background: lead.inConvo ? "rgba(255,59,59,0.15)" : "transparent",
                              border: lead.inConvo ? "1px solid rgba(255,59,59,0.5)" : "1px solid var(--border-subtle)",
                              color: lead.inConvo ? "rgb(255,80,80)" : "var(--text-tertiary)",
                              boxShadow: lead.inConvo ? "0 0 8px rgba(255,59,59,0.3)" : undefined,
                            }}
                          >
                            <Radio size={9} />
                            <span style={{ fontSize: 9, fontWeight: lead.inConvo ? 700 : 400, letterSpacing: "0.04em" }}>
                              {lead.inConvo ? "IN CONVO" : "in convo?"}
                            </span>
                          </button>
                          <button
                            onClick={() => patch(lead.id, "leadLost", !lead.leadLost)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-left transition-all w-fit"
                            style={{
                              background: lead.leadLost ? "rgba(160,80,80,0.15)" : "transparent",
                              border: lead.leadLost ? "1px solid rgba(160,80,80,0.5)" : "1px solid var(--border-subtle)",
                              color: lead.leadLost ? "rgb(200,100,100)" : "var(--text-tertiary)",
                            }}
                          >
                            <X size={9} />
                            <span style={{ fontSize: 9, fontWeight: lead.leadLost ? 700 : 400, letterSpacing: "0.04em" }}>
                              {lead.leadLost ? "LOST" : "lost?"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Lead Source */}
                    <td style={tdStyle()}>
                      <div className="relative">
                        <select
                          value={lead.leadSource ?? "cold_outbound"}
                          onChange={(e) => patch(lead.id, "leadSource", e.target.value)}
                          className="text-xs rounded px-2 py-1.5 w-[130px] pr-6"
                          style={{ ...selectStyle, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                        >
                          {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <DropIcon size={10} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
                      </div>
                    </td>

                    {/* Socials */}
                    <td style={tdStyle()}>
                      <div className="flex flex-col gap-1.5">
                        <SocialRow platform="ig" label="Instagram" icon={<IgIcon />} color="#E1306C" value={lead.instagram} onChange={(v) => patch(lead.id, "instagram", v)} />
                        <SocialRow platform="email" label="Email" icon={<GmailIcon />} color="#4F8EF7" value={lead.email} onChange={(v) => patch(lead.id, "email", v)} />
                        <SocialRow platform="linkedin" label="LinkedIn" icon={<LinkedInIcon />} color="#0A66C2" value={lead.linkedin} onChange={(v) => patch(lead.id, "linkedin", v)} />
                        <SocialRow platform="x" label="X / Twitter" icon={<XIcon />} color="var(--text-secondary)" value={lead.x} onChange={(v) => patch(lead.id, "x", v)} />
                      </div>
                    </td>

                    {/* Outreached pills */}
                    <td style={tdStyle("outreach")}>
                      <OutreachPills lead={lead} patch={patch} />
                    </td>

                    {/* Date Messaged */}
                    <td style={tdStyle("outreach")}>
                      <DateCell value={lead.dateMessaged} onChange={(v) => patch(lead.id, "dateMessaged", v)} />
                    </td>

                    {/* Follow-ups */}
                    <td style={tdStyle("outreach")}>
                      <div className="flex flex-col gap-1.5">
                        {[
                          { label: "1st", field: "followUp1", value: lead.followUp1 },
                          { label: "2nd", field: "followUp2", value: lead.followUp2 },
                          { label: "3rd", field: "followUp3", value: lead.followUp3 },
                        ].map(({ label, field, value }) => (
                          <div key={field} className="flex items-center gap-1.5">
                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)", width: 20, flexShrink: 0 }}>{label}</span>
                            <DateCell value={value} onChange={(v) => patch(lead.id, field, v)} />
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Last Follow-up Date */}
                    <td style={tdStyle("outreach")}>
                      <DateCell value={lead.lastFollowUpDate} onChange={(v) => patch(lead.id, "lastFollowUpDate", v)} />
                    </td>

                    {/* Days Since Last Touch */}
                    <td style={{ ...tdStyle("outreach"), textAlign: "center" }}>
                      <StaleBadge days={days} />
                    </td>

                    {/* Outreach Message */}
                    <td style={tdStyle("messages")}>
                      <TextareaCell value={lead.notes} onChange={(v) => patch(lead.id, "notes", v)} placeholder="Message you sent…" />
                    </td>

                    {/* Replied */}
                    <td style={tdStyle("messages")}>
                      <div className="flex justify-center pt-1">
                        <Checkbox checked={lead.replied} onChange={(v) => patch(lead.id, "replied", v)} />
                      </div>
                    </td>

                    {/* Reply Message */}
                    <td style={tdStyle("messages")}>
                      <TextareaCell value={lead.replyMessage} onChange={(v) => patch(lead.id, "replyMessage", v)} placeholder="What they replied…" />
                    </td>

                    {/* Booked */}
                    <td style={tdStyle("pipeline")}>
                      <div className="flex justify-center pt-1">
                        <Checkbox checked={lead.callBooked} onChange={(v) => patch(lead.id, "callBooked", v)} />
                      </div>
                    </td>

                    {/* Showed */}
                    <td style={tdStyle("pipeline")}>
                      <div className="flex justify-center pt-1">
                        <Checkbox checked={lead.showedUpToCall} onChange={(v) => patch(lead.id, "showedUpToCall", v)} />
                      </div>
                    </td>

                    {/* Closed */}
                    <td style={tdStyle("pipeline")}>
                      <div className="flex justify-center pt-1">
                        <Checkbox checked={lead.closedCall} onChange={(v) => patch(lead.id, "closedCall", v)} />
                      </div>
                    </td>

                    {/* Delete */}
                    <td style={tdStyle()}>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ color: "var(--text-tertiary)" }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-end gap-3 mt-3">
          {(search || filterStage !== "all" || sortKey !== "createdAt" || sortDir !== "asc") && (
            <button
              onClick={() => { setSearch(""); setFilterStage("all"); setSortKey("createdAt"); setSortDir("asc"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            >
              <X size={11} />
              Clear filters — show all
            </button>
          )}
          <p className="label-mono">{filtered.length} of {leads.length} leads shown</p>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onSubmit={submitNewLead} />
      )}

      {/* CSV Confirm Modal */}
      {csvConfirm && (
        <CsvConfirmModal
          toAdd={csvConfirm.toAdd}
          duplicates={csvConfirm.duplicates}
          onConfirm={confirmCsvImport}
          onCancel={() => setCsvConfirm(null)}
          importing={importing}
        />
      )}

      {/* Delete All Confirm Modal */}
      {showDeleteAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !deletingAll && setShowDeleteAll(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "rgba(255,59,59,0.12)" }}>
                <Trash2 size={16} style={{ color: "rgb(255,80,80)" }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Delete all leads?</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>This will permanently remove all {leads.length} lead{leads.length !== 1 ? "s" : ""}. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteAll(false)}
                disabled={deletingAll}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAllLeads}
                disabled={deletingAll}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.4)", color: "rgb(255,80,80)" }}
              >
                {deletingAll ? "Deleting…" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
