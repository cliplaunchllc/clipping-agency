"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Upload, Plus, Trash2, ChevronUp, ChevronDown, Search, X,
  ExternalLink, Phone, TrendingUp, Users, MessageSquare, Calendar,
  CheckCircle2, ChevronDown as DropIcon, Radio, AlertTriangle, Bookmark,
  ChevronRight,
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
  niche: string | null;
  companyDescription: string | null;
  initialMessage: string | null;
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

const NICHE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "gaming", label: "Gaming" },
  { value: "entertainment", label: "Entertainment" },
  { value: "agency", label: "Agency" },
  { value: "sports", label: "Sports" },
  { value: "podcast", label: "Podcast" },
  { value: "irl", label: "IRL / Lifestyle" },
  { value: "other", label: "Other" },
];

const SOURCE_OPTIONS = [
  { value: "cold_outbound", label: "Cold Outbound" },
  { value: "referral", label: "Referral" },
  { value: "inbound", label: "Inbound" },
  { value: "partnership", label: "Partnership" },
  { value: "Grok Bot", label: "Grok Bot" },
  { value: "other", label: "Other" },
];

const NICHE_COLORS: Record<string, { color: string; bg: string }> = {
  gaming:        { color: "rgb(99,179,237)", bg: "rgba(99,179,237,0.12)" },
  entertainment: { color: "rgb(236,153,75)", bg: "rgba(236,153,75,0.12)" },
  agency:        { color: "rgb(154,117,247)", bg: "rgba(154,117,247,0.12)" },
  sports:        { color: "rgb(72,199,142)", bg: "rgba(72,199,142,0.12)" },
  podcast:       { color: "rgb(240,100,160)", bg: "rgba(240,100,160,0.12)" },
  irl:           { color: "rgb(255,196,0)", bg: "rgba(255,196,0,0.12)" },
  other:         { color: "var(--text-tertiary)", bg: "rgba(255,255,255,0.05)" },
};

function leadStage(lead: CrmLead): { label: string; color: string; bg: string; border: string } {
  if (lead.leadLost)         return { label: "Lost",    color: "rgb(160,80,80)",     bg: "rgba(160,80,80,0.1)",    border: "rgba(160,80,80,0.3)"   };
  if (lead.closedCall)       return { label: "Closed",  color: "rgb(61,255,162)",    bg: "rgba(61,214,140,0.12)",  border: "rgba(61,214,140,0.4)"  };
  if (lead.showedUpToCall)   return { label: "Showed",  color: "rgb(255,120,60)",    bg: "rgba(255,120,60,0.12)",  border: "rgba(255,120,60,0.4)"  };
  if (lead.callBooked)       return { label: "Booked",  color: "rgb(255,160,40)",    bg: "rgba(255,160,40,0.12)",  border: "rgba(255,160,40,0.4)"  };
  if (lead.inConvo)          return { label: "In Convo",color: "rgb(255,80,80)",     bg: "rgba(255,59,59,0.12)",   border: "rgba(255,59,59,0.4)"   };
  if (lead.replied)          return { label: "Replied", color: "rgb(251,191,36)",    bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.4)"  };
  if (lead.outreachedIg || lead.outreachedEmail || lead.outreachedLinkedin || lead.outreachedX)
    return { label: "Outreached", color: "rgb(140,160,200)", bg: "rgba(140,160,200,0.08)", border: "rgba(140,160,200,0.25)" };
  return { label: "New",    color: "var(--text-tertiary)", bg: "transparent", border: "var(--border-subtle)" };
}

type SortKey = "leadName" | "dateMessaged" | "createdAt" | "daysSince";
type SortDir = "asc" | "desc";

// ─── Icons ───────────────────────────────────────────────────────────
function IgIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
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
  if (days === null) return <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>;
  let bg = "rgba(61,214,140,0.12)";
  let color = "var(--success)";
  if (days >= 7) { bg = "rgba(255,59,59,0.12)"; color = "var(--error, #ff5a5a)"; }
  else if (days >= 3) { bg = "rgba(255,179,0,0.12)"; color = "var(--warning, #ffb300)"; }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ background: bg, color, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
      {days}d ago
    </span>
  );
}

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
      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all"
      style={{
        background: checked ? "rgba(61,214,140,0.22)" : "transparent",
        border: checked ? "1px solid rgba(61,214,140,0.7)" : "1px solid var(--border-default)",
        boxShadow: checked ? "0 0 10px rgba(61,214,140,0.4)" : undefined,
      }}
    >
      {checked && <CheckCircle2 size={15} color="rgb(61,255,162)" strokeWidth={2.5} />}
    </button>
  );
}

function DrawerDateInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
      <input
        type="date"
        value={value ? value.slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-sm rounded-lg px-3 py-2"
        style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: value ? "var(--text-primary)" : "var(--text-tertiary)", colorScheme: "dark", width: "100%" }}
      />
    </div>
  );
}

function DrawerTextarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string | null; onChange: (v: string | null) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm rounded-lg px-3 py-2 resize-none"
        style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

function DrawerInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string | null; onChange: (v: string | null) => void; placeholder?: string; type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="text-sm rounded-lg px-3 py-2"
        style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

function DrawerSelect({ label, value, onChange, options }: { label: string; value: string | null; onChange: (v: string | null) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full text-sm rounded-lg px-3 py-2 pr-8"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
      </div>
    </div>
  );
}

// ─── Lead Drawer ──────────────────────────────────────────────────────
function LeadDrawer({
  lead,
  onClose,
  patch,
  onDelete,
  importNum,
}: {
  lead: CrmLead;
  onClose: () => void;
  patch: (id: string, field: string, value: unknown) => void;
  onDelete: (id: string) => void;
  importNum: number;
}) {
  const p = (field: string, value: unknown) => patch(lead.id, field, value);
  const stage = leadStage(lead);
  const days = daysSinceLastTouch(lead);
  const nicheStyle = lead.niche && NICHE_COLORS[lead.niche] ? NICHE_COLORS[lead.niche] : null;

  const outreachPlatforms = [
    { key: "outreachedIg", label: "Instagram", icon: <IgIcon size={14} />, color: "#E1306C" },
    { key: "outreachedEmail", label: "Email", icon: <GmailIcon size={14} />, color: "#4F8EF7" },
    { key: "outreachedLinkedin", label: "LinkedIn", icon: <LinkedInIcon size={14} />, color: "#0A66C2" },
    { key: "outreachedX", label: "X", icon: <XIcon size={14} />, color: "var(--text-secondary)" },
  ];

  const labelSty: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.04em", textTransform: "uppercase", display: "block", marginBottom: 6 };
  const sectionSty: React.CSSProperties = { borderTop: "1px solid var(--border-subtle)", paddingTop: 20, marginTop: 4 };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: 500, background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)", boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>#{importNum}</span>
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ color: stage.color, background: stage.bg, border: `1px solid ${stage.border}`, letterSpacing: "0.04em" }}
            >
              {stage.label}
            </span>
            {nicheStyle && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: nicheStyle.color, background: nicheStyle.bg }}>
                {NICHE_OPTIONS.find((o) => o.value === lead.niche)?.label ?? lead.niche}
              </span>
            )}
            {days !== null && <StaleBadge days={days} />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm("Delete this lead?")) { onDelete(lead.id); onClose(); } }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ color: "rgb(255,80,80)", background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)" }}
              title="Delete lead"
            >
              <Trash2 size={13} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: "var(--text-tertiary)", background: "var(--bg-base)", border: "1px solid var(--border-default)" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Name */}
          <div>
            <label style={labelSty}>Lead Name</label>
            <input
              type="text"
              value={lead.leadName}
              onChange={(e) => p("leadName", e.target.value || "Lead")}
              className="w-full text-base font-semibold rounded-lg px-3 py-2.5"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
            />
          </div>

          {/* Status toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => p("inConvo", !lead.inConvo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: lead.inConvo ? "rgba(255,59,59,0.15)" : "var(--bg-base)", border: lead.inConvo ? "1px solid rgba(255,59,59,0.5)" : "1px solid var(--border-default)", color: lead.inConvo ? "rgb(255,80,80)" : "var(--text-tertiary)", boxShadow: lead.inConvo ? "0 0 8px rgba(255,59,59,0.3)" : undefined }}
            >
              <Radio size={10} /> {lead.inConvo ? "In Convo" : "In Convo?"}
            </button>
            <button
              onClick={() => p("leadLost", !lead.leadLost)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: lead.leadLost ? "rgba(160,80,80,0.15)" : "var(--bg-base)", border: lead.leadLost ? "1px solid rgba(160,80,80,0.5)" : "1px solid var(--border-default)", color: lead.leadLost ? "rgb(200,100,100)" : "var(--text-tertiary)" }}
            >
              <X size={10} /> {lead.leadLost ? "Lost" : "Mark Lost"}
            </button>
            <button
              onClick={() => p("markedDone", !lead.markedDone)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: lead.markedDone ? "rgba(61,214,140,0.15)" : "var(--bg-base)", border: lead.markedDone ? "1px solid rgba(61,214,140,0.5)" : "1px solid var(--border-default)", color: lead.markedDone ? "rgb(61,255,162)" : "var(--text-tertiary)" }}
            >
              <CheckCircle2 size={10} /> {lead.markedDone ? "Done" : "Mark Done"}
            </button>
          </div>

          {/* Contact */}
          <div style={sectionSty}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Contact Info</p>
            <div className="flex flex-col gap-3">
              <DrawerInput label="Instagram" value={lead.instagram} onChange={(v) => p("instagram", v)} placeholder="@handle" />
              <DrawerInput label="Email" value={lead.email} onChange={(v) => p("email", v)} placeholder="email@…" type="email" />
              <DrawerInput label="LinkedIn" value={lead.linkedin} onChange={(v) => p("linkedin", v)} placeholder="@handle or URL" />
              <DrawerInput label="X / Twitter" value={lead.x} onChange={(v) => p("x", v)} placeholder="@handle" />
            </div>
            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-3">
              {lead.instagram && (
                <a href={buildSocialLink("ig", lead.instagram)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs" style={{ background: "rgba(225,48,108,0.1)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.25)" }}>
                  <IgIcon size={11} /> Instagram <ExternalLink size={9} />
                </a>
              )}
              {lead.email && (
                <a href={buildSocialLink("email", lead.email)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs" style={{ background: "rgba(79,142,247,0.1)", color: "#4F8EF7", border: "1px solid rgba(79,142,247,0.25)" }}>
                  <GmailIcon size={11} /> Email <ExternalLink size={9} />
                </a>
              )}
              {lead.linkedin && (
                <a href={buildSocialLink("linkedin", lead.linkedin)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs" style={{ background: "rgba(10,102,194,0.1)", color: "#0A66C2", border: "1px solid rgba(10,102,194,0.25)" }}>
                  <LinkedInIcon size={11} /> LinkedIn <ExternalLink size={9} />
                </a>
              )}
              {lead.x && (
                <a href={buildSocialLink("x", lead.x)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                  <XIcon size={11} /> X <ExternalLink size={9} />
                </a>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={sectionSty}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Details</p>
            <div className="grid grid-cols-2 gap-3">
              <DrawerSelect label="Niche" value={lead.niche} onChange={(v) => p("niche", v)} options={NICHE_OPTIONS} />
              <DrawerSelect label="Lead Source" value={lead.leadSource} onChange={(v) => p("leadSource", v)} options={SOURCE_OPTIONS} />
            </div>
            <div className="mt-3">
              <DrawerSelect label="Who Messaged" value={lead.whoMessaged} onChange={(v) => p("whoMessaged", v)} options={[{ value: "", label: "— select —" }, ...WHO_OPTIONS]} />
            </div>
            <div className="mt-3">
              <DrawerTextarea label="Company / Channel Description" value={lead.companyDescription} onChange={(v) => p("companyDescription", v)} placeholder="What they do, their audience, channel size…" rows={3} />
            </div>
          </div>

          {/* Outreach */}
          <div style={sectionSty}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Outreach</p>

            {/* Platform checkboxes */}
            <label style={labelSty}>Outreached Via</label>
            <div className="flex items-center gap-2 mb-4">
              {outreachPlatforms.map(({ key, label, icon, color }) => {
                const checked = lead[key as keyof CrmLead] as boolean;
                return (
                  <button
                    key={key}
                    onClick={() => p(key, !checked)}
                    title={label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: checked ? `${color}18` : "var(--bg-base)",
                      border: `1px solid ${checked ? color : "var(--border-default)"}`,
                      color: checked ? color : "var(--text-tertiary)",
                      opacity: checked ? 1 : 0.6,
                    }}
                  >
                    {icon} {label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DrawerDateInput label="Date Messaged" value={lead.dateMessaged} onChange={(v) => p("dateMessaged", v)} />
              <DrawerDateInput label="Last Follow-up" value={lead.lastFollowUpDate} onChange={(v) => p("lastFollowUpDate", v)} />
              <DrawerDateInput label="Follow-up 1" value={lead.followUp1} onChange={(v) => p("followUp1", v)} />
              <DrawerDateInput label="Follow-up 2" value={lead.followUp2} onChange={(v) => p("followUp2", v)} />
              <DrawerDateInput label="Follow-up 3" value={lead.followUp3} onChange={(v) => p("followUp3", v)} />
            </div>

            <div className="mt-3">
              <DrawerTextarea label="Outreach Message Sent" value={lead.notes} onChange={(v) => p("notes", v)} placeholder="The message you sent them…" rows={3} />
            </div>
          </div>

          {/* Their Response */}
          <div style={sectionSty}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Their Response</p>

            <DrawerTextarea label="Initial Message They Sent" value={lead.initialMessage} onChange={(v) => p("initialMessage", v)} placeholder="The first message they sent us…" rows={2} />

            <div className="mt-4 flex items-center gap-3">
              <label style={{ ...labelSty, margin: 0 }}>Replied</label>
              <Checkbox checked={lead.replied} onChange={(v) => p("replied", v)} />
            </div>

            {lead.replied && (
              <div className="mt-3">
                <DrawerTextarea label="Reply Message" value={lead.replyMessage} onChange={(v) => p("replyMessage", v)} placeholder="What they replied…" rows={3} />
              </div>
            )}
          </div>

          {/* Pipeline */}
          <div style={sectionSty}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Pipeline</p>
            <div className="flex flex-col gap-3">
              {[
                { key: "callBooked", label: "Call Booked" },
                { key: "showedUpToCall", label: "Showed Up to Call" },
                { key: "closedCall", label: "Closed" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <Checkbox checked={lead[key as keyof CrmLead] as boolean} onChange={(v) => p(key, v)} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 24 }} />
        </div>
      </div>
    </>
  );
}

// ─── Add Lead Modal ───────────────────────────────────────────────────
type NewLeadForm = { leadName: string; instagram: string; email: string; linkedin: string; x: string; whoMessaged: string; leadSource: string; niche: string; companyDescription: string; initialMessage: string };

function AddLeadModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: NewLeadForm) => Promise<void> }) {
  const [form, setForm] = useState<NewLeadForm>({ leadName: "", instagram: "", email: "", linkedin: "", x: "", whoMessaged: "", leadSource: "cold_outbound", niche: "", companyDescription: "", initialMessage: "" });
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
      <div className="w-[460px] rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>New Lead</h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={labelSty}>Name <span style={{ color: "var(--accent)" }}>*</span></label>
            <input ref={nameRef} required value={form.leadName} onChange={(e) => set("leadName", e.target.value)} placeholder="Full name or handle" className={inputCls} style={inputSty} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSty}>Instagram</label>
              <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}>Email</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@…" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}>LinkedIn</label>
              <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="@handle or URL" className={inputCls} style={inputSty} />
            </div>
            <div>
              <label style={labelSty}>X / Twitter</label>
              <input value={form.x} onChange={(e) => set("x", e.target.value)} placeholder="@handle" className={inputCls} style={inputSty} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelSty}>Lead Source</label>
              <div className="relative">
                <select value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} className={`${inputCls} pr-8`} style={{ ...inputSty, appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}>
                  {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
              </div>
            </div>
            <div>
              <label style={labelSty}>Niche</label>
              <div className="relative">
                <select value={form.niche} onChange={(e) => set("niche", e.target.value)} className={`${inputCls} pr-8`} style={{ ...inputSty, appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}>
                  {NICHE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
              </div>
            </div>
          </div>
          <div>
            <label style={labelSty}>Company / Channel Description</label>
            <textarea value={form.companyDescription} onChange={(e) => set("companyDescription", e.target.value)} placeholder="What they do…" rows={2} className={`${inputCls} resize-none`} style={inputSty} />
          </div>
          <div>
            <label style={labelSty}>Their Initial Message</label>
            <textarea value={form.initialMessage} onChange={(e) => set("initialMessage", e.target.value)} placeholder="First message they sent…" rows={2} className={`${inputCls} resize-none`} style={inputSty} />
          </div>
          <div>
            <label style={labelSty}>Who&apos;s Messaging</label>
            <div className="relative">
              <select value={form.whoMessaged} onChange={(e) => set("whoMessaged", e.target.value)} className={`${inputCls} pr-8`} style={{ ...inputSty, appearance: "none", WebkitAppearance: "none", cursor: "pointer", colorScheme: "dark" }}>
                <option value="">— select —</option>
                {WHO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <DropIcon size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>Cancel</button>
            <button type="submit" disabled={saving || !form.leadName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "white", opacity: saving || !form.leadName.trim() ? 0.6 : 1 }}>
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
  toAdd: CsvRow[]; duplicates: string[]; onConfirm: () => void; onCancel: () => void; importing: boolean;
}) {
  const [showDupes, setShowDupes] = useState(false);
  const total = toAdd.length + duplicates.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onCancel}>
      <div className="w-[480px] rounded-2xl p-6 flex flex-col gap-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Review CSV Import</h2>
          <button onClick={onCancel} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>
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
        {duplicates.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,59,59,0.2)", background: "rgba(255,59,59,0.04)" }}>
            <button className="w-full flex items-center justify-between px-4 py-2.5 text-left" onClick={() => setShowDupes((s) => !s)}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{duplicates.length} duplicate{duplicates.length !== 1 ? "s" : ""} will be skipped</span>
              </div>
              <DropIcon size={12} style={{ color: "var(--accent)", transform: showDupes ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {showDupes && (
              <div className="px-4 pb-3 max-h-36 overflow-y-auto" style={{ borderTop: "1px solid rgba(255,59,59,0.15)" }}>
                {duplicates.map((name) => <p key={name} className="py-1 text-xs" style={{ color: "var(--text-secondary)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{name}</p>)}
              </div>
            )}
          </div>
        )}
        {toAdd.length === 0 && <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>All leads in this CSV already exist — nothing to import.</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={onConfirm} disabled={toAdd.length === 0 || importing} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "white", opacity: toAdd.length === 0 || importing ? 0.5 : 1 }}>
            {importing ? "Importing…" : `Import ${toAdd.length} lead${toAdd.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────
export default function CrmDashboard({ initialLeads }: { initialLeads: CrmLead[] }) {
  const [leads, setLeads] = useState<CrmLead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [newLeadId, setNewLeadId] = useState<string | null>(null);
  const [csvConfirm, setCsvConfirm] = useState<{ toAdd: CsvRow[]; duplicates: string[] } | null>(null);
  const [bookmarkId, setBookmarkId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("crm_bookmark");
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const patchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
        niche: form.niche || null,
        companyDescription: form.companyDescription || null,
        initialMessage: form.initialMessage || null,
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
    setOpenLeadId(lead.id);
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
      return { leadName, instagram: obj["Instagram"] || obj["instagram"] || "", email: obj["Email"] || obj["email"] || "", linkedin: obj["LinkedIn"] || obj["linkedin"] || "", x: obj["X"] || obj["Twitter"] || obj["twitter"] || obj["x"] || "" };
    }).filter((r) => r.leadName.length > 0);
  }, []);

  const handleCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = "";
    const rows = parseCsvRows(text);
    if (rows.length === 0) return;
    const seenInCsv = new Set<string>();
    const csvDupeNames: string[] = [];
    const uniqueRows = rows.filter((r) => {
      const key = r.leadName.toLowerCase();
      if (seenInCsv.has(key)) { csvDupeNames.push(r.leadName); return false; }
      seenInCsv.add(key); return true;
    });
    const existingNames = new Set(leads.map((l) => l.leadName.trim().toLowerCase()));
    const existingDupeNames = uniqueRows.filter((r) => existingNames.has(r.leadName.toLowerCase())).map((r) => r.leadName);
    const toAdd = uniqueRows.filter((r) => !existingNames.has(r.leadName.toLowerCase()));
    setCsvConfirm({ toAdd, duplicates: [...csvDupeNames, ...existingDupeNames] });
  }, [leads, parseCsvRows]);

  const confirmCsvImport = useCallback(async () => {
    if (!csvConfirm || csvConfirm.toAdd.length === 0) return;
    setImporting(true);
    const res = await fetch("/api/agency/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(csvConfirm.toAdd) });
    if (res.ok) {
      const result: { created: number; skipped: number } = await res.json();
      const fresh = await fetch("/api/agency/crm");
      if (fresh.ok) setLeads(await fresh.json());
      const skipped = csvConfirm.duplicates.length + result.skipped;
      setImportMsg(skipped > 0 ? `${result.created} added, ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped` : `${result.created} lead${result.created !== 1 ? "s" : ""} imported`);
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
      setImportMsg(removed > 0 ? `${removed} duplicate${removed !== 1 ? "s" : ""} removed` : "No duplicates found");
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
      list = list.filter((l) => l.leadName.toLowerCase().includes(q) || (l.instagram ?? "").toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q) || (l.companyDescription ?? "").toLowerCase().includes(q));
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
      let va: number | string = 0, vb: number | string = 0;
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

  const thSty: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em", padding: "10px 14px", whiteSpace: "nowrap", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-default)", textAlign: "left" };
  const tdSty: React.CSSProperties = { padding: "12px 14px", verticalAlign: "middle", borderBottom: "1px solid var(--border-subtle)" };

  const openLead = openLeadId ? leads.find((l) => l.id === openLeadId) ?? null : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>CRM</h1>
          <p className="metric-sub mt-0.5">{leads.length} leads total</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
          <button onClick={() => setShowDeleteAll(true)} disabled={leads.length === 0} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.25)", color: "rgb(255,80,80)", opacity: leads.length === 0 ? 0.4 : 1 }}>
            <Trash2 size={14} /> Delete All
          </button>
          <button onClick={deduplicateLeads} disabled={deduping} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }} title="Remove duplicate lead names (keeps oldest)">
            {deduping ? "Checking…" : "Remove Dupes"}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
            <Upload size={14} /> {importing ? "Importing…" : "Import CSV"}
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "white" }}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Toast */}
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className="pl-8 pr-8 py-2 rounded-lg text-sm w-[220px]" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}><X size={13} /></button>}
          </div>
          <button
            onClick={() => sortKey === "daysSince" ? (setSortKey("createdAt"), setSortDir("asc")) : (setSortKey("daysSince"), setSortDir("desc"))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: sortKey === "daysSince" ? "rgba(255,179,0,0.1)" : "transparent", color: sortKey === "daysSince" ? "#ffb300" : "var(--text-tertiary)", border: `1px solid ${sortKey === "daysSince" ? "rgba(255,179,0,0.35)" : "var(--border-default)"}` }}
          >
            {sortKey === "daysSince" && <X size={10} />}
            No contact longest
          </button>
        </div>
        <div className="flex gap-5 items-start pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Outreach", filters: [{ v: "all", label: "All" }, { v: "notOutreached", label: "Not Outreached" }, { v: "outreached", label: "Outreached" }, { v: "overdue3", label: "Overdue 3d" }, { v: "overdue7", label: "Overdue 7d" }] },
            { label: "Pipeline", filters: [{ v: "all", label: "All" }, { v: "inConvo", label: "In Convo", red: true }, { v: "replied", label: "Replied" }, { v: "booked", label: "Booked" }, { v: "showed", label: "Showed" }, { v: "closed", label: "Closed" }, { v: "lost", label: "Lost", red: true }] },
          ].map((group, gi) => (
            <div key={group.label} className="flex flex-col gap-2" style={{ paddingTop: 10, ...(gi > 0 ? { paddingLeft: 20, borderLeft: "1px solid var(--border-subtle)" } : {}) }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>{group.label}</span>
              <div className="flex flex-wrap gap-1">
                {group.filters.map((f) => {
                  const active = filterStage === f.v;
                  const isRed = "red" in f && f.red;
                  return (
                    <button key={f.v} onClick={() => setFilterStage(active ? "all" : f.v)} className="px-2.5 py-1 rounded-md text-xs font-medium transition-all" style={{ fontFamily: "var(--font-display)", background: active ? (isRed ? "rgba(255,59,59,0.12)" : "var(--accent-muted)") : "transparent", color: active ? (isRed ? "rgb(255,80,80)" : "var(--accent)") : "var(--text-secondary)", border: `1px solid ${active ? (isRed ? "rgba(255,59,59,0.4)" : "var(--accent-border)") : "var(--border-subtle)"}` }}>
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
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
        <table className="w-full border-collapse" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thSty, width: 44, textAlign: "center" }}>#</th>
              <th style={{ ...thSty, cursor: "pointer" }} onClick={() => toggleSort("leadName")}>
                <span className="inline-flex items-center gap-1">Lead {sortKey === "leadName" ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronUp size={11} style={{ opacity: 0.3 }} />}</span>
              </th>
              <th style={thSty}>Company / Description</th>
              <th style={thSty}>Contact</th>
              <th style={{ ...thSty, cursor: "pointer" }} onClick={() => toggleSort("daysSince")}>
                <span className="inline-flex items-center gap-1">Days Since {sortKey === "daysSince" ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronUp size={11} style={{ opacity: 0.3 }} />}</span>
              </th>
              <th style={thSty}>Outreached</th>
              <th style={thSty}>Stage</th>
              <th style={{ ...thSty, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-14 text-center" style={{ color: "var(--text-tertiary)", fontSize: 13, background: "var(--bg-surface)" }}>
                  {leads.length === 0 ? "No leads yet — import a CSV or add one manually." : "No leads match your filters."}
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => {
              const isNew = lead.id === newLeadId;
              const isBookmarked = lead.id === bookmarkId;
              const isSaving = saving.has(lead.id);
              const days = daysSinceLastTouch(lead);
              const stage = leadStage(lead);
              const nicheStyle = lead.niche && NICHE_COLORS[lead.niche] ? NICHE_COLORS[lead.niche] : null;
              const outreachedChannels = [lead.outreachedIg && "IG", lead.outreachedEmail && "Email", lead.outreachedLinkedin && "LI", lead.outreachedX && "X"].filter(Boolean);

              return (
                <tr
                  key={lead.id}
                  onClick={() => setOpenLeadId(lead.id)}
                  className="cursor-pointer group"
                  style={{
                    background: isBookmarked ? "rgba(251,191,36,0.07)" : isNew ? "rgba(61,214,140,0.05)" : i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-base)",
                    opacity: isSaving ? 0.75 : lead.leadLost ? 0.45 : lead.markedDone ? 0.65 : 1,
                    boxShadow: isBookmarked ? "inset 4px 0 0 rgb(251,191,36)" : lead.markedDone ? "inset 4px 0 0 rgb(61,255,162)" : lead.leadLost ? "inset 3px 0 0 rgba(160,80,80,0.4)" : undefined,
                    transition: "background 0.15s",
                  }}
                >
                  {/* # + bookmark */}
                  <td style={{ ...tdSty, textAlign: "center", width: 44, padding: "10px 6px" }}>
                    <div className="flex flex-col items-center gap-1">
                      <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{importOrder.get(lead.id) ?? "—"}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(lead.id); }}
                        className="transition-opacity"
                        style={{ opacity: isBookmarked ? 1 : 0, color: "rgb(251,191,36)" }}
                        title={isBookmarked ? "Clear bookmark" : "Bookmark"}
                      >
                        <Bookmark size={12} fill="rgb(251,191,36)" />
                      </button>
                    </div>
                  </td>

                  {/* Lead name + niche */}
                  <td style={tdSty}>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{lead.leadName}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {nicheStyle && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ color: nicheStyle.color, background: nicheStyle.bg }}>
                            {NICHE_OPTIONS.find((o) => o.value === lead.niche)?.label ?? lead.niche}
                          </span>
                        )}
                        {lead.leadSource && lead.leadSource !== "cold_outbound" && (
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{SOURCE_OPTIONS.find((o) => o.value === lead.leadSource)?.label ?? lead.leadSource}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Company description */}
                  <td style={{ ...tdSty, maxWidth: 220 }}>
                    {lead.companyDescription
                      ? <span className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lead.companyDescription}</span>
                      : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>
                    }
                  </td>

                  {/* Contact icons */}
                  <td style={tdSty}>
                    <div className="flex items-center gap-1.5">
                      {lead.instagram && <span style={{ color: "#E1306C", opacity: 0.9 }} title={lead.instagram}><IgIcon size={13} /></span>}
                      {lead.email && <span style={{ color: "#4F8EF7", opacity: 0.9 }} title={lead.email}><GmailIcon size={13} /></span>}
                      {lead.linkedin && <span style={{ color: "#0A66C2", opacity: 0.9 }} title={lead.linkedin}><LinkedInIcon size={13} /></span>}
                      {lead.x && <span style={{ color: "var(--text-secondary)", opacity: 0.9 }} title={lead.x}><XIcon size={13} /></span>}
                      {!lead.instagram && !lead.email && !lead.linkedin && !lead.x && <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</span>}
                    </div>
                  </td>

                  {/* Days since */}
                  <td style={tdSty}><StaleBadge days={days} /></td>

                  {/* Outreach channels */}
                  <td style={tdSty}>
                    {outreachedChannels.length > 0
                      ? <div className="flex gap-1 flex-wrap">{outreachedChannels.map((ch) => <span key={ch as string} className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(61,214,140,0.1)", color: "rgb(61,214,140)", border: "1px solid rgba(61,214,140,0.25)" }}>{ch}</span>)}</div>
                      : <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>None yet</span>
                    }
                  </td>

                  {/* Stage badge */}
                  <td style={tdSty}>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: stage.color, background: stage.bg, border: `1px solid ${stage.border}`, letterSpacing: "0.03em" }}>
                      {stage.label}
                    </span>
                  </td>

                  {/* Open arrow */}
                  <td style={{ ...tdSty, width: 44, textAlign: "center" }}>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-tertiary)" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-end gap-3 mt-3">
          {(search || filterStage !== "all" || sortKey !== "createdAt" || sortDir !== "asc") && (
            <button onClick={() => { setSearch(""); setFilterStage("all"); setSortKey("createdAt"); setSortDir("asc"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
              <X size={11} /> Clear filters
            </button>
          )}
          <p className="label-mono">{filtered.length} of {leads.length} shown</p>
        </div>
      )}

      {/* Lead Drawer */}
      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenLeadId(null)}
          patch={patch}
          onDelete={deleteLead}
          importNum={importOrder.get(openLead.id) ?? 0}
        />
      )}

      {/* Add Modal */}
      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} onSubmit={submitNewLead} />}

      {/* CSV Confirm */}
      {csvConfirm && <CsvConfirmModal toAdd={csvConfirm.toAdd} duplicates={csvConfirm.duplicates} onConfirm={confirmCsvImport} onCancel={() => setCsvConfirm(null)} importing={importing} />}

      {/* Delete All */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => !deletingAll && setShowDeleteAll(false)}>
          <div className="rounded-xl p-6 w-full max-w-sm flex flex-col gap-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "rgba(255,59,59,0.12)" }}>
                <Trash2 size={16} style={{ color: "rgb(255,80,80)" }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Delete all leads?</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>This will permanently remove all {leads.length} lead{leads.length !== 1 ? "s" : ""}.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteAll(false)} disabled={deletingAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={deleteAllLeads} disabled={deletingAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.4)", color: "rgb(255,80,80)" }}>
                {deletingAll ? "Deleting…" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
