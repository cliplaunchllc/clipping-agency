"use client";

import { useState } from "react";

interface Client {
  id: string;
  name: string;
  logoUrl: string | null;
  shareToken: string | null;
  status: string;
}

interface Props {
  clients: Client[];
}

export default function AgencyOnboarding({ clients }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function copyLink(client: Client) {
    setLoadingId(client.id);
    try {
      let token = client.shareToken;
      if (!token) {
        const res = await fetch(`/api/agency/clients/${client.id}/share-token`, { method: "POST" });
        const data = await res.json();
        if (res.ok && data.token) token = data.token;
        else { setLoadingId(null); return; }
      }
      await navigator.clipboard.writeText(`${window.location.origin}/onboard/${token}`);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId(null), 2500);
    } finally {
      setLoadingId(null);
    }
  }

  const active = clients.filter((c) => c.status !== "archived");
  const archived = clients.filter((c) => c.status === "archived");

  return (
    <div style={{ padding: "32px 32px", maxWidth: 860, margin: "0 auto" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Client Onboarding
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Share the onboarding link with each client so they can complete the setup steps.
        </p>
      </div>

      {active.length === 0 && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>No clients yet.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((client) => (
          <ClientRow
            key={client.id}
            client={client}
            isCopied={copiedId === client.id}
            isLoading={loadingId === client.id}
            onCopy={() => copyLink(client)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase mt-8 mb-3" style={{ color: "var(--text-tertiary)", letterSpacing: "0.08em" }}>
            Archived
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.5 }}>
            {archived.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                isCopied={copiedId === client.id}
                isLoading={loadingId === client.id}
                onCopy={() => copyLink(client)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClientRow({
  client,
  isCopied,
  isLoading,
  onCopy,
}: {
  client: Client;
  isCopied: boolean;
  isLoading: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {client.logoUrl ? (
          <img
            src={client.logoUrl}
            alt={client.name}
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--bg-active)",
            border: "1px solid var(--border-default)",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {client.name}
        </span>
      </div>

      <button
        onClick={onCopy}
        disabled={isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 14px",
          borderRadius: 999,
          border: isCopied ? "1px solid var(--accent-border)" : "1px solid var(--border-default)",
          background: isCopied ? "var(--accent-muted)" : "var(--bg-active)",
          color: isCopied ? "var(--accent)" : "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: isLoading ? "wait" : "pointer",
          transition: "all 150ms ease",
          whiteSpace: "nowrap",
        }}
      >
        {isCopied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Copy Onboarding Link
          </>
        )}
      </button>
    </div>
  );
}
