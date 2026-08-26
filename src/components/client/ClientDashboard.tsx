"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { Eye, Heart, Share2, Bookmark, ExternalLink } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface Clip {
  id: string;
  url: string;
  platform: string;
  handle: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  earnings: number;
  submittedAt: string;
  clipperName: string | null;
}

interface Clipper {
  id: string;
  name: string | null;
  clipCount: number;
  totalViews: number;
}

interface ClientData {
  id: string;
  name: string;
  status: string;
  clips: Clip[];
  clippers: Clipper[];
}

interface Props {
  client: ClientData;
  userName: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FF2D55",
  instagram: "#C13584",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  other: "#8A93A6",
};

export default function ClientDashboard({ client, userName }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "clips">("overview");

  const totalViews = client.clips.reduce((a, c) => a + c.views, 0);
  const totalLikes = client.clips.reduce((a, c) => a + c.likes, 0);
  const totalShares = client.clips.reduce((a, c) => a + c.shares, 0);
  const totalSaves = client.clips.reduce((a, c) => a + c.saves, 0);

  // Group clips by date for chart
  const byDate: Record<string, number> = {};
  client.clips.forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + c.views;
  });
  const chartData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }));

  const topClips = [...client.clips]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const kpis = [
    { label: "Total Views", value: totalViews, icon: Eye, color: "#FF3B3B" },
    { label: "Total Likes", value: totalLikes, icon: Heart, color: "#3DFFA2" },
    { label: "Total Shares", value: totalShares, icon: Share2, color: "#a78bfa" },
    { label: "Total Saves", value: totalSaves, icon: Bookmark, color: "#FFA500" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="client" userName={userName} />

      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
              {client.name}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
              {client.clips.length} clips · {client.clippers.length} clippers
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["overview", "clips"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-xs font-medium rounded-lg capitalize transition-all"
                style={{
                  background: activeTab === tab ? "rgba(255,59,59,0.15)" : "transparent",
                  color: activeTab === tab ? "#FF3B3B" : "#8A93A6",
                }}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {kpis.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-2xl p-5"
                    style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{label}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon size={14} color={color} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                      {fmt(value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                  Views Over Time
                </h2>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <defs>
                        <linearGradient id="clientViewGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                      <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => fmt(v)} width={50} />
                      <Tooltip formatter={(v) => fmt(Number(v ?? 0))}
                        contentStyle={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
                        labelStyle={{ color: "#8A93A6" }} itemStyle={{ color: "#3DFFA2" }} />
                      <Area type="monotone" dataKey="views" stroke="#FF3B3B" strokeWidth={2}
                        fill="url(#clientViewGrad)" dot={false}
                        activeDot={{ r: 4, fill: "#FF3B3B", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm py-12 text-center" style={{ color: "#8A93A6" }}>No clips yet</p>
                )}
              </div>

              {/* Clippers + Top Clips */}
              <div className="grid grid-cols-2 gap-6">
                {/* Clippers */}
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>My Clippers</h2>
                  <div className="space-y-3">
                    {client.clippers.map((cl) => (
                      <div key={cl.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>
                          {(cl.name ?? "C")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{cl.name ?? "Unnamed"}</p>
                          <p className="text-xs" style={{ color: "#8A93A6" }}>{cl.clipCount} clips</p>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                          {fmt(cl.totalViews)}
                        </span>
                      </div>
                    ))}
                    {client.clippers.length === 0 && (
                      <p className="text-sm" style={{ color: "#8A93A6" }}>No clippers assigned</p>
                    )}
                  </div>
                </div>

                {/* Top Clips */}
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clips</h2>
                  <div className="space-y-3">
                    {topClips.slice(0, 5).map((clip, i) => (
                      <div key={clip.id} className="flex items-center gap-3">
                        <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                        <span className="text-xs font-semibold capitalize flex-shrink-0"
                          style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                          {clip.platform}
                        </span>
                        <span className="text-xs flex-1 truncate" style={{ color: "#8A93A6" }}>@{clip.handle}</span>
                        <span className="text-sm font-bold flex-shrink-0"
                          style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>
                          {fmt(clip.views)}
                        </span>
                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <ExternalLink size={12} color="#FF3B3B" />
                        </a>
                      </div>
                    ))}
                    {topClips.length === 0 && (
                      <p className="text-sm" style={{ color: "#8A93A6" }}>No clips yet</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "clips" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Platform", "Account", "Clipper", "Views", "Likes", "Shares", "Date", "Link"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {client.clips.map((clip, i) => (
                    <tr key={clip.id} style={{ borderBottom: i < client.clips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold capitalize"
                          style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                          {clip.platform}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>@{clip.handle}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{clip.clipperName ?? "—"}</td>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(clip.views)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.likes)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.shares)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>
                        {new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        <a href={clip.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} color="#FF3B3B" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {client.clips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>
                        No clips yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
