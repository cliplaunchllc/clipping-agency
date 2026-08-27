"use client";

import { useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import { PlatformIcon, PLATFORM_COLORS } from "@/components/shared/PlatformIcon";
import {
  Eye, Heart, Share2, Bookmark, MessageCircle, ExternalLink, Check,
  TrendingUp, TrendingDown, RotateCw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

type TimePeriod = "all" | "1d" | "7d" | "mtd" | "custom";

function getRange(period: TimePeriod, cs: string, ce: string): [Date, Date] {
  const now = new Date();
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  if (period === "all") return [new Date(0), new Date("2099-12-31T23:59:59")];
  if (period === "1d") { const s = new Date(); s.setHours(0, 0, 0, 0); return [s, eod]; }
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
  if (prev === 0) return { str: "+∞", pos: true, ok: true };
  const p = ((curr - prev) / prev) * 100;
  return { str: `${p >= 0 ? "+" : ""}${Math.round(p)}%`, pos: p >= 0, ok: true };
}

function prevLabel(period: TimePeriod, cs: string, ce: string) {
  if (period === "all") return "all time";
  if (period === "1d") return "vs. yesterday";
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
  saves: number; earnings: number; submittedAt: string; clipperName: string | null;
  title?: string | null; thumbnailUrl?: string | null;
}
interface SubAccount { id: string; platform: string; handle: string; profileUrl: string | null; }
interface Clipper { id: string; name: string | null; clipCount: number; totalViews: number; subAccounts: SubAccount[]; }
interface Link { id: string; label: string; url: string; }
interface OnboardingStep { id: string; title: string; description: string | null; linkUrl: string | null; order: number; completed: boolean; }

interface ClientData {
  id: string; name: string; status: string;
  logoUrl: string | null;
  dealLengthDays: number | null; pageCount: number | null; clipsPerDay: number | null;
  createdAt: string;
  clips: Clip[]; clippers: Clipper[];
  links: Link[]; onboardingSteps: OnboardingStep[];
}

interface Props { client: ClientData; userName: string; previewMode?: boolean; }

export default function ClientDashboard({ client, userName, previewMode }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "deal" | "links" | "onboarding" | "clips">("overview");
  const [clips, setClips] = useState<Clip[]>(client.clips);
  const [refreshingClip, setRefreshingClip] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("7d");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));
  const [steps, setSteps] = useState<OnboardingStep[]>(client.onboardingSteps);
  const [togglingStep, setTogglingStep] = useState<string | null>(null);

  async function handleRefreshClip(clipId: string) {
    setRefreshingClip(clipId);
    const res = await fetch(`/api/clips/${clipId}`, { method: "PATCH" });
    if (res.ok) {
      const updated = await res.json();
      setClips((prev) => prev.map((c) => c.id === clipId ? { ...c, views: updated.views, likes: updated.likes, comments: updated.comments, shares: updated.shares, saves: updated.saves, thumbnailUrl: updated.thumbnailUrl } : c));
    }
    setRefreshingClip(null);
  }


  // Time filtered clips
  const [rangeStart, rangeEnd] = getRange(timePeriod, customStart, customEnd);
  const filteredClips = inRange(clips, rangeStart, rangeEnd);
  const prevClips = timePeriod === "all"
    ? []
    : (() => { const [ps, pe] = getPrevRange(rangeStart, rangeEnd); return inRange(clips, ps, pe); })();

  // Stats
  const currViews = filteredClips.reduce((a, c) => a + c.views, 0);
  const currLikes = filteredClips.reduce((a, c) => a + c.likes, 0);
  const currShares = filteredClips.reduce((a, c) => a + c.shares, 0);
  const currSaves = filteredClips.reduce((a, c) => a + c.saves, 0);

  const prevViews = prevClips.reduce((a, c) => a + c.views, 0);
  const prevLikes = prevClips.reduce((a, c) => a + c.likes, 0);
  const prevShares = prevClips.reduce((a, c) => a + c.shares, 0);
  const prevSaves = prevClips.reduce((a, c) => a + c.saves, 0);

  // Chart from filtered clips
  const byDate: Record<string, number> = {};
  (filteredClips as Clip[]).forEach((c) => {
    const date = c.submittedAt.slice(0, 10);
    byDate[date] = (byDate[date] ?? 0) + c.views;
  });
  const chartData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));

  // Top clips from all clips (not time-filtered for leaderboard context)
  const topClips = [...clips].sort((a, b) => b.views - a.views).slice(0, 5);

  // Onboarding
  const completedSteps = steps.filter((s) => s.completed).length;
  const onboardingPct = steps.length > 0
    ? Math.round((completedSteps / steps.length) * 100) : 0;

  async function toggleStep(stepId: string, completed: boolean) {
    if (previewMode) return;
    setTogglingStep(stepId);
    const res = await fetch(`/api/agency/clients/${client.id}/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, completed }),
    });
    if (res.ok) {
      setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, completed } : s));
    }
    setTogglingStep(null);
  }

  const statItems = [
    { label: "Views", value: fmt(currViews), icon: Eye, color: "#FF3B3B", change: pct(currViews, prevViews) },
    { label: "Likes", value: fmt(currLikes), icon: Heart, color: "#3DFFA2", change: pct(currLikes, prevLikes) },
    { label: "Shares", value: fmt(currShares), icon: Share2, color: "#a78bfa", change: pct(currShares, prevShares) },
    { label: "Saves", value: fmt(currSaves), icon: Bookmark, color: "#FFA500", change: pct(currSaves, prevSaves) },
  ];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "deal", label: "Deal Terms" },
    { id: "links", label: `Links (${client.links.length})` },
    { id: "onboarding", label: `Onboarding${steps.length > 0 ? ` ${onboardingPct}%` : ""}` },
    { id: "clips", label: "Clips" },
  ] as const;

  const tooltipStyle = {
    contentStyle: { background: "#0B0E17", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 },
    labelStyle: { color: "#8A93A6" },
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      {previewMode ? (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2"
          style={{ background: "rgba(11,14,23,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(8px)" }}>
          <a href="/agency" className="flex items-center gap-1.5 text-xs" style={{ color: "#8A93A6" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            Back to Agency
          </a>
          <span className="text-xs" style={{ color: "#8A93A6" }}>Viewing as <span style={{ color: "#F5F6FA" }}>{client.name}</span></span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B", border: "1px solid rgba(255,59,59,0.2)" }}>Preview</span>
        </div>
      ) : (
        <Sidebar role="client" userName={userName} />
      )}

      <main className={`flex-1 overflow-y-auto ${previewMode ? "" : "ml-60"}`}>
        <div className={`max-w-6xl mx-auto px-8 py-8 ${previewMode ? "pt-14" : ""}`}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            {client.logoUrl && (
              <img src={client.logoUrl} alt={client.name}
                className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
            )}
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{client.name}</h1>
              <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>{clips.length} clips · {client.clippers.flatMap((cl) => cl.subAccounts).length} accounts</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm font-medium relative tab-btn"
                style={{ color: activeTab === tab.id ? "#F5F6FA" : "#8A93A6" }}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#FF3B3B" }} />}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <>
              {/* Time period controls */}
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-0.5 rounded-xl p-0.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {(["all", "1d", "7d", "mtd", "custom"] as const).map((p) => (
                    <button key={p} onClick={() => setTimePeriod(p)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                      style={{
                        background: timePeriod === p ? "rgba(255,59,59,0.2)" : "transparent",
                        color: timePeriod === p ? "#FF3B3B" : "#8A93A6",
                      }}>
                      {p === "all" ? "All" : p === "1d" ? "Day" : p === "7d" ? "Week" : p === "mtd" ? "MTD" : "Custom"}
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

              {/* Stats bar */}
              <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex">
                  {statItems.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-4 px-6 py-6 flex-1 min-w-0"
                        style={{ borderRight: i < statItems.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${item.color}18` }}>
                          <Icon size={18} color={item.color} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <Icon size={10} color={item.color} />
                            <span className="text-xs truncate" style={{ color: "#8A93A6" }}>{item.label}</span>
                          </div>
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
              <div className="rounded-2xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Views Over Time</h2>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <defs>
                        <linearGradient id="clientViewGrad" x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="linear" dataKey="views" stroke="#FF3B3B" strokeWidth={2} fill="url(#clientViewGrad)"
                        dot={{ fill: "#FF3B3B", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#FF3B3B", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm py-10 text-center" style={{ color: "#8A93A6" }}>No clips in this period</p>
                )}
              </div>

              {/* Clippers + Top Clips */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <h2 className="text-sm font-semibold mb-4" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Accounts</h2>
                  {(() => {
                    const allAccounts = client.clippers.flatMap((cl) => cl.subAccounts);
                    const byPlatform: Record<string, SubAccount[]> = {};
                    allAccounts.forEach((s) => {
                      if (!byPlatform[s.platform]) byPlatform[s.platform] = [];
                      byPlatform[s.platform].push(s);
                    });
                    const platforms = Object.keys(byPlatform);
                    if (platforms.length === 0) return <p className="text-sm" style={{ color: "#8A93A6" }}>No accounts yet</p>;
                    return (
                      <div className="space-y-4">
                        {platforms.map((platform) => (
                          <div key={platform}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <PlatformIcon platform={platform} size={13} />
                              <span className="text-xs font-semibold" style={{ color: PLATFORM_COLORS[platform] ?? "#8A93A6" }}>
                                {platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1)}
                              </span>
                            </div>
                            <div className="space-y-1.5 pl-5">
                              {byPlatform[platform].map((s) => (
                                s.profileUrl ? (
                                  <a key={s.id} href={s.profileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs transition-colors"
                                    style={{ color: "#F5F6FA" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = PLATFORM_COLORS[platform] ?? "#8A93A6")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#F5F6FA")}>
                                    @{s.handle}
                                    <ExternalLink size={10} color="#8A93A6" />
                                  </a>
                                ) : (
                                  <p key={s.id} className="text-xs" style={{ color: "#F5F6FA" }}>@{s.handle}</p>
                                )
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={13} color="#FF3B3B" />
                    <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Top Clips</h2>
                  </div>
                  <div className="space-y-3">
                    {topClips.map((clip, i) => (
                      <div key={clip.id} className="flex items-center gap-2">
                        <span className="text-xs w-4 text-right flex-shrink-0" style={{ color: "#8A93A6" }}>{i + 1}</span>
                        {clip.thumbnailUrl ? (
                          <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover" style={{ width: 36, height: 36 }} />
                          </a>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <PlatformIcon platform={clip.platform} size={11} />
                            <span className="text-xs truncate font-medium" style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>@{clip.handle}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-0.5" style={{ color: "#3DFFA2", fontSize: 10 }}><Eye size={9} color="#FF3B3B" />{fmt(clip.views)}</span>
                            <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Heart size={9} color="#3DFFA2" />{fmt(clip.likes)}</span>
                            <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><MessageCircle size={9} color="#a78bfa" />{fmt(clip.comments)}</span>
                            <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Share2 size={9} color="#60a5fa" />{fmt(clip.shares)}</span>
                            <span className="flex items-center gap-0.5" style={{ color: "#8A93A6", fontSize: 10 }}><Bookmark size={9} color="#FFA500" />{fmt(clip.saves)}</span>
                          </div>
                        </div>
                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0"><ExternalLink size={11} color="#FF3B3B" /></a>
                      </div>
                    ))}
                    {topClips.length === 0 && <p className="text-sm" style={{ color: "#8A93A6" }}>No clips yet</p>}
                  </div>
                </div>
              </div>

            </>
          )}

          {/* ── DEAL TERMS ─── */}
          {activeTab === "deal" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Deal Length", value: client.dealLengthDays ? `${client.dealLengthDays} days` : "—" },
                { label: "Pages", value: client.pageCount?.toString() ?? "—" },
                { label: "Clips / Day", value: client.clipsPerDay?.toString() ?? "—" },
                { label: "Total Clips Submitted", value: client.clips.length.toString() },
                { label: "Active Clippers", value: client.clippers.length.toString() },
                { label: "Started", value: new Date(client.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs mb-2" style={{ color: "#8A93A6" }}>{item.label}</p>
                  <p className="text-2xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── LINKS ─── */}
          {activeTab === "links" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              {client.links.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No links added yet</p>
              ) : (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {client.links.map((link) => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{link.label}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: "#8A93A6" }}>{link.url}</p>
                      </div>
                      <ExternalLink size={14} color="#FF3B3B" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ONBOARDING ─── */}
          {activeTab === "onboarding" && (
            <div className="space-y-4">
              {steps.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: "#8A93A6" }}>Progress — {completedSteps} of {steps.length} complete</span>
                    <span className="text-xs font-medium" style={{ color: "#3DFFA2" }}>{onboardingPct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${onboardingPct}%`, background: "linear-gradient(90deg, #3DFFA2, #FF3B3B)" }} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={step.id} className="flex items-start gap-4 p-4 rounded-2xl transition-all"
                    style={{ background: "#0B0E17", border: `1px solid ${step.completed ? "rgba(61,255,162,0.15)" : "rgba(255,255,255,0.08)"}` }}>
                    <button
                      onClick={() => toggleStep(step.id, !step.completed)}
                      disabled={togglingStep === step.id || previewMode}
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all check-circle"
                      style={{
                        background: step.completed ? "rgba(61,255,162,0.2)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${step.completed ? "#3DFFA2" : "rgba(255,255,255,0.25)"}`,
                        cursor: previewMode ? "default" : "pointer",
                        opacity: togglingStep === step.id ? 0.5 : 1,
                      }}>
                      {step.completed ? <Check size={11} color="#3DFFA2" /> : <span className="text-xs" style={{ color: "#8A93A6" }}>{i + 1}</span>}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: step.completed ? "#8A93A6" : "#F5F6FA", textDecoration: step.completed ? "line-through" : "none" }}>
                        {step.title}
                      </p>
                      {step.description && <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>{step.description}</p>}
                      {step.linkUrl && (
                        <a href={step.linkUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs mt-1.5 px-3 py-1 rounded-lg font-medium transition-colors"
                          style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B" }}>
                          <ExternalLink size={10} /> Open Link
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {steps.length === 0 && (
                  <p className="text-center text-sm py-12" style={{ color: "#8A93A6" }}>No onboarding steps set up yet</p>
                )}
              </div>
            </div>
          )}

          {/* ── CLIPS ─── */}
          {activeTab === "clips" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Platform", "Preview", "Title", "Account", "Views", "Likes", "Comments", "Shares", "Date", "Link", "Refresh"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clips.map((clip, i) => (
                    <tr key={clip.id} style={{ borderBottom: i < clips.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={clip.platform} size={13} />
                          <span className="text-xs font-medium" style={{ color: PLATFORM_COLORS[clip.platform] ?? "#8A93A6" }}>
                            {clip.platform === "twitter" ? "X" : clip.platform.charAt(0).toUpperCase() + clip.platform.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {clip.thumbnailUrl ? (
                          <a href={clip.url} target="_blank" rel="noopener noreferrer">
                            <img src={clip.thumbnailUrl} alt="thumb" className="rounded object-cover"
                              style={{ width: 64, height: 36 }} />
                          </a>
                        ) : (
                          <span style={{ color: "#8A93A6", fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA", maxWidth: 120 }}>
                        <span className="truncate block">{clip.title ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>@{clip.handle}</td>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: "#3DFFA2" }}>{fmt(clip.views)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.likes)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#a78bfa" }}>{fmt(clip.comments)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#F5F6FA" }}>{fmt(clip.shares)}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "#8A93A6" }}>{new Date(clip.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="px-5 py-3"><a href={clip.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} color="#FF3B3B" /></a></td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleRefreshClip(clip.id)} disabled={refreshingClip === clip.id} title="Refresh stats from platform" className="icon-btn p-1 rounded">
                          <RotateCw size={12} color="#8A93A6" className={refreshingClip === clip.id ? "animate-spin" : ""} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clips.length === 0 && (
                    <tr><td colSpan={11} className="px-5 py-12 text-center text-sm" style={{ color: "#8A93A6" }}>No clips yet</td></tr>
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
