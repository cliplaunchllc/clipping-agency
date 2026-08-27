"use client";

import { useState } from "react";
import {
  Eye, Heart, MessageCircle, Share2, Bookmark, BarChart2,
  TrendingUp, TrendingDown, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";

type TimePeriod = "all" | "7d" | "mtd" | "custom";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(period: TimePeriod, cs: string, ce: string): [Date, Date] {
  const now = new Date();
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  if (period === "all") return [new Date(0), new Date("2099-12-31T23:59:59")];
  if (period === "7d") { const s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0); return [s, eod]; }
  if (period === "mtd") return [new Date(now.getFullYear(), now.getMonth(), 1), eod];
  return [
    cs ? new Date(cs + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1),
    ce ? new Date(ce + "T23:59:59") : eod,
  ];
}

function getPrevRange(s: Date, e: Date): [Date, Date] {
  const dur = e.getTime() - s.getTime();
  return [new Date(s.getTime() - dur - 1), new Date(s.getTime() - 1)];
}

function inRange<T extends { submittedAt: string }>(clips: T[], s: Date, e: Date): T[] {
  return clips.filter((c) => { const d = new Date(c.submittedAt); return d >= s && d <= e; });
}

function pct(curr: number, prev: number) {
  if (curr === 0 && prev === 0) return { str: "—", pos: true, ok: false };
  if (prev === 0) return { str: `+${Math.min(curr, 999)}%`, pos: true, ok: true };
  const p = ((curr - prev) / prev) * 100;
  const clamped = Math.max(-999, Math.min(999, Math.round(p)));
  return { str: `${clamped >= 0 ? "+" : ""}${clamped}%`, pos: p >= 0, ok: true };
}

function prevLabel(period: TimePeriod, cs: string, ce: string) {
  if (period === "all") return "all time";
  if (period === "7d") return "vs. prev. 7 days";
  if (period === "mtd") return "vs. prev. month (same period)";
  if (cs && ce) {
    const days = Math.round((new Date(ce).getTime() - new Date(cs).getTime()) / 86400000) + 1;
    return `vs. prev. ${days} days`;
  }
  return "vs. prev. period";
}

interface Clip {
  id: string; url: string; platform: string; handle: string;
  views: number; likes: number; comments: number; shares: number;
  saves: number; submittedAt: string; title: string | null; thumbnailUrl: string | null;
}

interface Props {
  client: { name: string; logoUrl: string | null; clips: Clip[] };
}

export default function PublicClientAnalytics({ client }: Props) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));

  const [rangeStart, rangeEnd] = getRange(timePeriod, customStart, customEnd);
  const filtered = inRange(client.clips, rangeStart, rangeEnd);
  const prev = timePeriod === "all"
    ? []
    : (() => { const [ps, pe] = getPrevRange(rangeStart, rangeEnd); return inRange(client.clips, ps, pe); })();

  const currViews    = filtered.reduce((a, c) => a + c.views, 0);
  const currLikes    = filtered.reduce((a, c) => a + c.likes, 0);
  const currComments = filtered.reduce((a, c) => a + c.comments, 0);
  const currShares   = filtered.reduce((a, c) => a + c.shares, 0);
  const currSaves    = filtered.reduce((a, c) => a + c.saves, 0);

  const prevViews    = prev.reduce((a, c) => a + c.views, 0);
  const prevLikes    = prev.reduce((a, c) => a + c.likes, 0);
  const prevComments = prev.reduce((a, c) => a + c.comments, 0);
  const prevShares   = prev.reduce((a, c) => a + c.shares, 0);
  const prevSaves    = prev.reduce((a, c) => a + c.saves, 0);
  const prevCount    = prev.length;

  const statItems = [
    { label: "Views",    value: fmt(currViews),    icon: Eye,           change: pct(currViews,    prevViews) },
    { label: "Likes",    value: fmt(currLikes),    icon: Heart,         change: pct(currLikes,    prevLikes) },
    { label: "Comments", value: fmt(currComments), icon: MessageCircle, change: pct(currComments, prevComments) },
    { label: "Shares",   value: fmt(currShares),   icon: Share2,        change: pct(currShares,   prevShares) },
    { label: "Saves",    value: fmt(currSaves),    icon: Bookmark,      change: pct(currSaves,    prevSaves) },
    { label: "Clips",    value: filtered.length.toString(), icon: BarChart2, change: pct(filtered.length, prevCount) },
  ];

  const byDate: Record<string, number> = {};
  filtered.forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + c.views;
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));

  const topClips = [...filtered].sort((a, b) => b.views - a.views).slice(0, 8);

  const tooltipStyle = {
    contentStyle: { background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 },
    labelStyle: { color: "#8A93A6" },
  };

  return (
    <div className="min-h-screen" style={{ background: "#05070D" }}>
      {/* Header bar */}
      <div className="sticky top-0 z-20 px-8 py-4 flex items-center justify-between"
        style={{ background: "rgba(5,7,13,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(10px)" }}>
        <div className="flex items-center gap-3">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "rgba(255,59,59,0.15)", color: "#FF3B3B" }}>
              {client.name[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{client.name}</p>
            <p className="text-xs" style={{ color: "#8A93A6" }}>Live Analytics</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: "rgba(61,255,162,0.1)", color: "#3DFFA2", border: "1px solid rgba(61,255,162,0.2)" }}>
          ● Live
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Time period controls */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-0.5 rounded-xl p-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["all", "7d", "mtd", "custom"] as const).map((p) => (
              <button key={p} onClick={() => setTimePeriod(p)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{
                  background: timePeriod === p ? "rgba(255,59,59,0.2)" : "transparent",
                  color: timePeriod === p ? "#FF3B3B" : "#8A93A6",
                }}>
                {p === "all" ? "All Time" : p === "7d" ? "7 Days" : p === "mtd" ? "This Month" : "Custom"}
              </button>
            ))}
          </div>
          {timePeriod === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
              <span className="text-xs" style={{ color: "#8A93A6" }}>to</span>
              <input type="date" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F6FA", colorScheme: "dark" }} />
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="rounded-2xl mb-2 overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-3">
            {statItems.map((item, i) => {
              const Icon = item.icon;
              const borderRight = (i % 3 !== 2) ? "1px solid rgba(255,255,255,0.06)" : "none";
              const borderBottom = i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none";
              return (
                <div key={item.label} className="flex items-center gap-4 px-6 py-6"
                  style={{ borderRight, borderBottom }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,59,59,0.12)" }}>
                    <Icon size={18} color="#FF3B3B" />
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "#8A93A6" }}>{item.label}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-2xl font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                        {item.value}
                      </span>
                      {item.change.ok && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold leading-none"
                          style={{ color: item.change.pos ? "#3DFFA2" : "#FF4757" }}>
                          {item.change.pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {item.change.str}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-xs" style={{ color: "#8A93A6" }}>{prevLabel(timePeriod, customStart, customEnd)}</p>
          </div>
        </div>

        {/* Views chart */}
        <div className="rounded-2xl p-6 mb-6 mt-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            Views Over Time
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="pubGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => fmtDate(v)} />
                <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => fmt(v)} width={48} />
                <Tooltip formatter={(v) => fmt(Number(v ?? 0))} {...tooltipStyle} itemStyle={{ color: "#3DFFA2" }} />
                <Area type="linear" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#pubGrad)"
                  dot={{ fill: "#FF3B3B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-10 text-center" style={{ color: "#8A93A6" }}>No clips in this period</p>
          )}
        </div>

        {/* Top clips */}
        {topClips.length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} color="#FF3B3B" />
              <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clips</h2>
            </div>
            <div className="space-y-3">
              {topClips.map((clip, i) => (
                <div key={clip.id} className="flex items-center gap-3 py-1">
                  <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                  {clip.thumbnailUrl ? (
                    <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover" style={{ width: 40, height: 40 }} />
                    </a>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <PlatformIcon platform={clip.platform} size={11} />
                      <span className="text-xs font-medium truncate"
                        style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                        @{clip.handle}
                      </span>
                    </div>
                    {clip.title && (
                      <p className="text-xs truncate mt-0.5" style={{ color: "#8A93A6" }}>{clip.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <span style={{ color: "#3DFFA2", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700 }}>{fmt(clip.views)}</span>
                    <span style={{ color: "#8A93A6" }}>{fmt(clip.likes)} likes</span>
                  </div>
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <ExternalLink size={11} color="#FF3B3B" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-8" style={{ color: "rgba(255,255,255,0.15)" }}>
          Powered by ClipLaunch
        </p>
      </div>
    </div>
  );
}
