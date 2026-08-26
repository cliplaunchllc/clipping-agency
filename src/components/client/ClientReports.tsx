"use client";

import { ExternalLink } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const PLATFORM_COLORS: Record<string, string> = { tiktok: "#FF2D55", instagram: "#DD2A7B", youtube: "#FF0000" };

export default function ClientReports({ submissions, clientName }: { submissions: AnyRecord[]; clientName: string }) {
  const totalViews = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.views ?? 0), 0);
  const totalLikes = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.likes ?? 0), 0);
  const totalShares = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.shares ?? 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes + totalShares) / totalViews * 100).toFixed(2) : "0.00";

  const sorted = [...submissions].sort((a, b) => (b.snapshots[0]?.views ?? 0) - (a.snapshots[0]?.views ?? 0));

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Reports</h1>
      <p className="text-sm mb-8" style={{ color: "#8A93A6" }}>{clientName} — full campaign report</p>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Clips", value: submissions.length.toString() },
          { label: "Total Views", value: fmt(totalViews) },
          { label: "Total Likes", value: fmt(totalLikes) },
          { label: "Engagement Rate", value: `${engagementRate}%` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "#8A93A6" }}>{item.label}</p>
            <p className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* All clips table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>All Clips</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Platform", "Handle", "Clipper", "Views", "Likes", "Comments", "Shares", "Date", "Link"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td className="px-5 py-3">
                  <span className="text-xs font-semibold capitalize" style={{ color: PLATFORM_COLORS[s.platform] ?? "#8A93A6" }}>{s.platform}</span>
                </td>
                <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>@{s.subAccount?.handle ?? "—"}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{s.clipper?.displayName || s.clipper?.user?.name || "—"}</td>
                <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#a78bfa" }}>{fmt(s.snapshots[0]?.views ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.likes ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.comments ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.shares ?? 0)}</td>
                <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>
                  {new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="px-5 py-3">
                  <a href={s.clipUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} color="#a78bfa" />
                  </a>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No clips yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
