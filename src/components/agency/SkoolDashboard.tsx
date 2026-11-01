"use client";

import { useState, useCallback } from "react";
import { Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import FreebiesDashboard, { FreebieItem } from "./FreebiesDashboard";

interface Props {
  initialFreebies: FreebieItem[];
  initialCommunityName: string;
  initialPortalToken: string;
  baseUrl: string;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-base)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "6px 10px",
  outline: "none",
};

const btnStyle = (color = "var(--accent)"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 10px", borderRadius: "var(--radius-md)", fontSize: 12, fontWeight: 500,
  background: `color-mix(in srgb, ${color} 12%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  color, cursor: "pointer",
});

export default function SkoolDashboard({ initialFreebies, initialCommunityName, initialPortalToken, baseUrl }: Props) {
  const [communityName, setCommunityName] = useState(initialCommunityName);
  const [savedName, setSavedName] = useState(initialCommunityName);
  const [portalToken, setPortalToken] = useState(initialPortalToken);
  const [regenerating, setRegenerating] = useState(false);

  const [copied, setCopied] = useState(false);
  const portalUrl = `${baseUrl}/skool/${portalToken}`;

  const copyPortalUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [portalUrl]);

  async function saveCommunityName() {
    if (communityName.trim() === savedName) return;
    await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityName: communityName.trim() }),
    });
    setSavedName(communityName.trim());
  }

  async function regenerateToken() {
    if (!confirm("Regenerate the portal link? The old link will stop working immediately.")) return;
    setRegenerating(true);
    const res = await fetch("/api/agency/skool-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateToken: true }),
    });
    const data = await res.json();
    setPortalToken(data.portalToken);
    setRegenerating(false);
  }

  return (
    <div>
      {/* Portal settings banner */}
      <div className="px-8 pt-8 max-w-4xl mx-auto">
        <div className="rounded-xl p-4 mb-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>PORTAL SETTINGS</p>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Community name */}
            <div className="flex-1 min-w-48">
              <label className="text-xs mb-1 block" style={{ color: "var(--text-tertiary)" }}>Community name (shown to members)</label>
              <input
                style={{ ...inputStyle, width: "100%" }}
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                onBlur={saveCommunityName}
                placeholder="Member Resources"
              />
            </div>
            {/* Portal link */}
            <div className="flex-[2] min-w-64">
              <label className="text-xs mb-1 block" style={{ color: "var(--text-tertiary)" }}>Member portal link</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-1.5 rounded-md text-xs font-mono truncate"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}>
                  {portalUrl}
                </div>
                <button onClick={copyPortalUrl} style={btnStyle()}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={btnStyle("var(--text-secondary)")}>
                  <ExternalLink size={12} />
                </a>
                <button onClick={regenerateToken} disabled={regenerating} style={btnStyle("var(--warning)")}>
                  <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
                  {regenerating ? "…" : "Regenerate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reuse FreebiesDashboard for the items */}
      <FreebiesDashboard initialFreebies={initialFreebies} type="skool" baseUrl={baseUrl} />
    </div>
  );
}
