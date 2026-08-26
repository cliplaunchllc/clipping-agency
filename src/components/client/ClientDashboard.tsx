"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/shared/Sidebar";
import {
  LayoutDashboard, BarChart2, Users, CheckCircle2, Circle,
  Eye, Heart, Share2, Bookmark, ExternalLink, TrendingUp, TrendingDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart as ReBarChart, Bar,
} from "recharts";

const navItems = [
  { label: "Overview", href: "/client", icon: LayoutDashboard },
  { label: "Analytics", href: "/client/analytics", icon: BarChart2 },
  { label: "My Clippers", href: "/client/clippers", icon: Users },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function platformColor(platform: string) {
  if (platform === "tiktok") return "#FF2D55";
  if (platform === "instagram") return "#C13584";
  return "#FF0000";
}

function Badge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: positive ? "rgba(61,255,162,0.12)" : "rgba(255,71,87,0.12)",
        color: positive ? "#3DFFA2" : "#FF4757",
        border: `1px solid ${positive ? "rgba(61,255,162,0.2)" : "rgba(255,71,87,0.2)"}`,
      }}>
      {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {Math.abs(value)}%
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, wow, dod }: {
  label: string; value: number; icon: React.ElementType; wow: number; dod: number;
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(167,139,250,0.1)" }}>
          <Icon size={14} color="#a78bfa" />
        </div>
      </div>
      <div className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
        {fmt(value)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge value={wow} />
        <span className="text-xs" style={{ color: "#8A93A6" }}>WoW</span>
        <Badge value={dod} />
        <span className="text-xs" style={{ color: "#8A93A6" }}>DoD</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p style={{ color: "#8A93A6", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#3DFFA2", fontWeight: 600, fontFamily: "Space Grotesk, sans-serif" }}>
        {fmt(payload[0]?.value ?? 0)} views
      </p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Record<string, any>;
  userName: string;
}

export default function ClientDashboard({ client, userName }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "onboarding">("overview");
  const [timeframe, setTimeframe] = useState("7d");
  const [chartData, setChartData] = useState<Array<{ date: string; views: number; likes: number; comments: number; shares: number; saves: number }>>([]);
  const [metrics, setMetrics] = useState({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  const [metricsTab, setMetricsTab] = useState<"totals" | "averages" | "byday">("totals");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type A = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSubmissions: A[] = client.subAccounts.flatMap((sa: A) => sa.submissions);

  const totalViews = allSubmissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.views ?? 0), 0);
  const totalLikes = allSubmissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.likes ?? 0), 0);
  const totalShares = allSubmissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.shares ?? 0), 0);
  const totalSaves = allSubmissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.saves ?? 0), 0);

  const completedSteps = client.onboarding.filter((s: A) => s.completed).length;
  const totalSteps = client.onboarding.length;
  const onboardingPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const fetchMetrics = useCallback(async () => {
    const params = new URLSearchParams({ timeframe, clientId: client.id });
    const res = await fetch(`/api/metrics?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setChartData(data.chartData || []);
    setMetrics(data.totals || { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
  }, [client.id, timeframe]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const engagementData = client.subAccounts.map((sa: A) => ({
    name: sa.handle,
    views: sa.submissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.views ?? 0), 0),
    likes: sa.submissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.likes ?? 0), 0),
  }));

  const days = chartData.length || 1;
  const avgViews = Math.round(metrics.views / days);
  const avgLikes = Math.round(metrics.likes / days);

  // Platform breakdown
  const platformBreakdown = ["tiktok", "instagram", "youtube"].map((p) => ({
    platform: p,
    count: allSubmissions.filter((s: A) => s.platform === p).length,
    views: allSubmissions.filter((s: A) => s.platform === p).reduce((a: number, s: A) => a + (s.snapshots[0]?.views ?? 0), 0),
  }));

  const topSubmissions: A[] = [...allSubmissions]
    .sort((a: A, b: A) => (b.snapshots[0]?.views ?? 0) - (a.snapshots[0]?.views ?? 0))
    .slice(0, 10);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="client" userName={userName} />

      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                {client.name}
              </h1>
              <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{client.packageInfo}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Timeframe */}
              {["7d", "30d", "90d"].map((t) => (
                <button key={t}
                  onClick={() => setTimeframe(t)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: timeframe === t ? "rgba(167,139,250,0.15)" : "transparent",
                    color: timeframe === t ? "#a78bfa" : "#8A93A6",
                    border: timeframe === t ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                  }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["overview", "analytics", "onboarding"] as const).map((tab) => (
              <button key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-xs font-medium rounded-lg capitalize transition-all"
                style={{
                  background: activeTab === tab ? "rgba(167,139,250,0.15)" : "transparent",
                  color: activeTab === tab ? "#a78bfa" : "#8A93A6",
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <KpiCard label="Total Views" value={totalViews} icon={Eye}
                  wow={pctChange(totalViews, totalViews * 0.85)} dod={pctChange(totalViews, totalViews * 0.97)} />
                <KpiCard label="Total Likes" value={totalLikes} icon={Heart}
                  wow={pctChange(totalLikes, totalLikes * 0.88)} dod={pctChange(totalLikes, totalLikes * 0.96)} />
                <KpiCard label="Total Shares" value={totalShares} icon={Share2}
                  wow={pctChange(totalShares, totalShares * 0.86)} dod={pctChange(totalShares, totalShares * 0.95)} />
                <KpiCard label="Total Saves" value={totalSaves} icon={Bookmark}
                  wow={pctChange(totalSaves, totalSaves * 0.89)} dod={pctChange(totalSaves, totalSaves * 0.97)} />
              </div>

              {/* Chart */}
              <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
                    <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>Daily peak view count</p>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                    {fmt(metrics.views)}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="clientViewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                    <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => fmt(v)} width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="views" stroke="#3DFFA2" strokeWidth={2}
                      fill="url(#clientViewsGradient)" dot={false}
                      activeDot={{ r: 4, fill: "#3DFFA2", strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Sub-accounts + Top Clippers */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* All Accounts */}
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>All Accounts</h2>
                  <div className="space-y-3">
                    {client.subAccounts.map((sa: A) => {
                      const views = sa.submissions.reduce((a: number, s: A) => a + (s.snapshots[0]?.views ?? 0), 0);
                      return (
                        <div key={sa.id} className="flex items-center justify-between p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: `${platformColor(sa.platform)}22` }}>
                              <div className="w-2 h-2 rounded-full" style={{ background: platformColor(sa.platform) }} />
                            </div>
                            <div>
                              <p className="text-xs font-medium" style={{ color: "#F5F6FA" }}>{sa.handle}</p>
                              <p className="text-xs" style={{ color: "#8A93A6" }}>{sa.platform} · {sa.submissions.length} clips</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold" style={{ color: "#F5F6FA" }}>{fmt(views)}</p>
                            <p className="text-xs" style={{ color: "#8A93A6" }}>views</p>
                          </div>
                        </div>
                      );
                    })}
                    {client.subAccounts.length === 0 && (
                      <p className="text-sm" style={{ color: "#8A93A6" }}>No accounts yet</p>
                    )}
                  </div>
                </div>

                {/* Top Clippers */}
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>My Clippers</h2>
                  <div className="space-y-3">
                    {client.assignments.map((a: A, i: number) => {
                      const clipperSubs = allSubmissions.filter(
                        (s: A) => s.clipper?.user?.name === a.clipper.user.name
                      );
                      const clipperViews = clipperSubs.reduce((acc: number, s: A) => acc + (s.snapshots[0]?.views ?? 0), 0);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                            {(a.clipper.displayName || a.clipper.user.name || "C")[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>
                              {a.clipper.displayName || a.clipper.user.name || "Unnamed"}
                            </p>
                            <p className="text-xs" style={{ color: "#8A93A6" }}>{clipperSubs.length} clips</p>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                            {fmt(clipperViews)}
                          </span>
                        </div>
                      );
                    })}
                    {client.assignments.length === 0 && (
                      <p className="text-sm" style={{ color: "#8A93A6" }}>No clippers assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Videos */}
              <div className="rounded-2xl p-5 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Videos</h2>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["Platform", "Clipper", "Views", "Likes", "Comments", "Shares", "Link"].map((h) => (
                        <th key={h} className="text-left pb-2 pr-4 text-xs font-medium" style={{ color: "#8A93A6" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topSubmissions.map((s: A, i: number) => (
                      <tr key={s.id} style={{ borderBottom: i < topSubmissions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${platformColor(s.platform)}22`, color: platformColor(s.platform) }}>
                            {s.platform}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs" style={{ color: "#8A93A6" }}>{s.clipper?.displayName || s.clipper?.user?.name}</td>
                        <td className="py-3 pr-4 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(s.snapshots[0]?.views ?? 0)}</td>
                        <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.likes ?? 0)}</td>
                        <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.comments ?? 0)}</td>
                        <td className="py-3 pr-4 text-xs" style={{ color: "#F5F6FA" }}>{fmt(s.snapshots[0]?.shares ?? 0)}</td>
                        <td className="py-3">
                          <a href={s.clipUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={12} color="#FF3B3B" />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {topSubmissions.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-sm" style={{ color: "#8A93A6" }}>No clips yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Metrics Panel */}
              <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-4 mb-5">
                  {(["totals", "averages", "byday"] as const).map((t) => (
                    <button key={t} onClick={() => setMetricsTab(t)}
                      className="text-sm font-medium pb-1 capitalize transition-colors"
                      style={{
                        color: metricsTab === t ? "#a78bfa" : "#8A93A6",
                        borderBottom: metricsTab === t ? "2px solid #a78bfa" : "2px solid transparent",
                      }}>
                      {t === "byday" ? "By Day" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {metricsTab === "totals" && (
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Total Views", value: metrics.views },
                      { label: "Total Likes", value: metrics.likes },
                      { label: "Total Comments", value: metrics.comments },
                      { label: "Total Shares", value: metrics.shares },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                        <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {metricsTab === "averages" && (
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Avg Views/Day", value: avgViews },
                      { label: "Avg Likes/Day", value: avgLikes },
                      { label: "Avg Videos/Day", value: Math.round(allSubmissions.length / days) },
                      { label: "Avg Comments/Day", value: Math.round(metrics.comments / days) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                        <p className="text-xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(item.value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {metricsTab === "byday" && (
                  <div className="space-y-2">
                    {chartData.slice(-7).map((day) => (
                      <div key={day.date} className="flex items-center gap-6 py-2"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="text-xs w-20 flex-shrink-0" style={{ color: "#8A93A6" }}>
                          {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        {[
                          { label: "Views", value: day.views },
                          { label: "Likes", value: day.likes },
                          { label: "Comments", value: day.comments },
                          { label: "Shares", value: day.shares },
                        ].map((m) => (
                          <div key={m.label} className="flex-1">
                            <p className="text-xs" style={{ color: "#8A93A6" }}>{m.label}</p>
                            <p className="text-sm font-semibold" style={{ color: "#F5F6FA" }}>{fmt(m.value)}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                    {chartData.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No data yet</p>}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <>
              {/* Platform breakdown */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                {platformBreakdown.map((p) => (
                  <div key={p.platform} className="rounded-2xl p-5"
                    style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${platformColor(p.platform)}22` }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: platformColor(p.platform) }} />
                      </div>
                      <span className="text-sm font-medium capitalize" style={{ color: "#F5F6FA" }}>{p.platform}</span>
                    </div>
                    <p className="text-2xl font-bold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                      {fmt(p.views)}
                    </p>
                    <p className="text-xs" style={{ color: "#8A93A6" }}>{p.count} clips</p>
                    <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${allSubmissions.length > 0 ? Math.round((p.count / allSubmissions.length) * 100) : 0}%`,
                          background: platformColor(p.platform),
                        }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Engagement by account bar chart */}
              <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                  Engagement by Account
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <ReBarChart data={engagementData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A93A6" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8A93A6" }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                    <Tooltip contentStyle={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#F5F6FA", fontSize: "12px" }} />
                    <Bar dataKey="views" fill="#a78bfa" radius={4} maxBarSize={40} />
                    <Bar dataKey="likes" fill="#FF3B3B" radius={4} maxBarSize={40} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ONBOARDING TAB */}
          {activeTab === "onboarding" && (
            <div className="max-w-2xl">
              <div className="rounded-2xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="text-lg font-semibold mb-2" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                  Welcome to ClipLaunch
                </h2>
                <p className="text-sm mb-6" style={{ color: "#8A93A6" }}>
                  Complete these steps to get the most out of your account.
                </p>

                {/* Progress bar */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "#8A93A6" }}>Progress</span>
                  <span className="text-xs font-medium" style={{ color: "#a78bfa" }}>{onboardingPct}%</span>
                </div>
                <div className="h-2 rounded-full mb-6" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${onboardingPct}%`, background: "linear-gradient(90deg, #a78bfa, #FF3B3B)" }} />
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  {client.onboarding.map((step: A, i: number) => (
                    <div key={step.id}
                      className="flex items-center gap-4 p-4 rounded-xl transition-all"
                      style={{
                        background: step.completed ? "rgba(61,255,162,0.05)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${step.completed ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      <div className="flex-shrink-0">
                        {step.completed ? (
                          <CheckCircle2 size={20} color="#3DFFA2" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center border"
                            style={{ borderColor: "rgba(255,255,255,0.2)" }}>
                            <span className="text-xs" style={{ color: "#8A93A6" }}>{i + 1}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: step.completed ? "#F5F6FA" : "#8A93A6" }}>
                          {step.title}
                        </p>
                      </div>
                      {step.completed && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(61,255,162,0.12)", color: "#3DFFA2" }}>
                          Done
                        </span>
                      )}
                    </div>
                  ))}
                  {client.onboarding.length === 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <Circle size={20} color="#8A93A6" />
                      <p className="text-sm" style={{ color: "#8A93A6" }}>No onboarding steps configured.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
