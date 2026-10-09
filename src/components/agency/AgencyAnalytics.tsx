"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Eye, Heart, Share2, MessageCircle } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
};

export default function AgencyAnalytics({ submissions }: { submissions: AnyRecord[] }) {
  const [metric, setMetric] = useState<"views" | "likes" | "comments" | "shares">("views");

  const totalViews = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.views ?? 0), 0);
  const totalLikes = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.likes ?? 0), 0);
  const totalComments = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.comments ?? 0), 0);
  const totalShares = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.shares ?? 0), 0);

  // Group by date
  const byDate: Record<string, { views: number; likes: number; comments: number; shares: number }> = {};
  submissions.forEach((s) => {
    const date = s.submittedAt.slice(0, 10);
    if (!byDate[date]) byDate[date] = { views: 0, likes: 0, comments: 0, shares: 0 };
    byDate[date].views += s.snapshots[0]?.views ?? 0;
    byDate[date].likes += s.snapshots[0]?.likes ?? 0;
    byDate[date].comments += s.snapshots[0]?.comments ?? 0;
    byDate[date].shares += s.snapshots[0]?.shares ?? 0;
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }));

  // By platform
  const byPlatform: Record<string, number> = {};
  submissions.forEach((s) => {
    byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + (s.snapshots[0]?.views ?? 0);
  });
  const platformData = Object.entries(byPlatform).map(([platform, views]) => ({ platform, views }));

  // By client
  const byClient: Record<string, number> = {};
  submissions.forEach((s) => {
    const name = s.subAccount?.client?.name ?? "Unknown";
    byClient[name] = (byClient[name] ?? 0) + (s.snapshots[0]?.views ?? 0);
  });
  const clientData = Object.entries(byClient).sort(([, a], [, b]) => b - a).slice(0, 8).map(([client, views]) => ({ client, views }));

  // svgColor is used for SVG presentation attributes (stroke/fill); cssColor for HTML style props
  const metrics = [
    { key: "views",    label: "Total Views", value: totalViews,    icon: Eye,           svgColor: "#DC2626", cssColor: "var(--accent-solid)" },
    { key: "likes",    label: "Total Likes", value: totalLikes,    icon: Heart,         svgColor: "#3DD68C", cssColor: "var(--success)" },
    { key: "comments", label: "Comments",    value: totalComments, icon: MessageCircle, svgColor: "#DC2626", cssColor: "var(--accent-solid)" },
    { key: "shares",   label: "Shares",      value: totalShares,   icon: Share2,        svgColor: "#F5B94A", cssColor: "var(--warning)" },
  ];

  const active = metrics.find((m) => m.key === metric)!;

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Analytics</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>Performance across all clients and clippers</p>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => {
          const Icon = m.icon;
          const isActive = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key as typeof metric)}
              className="rounded-xl p-5 text-left transition-colors"
              style={{
                background: "var(--bg-surface)",
                border: isActive ? `1px solid var(--accent-border)` : "1px solid var(--border-default)",
                boxShadow: "var(--shadow-inset-top)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="label-mono">{m.label}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
                  <Icon size={14} style={{ color: m.cssColor }} />
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(m.value)}</div>
            </button>
          );
        })}
      </div>

      {/* Time series chart */}
      <div className="rounded-xl p-6 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          {active.label} Over Time
        </h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={active.svgColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={active.svgColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
              <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={50} />
              <Tooltip
                formatter={(v) => fmt(Number(v ?? 0))}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#8A93A6" }}
                itemStyle={{ color: active.svgColor }}
              />
              <Area type="monotone" dataKey={metric} stroke={active.svgColor} strokeWidth={2} fill="url(#analyticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm py-12 text-center" style={{ color: "var(--text-tertiary)" }}>No data yet</p>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-6">
        {/* By platform */}
        <div className="rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Views by Platform</h2>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="platform" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={45} />
                <Tooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={tooltipStyle} labelStyle={{ color: "#8A93A6" }} itemStyle={{ color: "#DC2626" }} />
                <Bar dataKey="views" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-tertiary)" }}>No data yet</p>
          )}
        </div>

        {/* By client */}
        <div className="rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Views by Client</h2>
          <div className="space-y-3">
            {clientData.map((c, i) => {
              const pct = clientData[0]?.views ? Math.round((c.views / clientData[0].views) * 100) : 0;
              return (
                <div key={c.client}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "var(--text-primary)" }}>{i + 1}. {c.client}</span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--success)" }}>{fmt(c.views)}</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: "var(--border-subtle)" }}>
                    <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: "var(--accent-solid)" }} />
                  </div>
                </div>
              );
            })}
            {clientData.length === 0 && <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
