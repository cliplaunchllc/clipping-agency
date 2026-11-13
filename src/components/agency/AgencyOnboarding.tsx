"use client";

import { useState } from "react";

export default function AgencyOnboarding() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/onboard`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ padding: "32px 32px", maxWidth: 860, margin: "0 auto" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Client Onboarding
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Share this link with new clients to walk them through the onboarding process.
        </p>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 20px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
            Onboarding Page
          </p>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
            {typeof window !== "undefined" ? `${window.location.origin}/onboard` : "/onboard"}
          </p>
        </div>

        <button
          onClick={copyLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            borderRadius: 999,
            border: copied ? "1px solid var(--accent-border)" : "1px solid var(--border-default)",
            background: copied ? "var(--accent-muted)" : "var(--bg-active)",
            color: copied ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? (
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
              Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
