"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import ClientManagement from "@/components/agency/ClientManagement";
import ClipperManagement from "@/components/agency/ClipperManagement";
import { Eye, Heart, Share2, Users, Scissors, BarChart2, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface Props {
  userName: string;
  clients: AnyRecord[];       // Full ClientManagement shape
  clippers: AnyRecord[];      // Full ClipperManagement shape
  allClients: AnyRecord[];    // Simplified list for clipper assign dropdown
  clips: AnyRecord[];
  totalViews: number;
}

export default function AgencyDashboard({ userName, clients, clippers, allClients, clips, totalViews }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "clippers">("overview");

  const totalLikes = clips.reduce((acc, c) => acc + (c.likes ?? 0), 0);
  const totalShares = clips.reduce((acc, c) => acc + (c.shares ?? 0), 0);
  const activeClients = clients.filter((c) => c.status === "active").length;
  const pendingClippers = clippers.filter((c) => c.status === "pending").length;

  // Chart: group clips by date
  const byDate: Record<string, number> = {};
  clips.forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + (c.views ?? 0);
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));

  // Top clippers by views
  const clipperViews: Record<string, { name: string; views: number; clips: number }> = {};
  clips.forEach((c) => {
    const name = c.clipper?.name ?? "Unknown";
    if (!clipperViews[name]) clipperViews[name] = { name, views: 0, clips: 0 };
    clipperViews[name].views += c.views ?? 0;
    clipperViews[name].clips += 1;
  });
  const topClippers = Object.values(clipperViews).sort((a, b) => b.views - a.views).slice(0, 5);

  const kpis = [
    { label: "Total Views", value: fmt(totalViews), icon: Eye, color: "#FF3B3B" },
    { label: "Total Likes", value: fmt(totalLikes), icon: Heart, color: "#3DFFA2" },
    { label: "Total Shares", value: fmt(totalShares), icon: Share2, color: "#a78bfa" },
    { label: "Active Clients", value: activeClients.toString(), icon: Users, color: "#FFA500" },
    { label: "Total Clips", value: clips.length.toString(), icon: BarChart2, color: "#FF3B3B" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={userName} />
      <main className="flex-1 overflow-y-auto ml-60">
        {/* Tab bar */}
        <div className="sticky top-0 z-30 px-8 pt-6 pb-0" style={{ background: "#05070D" }}>
          <div className="flex items-center gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { id: "overview", label: "Overview" },
              { id: "clients", label: `Clients (${clients.length})` },
              { id: "clippers", label: `Clippers${pendingClippers > 0 ? ` · ${pendingClippers} pending` : ""}` },
            ] as const).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-all relative"
                style={{ color: activeTab === tab.id ? "#F5F6FA" : "#8A93A6" }}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* Overview */}
          {activeTab === "overview" && <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Overview</h1>
                <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>All clients & clippers</p>
              </div>
              {pendingClippers > 0 && (
                <button onClick={() => setActiveTab("clippers")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.25)", color: "#FFA500" }}>
                  <Scissors size={13} />
                  {pendingClippers} clipper{pendingClippers > 1 ? "s" : ""} awaiting assignment
                </button>
              )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{k.label}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18` }}>
                        <Icon size={14} color={k.color} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{k.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6 mb-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                    <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(Number(v))} width={50} />
                    <Tooltip formatter={(v) => fmt(Number(v ?? 0))} contentStyle={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }} labelStyle={{ color: "#8A93A6" }} itemStyle={{ color: "#3DFFA2" }} />
                    <Area type="monotone" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#agGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm py-12 text-center" style={{ color: "#8A93A6" }}>No clips yet</p>
              )}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-2 gap-6">
              {/* Top Clippers */}
              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} color="#3DFFA2" />
                  <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clippers</h2>
                </div>
                <div className="space-y-3">
                  {topClippers.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs w-4 text-right" style={{ color: "#8A93A6" }}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2" }}>{c.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{c.clips} clips</p>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif" }}>{fmt(c.views)}</span>
                    </div>
                  ))}
                  {topClippers.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips yet</p>}
                </div>
              </div>

              {/* Client Breakdown */}
              <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={14} color="#FF3B3B" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Active Clients</h2>
                  </div>
                  <button onClick={() => setActiveTab("clients")}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "#FF3B3B", background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.15)" }}>
                    Manage
                  </button>
                </div>
                <div className="space-y-3">
                  {clients.filter((c) => c.status === "active").slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B" }}>{c.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#F5F6FA" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#8A93A6" }}>{c.users.length} clippers · {c._count.clips} clips</p>
                      </div>
                    </div>
                  ))}
                  {clients.filter((c) => c.status === "active").length === 0 && (
                    <p className="text-sm" style={{ color: "#8A93A6" }}>No active clients</p>
                  )}
                </div>
              </div>
            </div>
          </>}

          {/* Clients tab — full management */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {activeTab === "clients" && (
            <ClientManagement initialClients={clients as any} />
          )}

          {/* Clippers tab — full management */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {activeTab === "clippers" && (
            <ClipperManagement initialClippers={clippers as any} allClients={allClients as any} />
          )}

        </div>
      </main>
    </div>
  );
}
