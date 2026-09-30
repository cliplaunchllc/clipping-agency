"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

export default function ClipperAnalytics({ submissions }: { submissions: AnyRecord[] }) {
  const totalViews    = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.views    ?? 0), 0);
  const totalLikes    = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.likes    ?? 0), 0);
  const totalComments = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.comments ?? 0), 0);
  const totalShares   = submissions.reduce((acc, s) => acc + (s.snapshots[0]?.shares   ?? 0), 0);

  const byDate: Record<string, { views: number; likes: number }> = {};
  submissions.forEach((s) => {
    const date = s.submittedAt.slice(0, 10);
    if (!byDate[date]) byDate[date] = { views: 0, likes: 0 };
    byDate[date].views += s.snapshots[0]?.views ?? 0;
    byDate[date].likes += s.snapshots[0]?.likes ?? 0;
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }));

  const topClips = [...submissions].sort((a, b) => (b.snapshots[0]?.views ?? 0) - (a.snapshots[0]?.views ?? 0)).slice(0, 5);

  const stats = [
    { label: "Total Views", value: totalViews,    icon: Eye,           cssColor: "var(--success)" },
    { label: "Total Likes", value: totalLikes,    icon: Heart,         cssColor: "var(--accent-solid)" },
    { label: "Comments",    value: totalComments, icon: MessageCircle, cssColor: "var(--text-secondary)" },
    { label: "Shares",      value: totalShares,   icon: Share2,        cssColor: "var(--warning)" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Analytics</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-tertiary)" }}>Your personal performance stats</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{s.label}</span>
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--accent-muted)" }}>
                  <Icon size={14} style={{ color: s.cssColor }} />
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{fmt(s.value)}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl p-6 mb-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Views Over Time</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="clipperGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3DD68C" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3DD68C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
              <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={50} />
              <Tooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={tooltipStyle} labelStyle={{ color: "#8A93A6" }} itemStyle={{ color: "#3DD68C" }} />
              <Area type="monotone" dataKey="views" stroke="#3DD68C" strokeWidth={2} fill="url(#clipperGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm py-12 text-center" style={{ color: "var(--text-tertiary)" }}>No data yet — submit clips to see analytics</p>
        )}
      </div>

      <div className="rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Top Performing Clips</h2>
        <div className="space-y-0">
          {topClips.map((s, i) => (
            <div key={s.id} className="flex items-center gap-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs w-4 text-right flex-shrink-0 tabular-nums" style={{ color: "var(--text-tertiary)" }}>{i + 1}</span>
              <span className="text-xs font-medium capitalize flex-shrink-0" style={{ color: "var(--accent-solid)" }}>{s.platform}</span>
              <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{s.subAccount?.client?.name}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--success)", fontFamily: "var(--font-mono)" }}>{fmt(s.snapshots[0]?.views ?? 0)}</span>
              <a href={s.clipUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          ))}
          {topClips.length === 0 && <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No clips yet</p>}
        </div>
      </div>
    </div>
  );
}
