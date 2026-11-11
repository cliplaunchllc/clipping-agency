"use client";

import { useState, useMemo } from "react";
import {
  Eye, TrendingUp, TrendingDown, ExternalLink, CheckCircle, FileText, DollarSign, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtCpm(n: number | null) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function startOfDay(d: Date) {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c;
}

function addDays(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}

function pctChange(curr: number, prev: number): { str: string; pos: boolean; ok: boolean } {
  if (curr === 0 && prev === 0) return { str: "—", pos: true, ok: false };
  if (prev === 0) return { str: `+${Math.min(curr * 100, 999)}%`, pos: true, ok: true };
  const p = ((curr - prev) / prev) * 100;
  const c = Math.max(-999, Math.min(999, Math.round(p)));
  return { str: `${c >= 0 ? "+" : ""}${c}%`, pos: p >= 0, ok: true };
}

type Period = "day" | "week" | "month" | "all" | "custom";

// ─── types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  date: string; // YYYY-MM-DD
  viewsTotal: number;
  viewsToday: number;
  totalSubmissions: number;
  approved: number;
  amountSpent: number | null;
  effectiveCpm: number | null;
  tiktokViews: number;
  instagramViews: number;
  youtubeViews: number;
}

interface TopClip {
  url?: string;
  creator?: string;
  platform?: string;
  views?: number;
  analysis?: string;
  [k: string]: unknown;
}

interface CampaignStats {
  viewsTotal: number;
  viewsToday: number;
  totalSubmissions: number;
  approved: number;
  rejected: number;
  amountSpent: number | null;
  effectiveCpm: number | null;
  totalBudget: number | null;
  budgetRemaining: number | null;
  tiktokViews: number;
  instagramViews: number;
  youtubeViews: number;
  topClips: TopClip[] | null;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  stats: CampaignStats | null;
  snapshots: Snapshot[];
}

interface Props {
  client: { name: string; logoUrl: string | null; campaigns: Campaign[] };
}

// ─── Donut chart label ─────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FF3B6B",
  instagram: "#E040FB",
  youtube: "#FF5722",
};

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform.toLowerCase()] ?? "#8A93A6";
  const labels: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
  return (
    <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {labels[platform.toLowerCase()] ?? platform}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PublicClientAnalytics({ client }: Props) {
  const [period, setPeriod] = useState<Period>("all");
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); });
  const [customEnd, setCustomEnd] = useState(() => isoDate(new Date()));

  // ── Aggregate snapshots across all campaigns ─────────────────────────────
  const allSnapshots = useMemo(() => {
    const byDate: Record<string, Snapshot> = {};
    for (const camp of client.campaigns) {
      for (const s of camp.snapshots) {
        if (!byDate[s.date]) {
          byDate[s.date] = { ...s };
        } else {
          const agg = byDate[s.date];
          agg.viewsTotal += s.viewsTotal;
          agg.viewsToday += s.viewsToday;
          agg.totalSubmissions += s.totalSubmissions;
          agg.approved += s.approved;
          agg.amountSpent = (agg.amountSpent ?? 0) + (s.amountSpent ?? 0);
          agg.tiktokViews += s.tiktokViews;
          agg.instagramViews += s.instagramViews;
          agg.youtubeViews += s.youtubeViews;
          agg.effectiveCpm = agg.viewsTotal > 0 && agg.amountSpent != null
            ? (agg.amountSpent / agg.viewsTotal) * 1000
            : null;
        }
      }
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [client.campaigns]);

  // ── Latest totals across campaigns ───────────────────────────────────────

  // ── Latest totals across campaigns ───────────────────────────────────────
  const latestStats = useMemo(() => {
    const totals = {
      viewsTotal: 0, totalSubmissions: 0, approved: 0,
      amountSpent: 0, tiktokViews: 0, instagramViews: 0, youtubeViews: 0,
      hasStats: false,
    };
    let totalSpend = 0;
    let totalViews = 0;
    for (const camp of client.campaigns) {
      if (!camp.stats) continue;
      totals.hasStats = true;
      totals.viewsTotal += camp.stats.viewsTotal;
      totals.totalSubmissions += camp.stats.totalSubmissions;
      totals.approved += camp.stats.approved;
      totals.amountSpent += camp.stats.amountSpent ?? 0;
      totals.tiktokViews += camp.stats.tiktokViews;
      totals.instagramViews += camp.stats.instagramViews;
      totals.youtubeViews += camp.stats.youtubeViews;
      totalSpend += camp.stats.amountSpent ?? 0;
      totalViews += camp.stats.viewsTotal;
    }
    const effectiveCpm = totalViews > 0 ? (totalSpend / totalViews) * 1000 : null;
    return { ...totals, effectiveCpm };
  }, [client.campaigns]);

  // Top clips across all campaigns, sorted by views
  const topClips = useMemo(() => {
    const all: TopClip[] = [];
    for (const camp of client.campaigns) {
      if (camp.stats?.topClips) all.push(...camp.stats.topClips);
    }
    return all.sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  }, [client.campaigns]);

  // ── Effective snapshots: use real history or synthesize from latest stats ──
  // When Grok hasn't pushed enough daily snapshots yet, synthesize a "today"
  // point from the latest CampaignStats so the graph always has data.
  const effectiveSnapshots = useMemo(() => {
    if (allSnapshots.length > 0) return allSnapshots;
    if (!latestStats.hasStats) return [];
    const today = isoDate(new Date());
    return [{
      date: today,
      viewsTotal: latestStats.viewsTotal,
      viewsToday: latestStats.viewsTotal, // use total as the single-day value
      totalSubmissions: latestStats.totalSubmissions,
      approved: latestStats.approved,
      amountSpent: latestStats.amountSpent > 0 ? latestStats.amountSpent : null,
      effectiveCpm: latestStats.effectiveCpm,
      tiktokViews: latestStats.tiktokViews,
      instagramViews: latestStats.instagramViews,
      youtubeViews: latestStats.youtubeViews,
    }];
  }, [allSnapshots, latestStats]);

  // ── Date range calculation ────────────────────────────────────────────────
  const { rangeStart, rangeEnd, prevStart, prevEnd, granularity } = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = isoDate(today);

    let rs: Date, re: Date;
    let gran: "day" | "week" | "month" = "day";

    if (period === "all") {
      rs = effectiveSnapshots.length > 0 ? new Date(effectiveSnapshots[0].date + "T00:00:00") : addDays(today, -365);
      re = today;
      gran = effectiveSnapshots.length > 90 ? "month" : effectiveSnapshots.length > 30 ? "week" : "day";
    } else if (period === "day") {
      rs = addDays(today, -6); re = today; gran = "day";
    } else if (period === "week") {
      rs = addDays(today, -27); re = today; gran = "week";
    } else if (period === "month") {
      rs = addDays(today, -364); re = today; gran = "month";
    } else {
      rs = startOfDay(new Date(customStart + "T00:00:00"));
      re = startOfDay(new Date(customEnd + "T00:00:00"));
      const days = (re.getTime() - rs.getTime()) / 86400000;
      gran = days > 90 ? "month" : days > 30 ? "week" : "day";
    }

    const dur = re.getTime() - rs.getTime();
    const ps = new Date(rs.getTime() - dur - 86400000);
    const pe = new Date(rs.getTime() - 1);

    void todayStr;
    return { rangeStart: rs, rangeEnd: re, prevStart: ps, prevEnd: pe, granularity: gran };
  }, [period, customStart, customEnd, effectiveSnapshots]);

  // Filter snapshots by range
  function filterSnaps(snaps: Snapshot[], s: Date, e: Date) {
    return snaps.filter((snap) => {
      const d = new Date(snap.date + "T00:00:00");
      return d >= s && d <= e;
    });
  }

  const inRange = useMemo(() => filterSnaps(effectiveSnapshots, rangeStart, rangeEnd), [effectiveSnapshots, rangeStart, rangeEnd]);
  const inPrev = useMemo(() => filterSnaps(effectiveSnapshots, prevStart, prevEnd), [effectiveSnapshots, prevStart, prevEnd]);

  // ── Metrics for selected period ───────────────────────────────────────────
  const currViews = period === "all" ? latestStats.viewsTotal : inRange.reduce((a, s) => a + s.viewsToday, 0);
  const prevViews = inPrev.reduce((a, s) => a + s.viewsToday, 0);

  const currSubmissions = period === "all" ? latestStats.totalSubmissions : inRange.reduce((a, s) => a + s.totalSubmissions, 0);
  const prevSubmissions = inPrev.reduce((a, s) => a + s.totalSubmissions, 0);

  const currApproved = period === "all" ? latestStats.approved : inRange.reduce((a, s) => a + s.approved, 0);
  const prevApproved = inPrev.reduce((a, s) => a + s.approved, 0);

  const currSpend = period === "all" ? latestStats.amountSpent : inRange.reduce((a, s) => a + (s.amountSpent ?? 0), 0);
  const prevSpend = inPrev.reduce((a, s) => a + (s.amountSpent ?? 0), 0);

  // CPM for period
  const currCpm = currViews > 0 && currSpend > 0 ? (currSpend / currViews) * 1000 : latestStats.effectiveCpm;
  const prevCpm = prevViews > 0 && prevSpend > 0 ? (prevSpend / prevViews) * 1000 : null;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (inRange.length === 0 && period === "all" && effectiveSnapshots.length === 0) return [];

    const snaps = period === "all" ? effectiveSnapshots : inRange;

    if (granularity === "day") {
      return snaps.map((s) => ({
        label: new Date(s.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views: s.viewsToday,
      }));
    }

    if (granularity === "week") {
      const weeks: Record<string, number> = {};
      for (const s of snaps) {
        const d = new Date(s.date + "T00:00:00");
        const mon = addDays(d, -((d.getDay() + 6) % 7));
        const key = isoDate(mon);
        weeks[key] = (weeks[key] ?? 0) + s.viewsToday;
      }
      return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({
        label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views,
      }));
    }

    // month
    const months: Record<string, number> = {};
    for (const s of snaps) {
      const key = s.date.slice(0, 7);
      months[key] = (months[key] ?? 0) + s.viewsToday;
    }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([ym, views]) => ({
      label: new Date(ym + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      views,
    }));
  }, [inRange, effectiveSnapshots, period, granularity]);

  // ── Platform donut data ───────────────────────────────────────────────────
  const donutData = useMemo(() => {
    let tik = 0, ins = 0, yt = 0;
    if (period === "all") {
      tik = latestStats.tiktokViews;
      ins = latestStats.instagramViews;
      yt = latestStats.youtubeViews;
    } else {
      inRange.forEach((s) => { tik += s.tiktokViews; ins += s.instagramViews; yt += s.youtubeViews; });
    }
    const total = tik + ins + yt;
    const result = [
      { name: "TikTok", value: tik, color: PLATFORM_COLORS.tiktok },
      { name: "Instagram", value: ins, color: PLATFORM_COLORS.instagram },
      { name: "YouTube", value: yt, color: PLATFORM_COLORS.youtube },
    ].filter((d) => d.value > 0);
    return { data: result, total };
  }, [period, inRange, latestStats]);

  // ── Last updated ──────────────────────────────────────────────────────────
  const lastUpdated = useMemo(() => {
    let latest: Date | null = null;
    for (const c of client.campaigns) {
      if (c.stats?.updatedAt) {
        const d = new Date(c.stats.updatedAt);
        if (!latest || d > latest) latest = d;
      }
    }
    if (!latest) return null;
    const mins = Math.round((Date.now() - latest.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }, [client.campaigns]);

  const tooltipStyle = {
    contentStyle: { background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 12, padding: "8px 14px" },
    labelStyle: { color: "var(--text-secondary)", fontSize: 11 },
    itemStyle: { color: "var(--success)" },
  };

  const periodLabels: Record<Period, string> = { day: "7 Days", week: "4 Weeks", month: "12 Months", all: "All Time", custom: "Custom" };

  const prevLabel = period === "all" ? null
    : period === "day" ? "vs. same 7 days prior"
    : period === "week" ? "vs. prior 4 weeks"
    : period === "month" ? "vs. prior year"
    : "vs. prior period";

  function Delta({ curr, prev, fmt: fmtFn }: { curr: number; prev: number; fmt?: (n: number) => string }) {
    const change = period === "all" ? { ok: false, str: "", pos: true } : pctChange(curr, prev);
    if (!change.ok) return null;
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold leading-none"
        style={{ color: change.pos ? "var(--success)" : "var(--danger)" }}>
        {change.pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {change.str}
      </span>
    );
    void fmtFn;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between"
        style={{ background: "rgba(5,7,13,0.92)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "rgba(255,59,59,0.15)", color: "var(--accent)" }}>
              {client.name[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              {client.name}
            </p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Campaign Analytics{lastUpdated ? ` · updated ${lastUpdated}` : ""}
            </p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: "rgba(61,214,140,0.1)", color: "var(--success)", border: "1px solid rgba(61,214,140,0.2)" }}>
          ● Live
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Timeframe selector */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <div className="flex items-center gap-0.5 rounded-xl p-0.5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            {(["all", "day", "week", "month", "custom"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{
                  background: period === p ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                  color: period === p ? "var(--accent)" : "var(--text-tertiary)",
                }}>
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl outline-none"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)", colorScheme: "dark" }} />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>→</span>
              <input type="date" value={customEnd} min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl outline-none"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)", colorScheme: "dark" }} />
            </div>
          )}
          {prevLabel && (
            <span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>{prevLabel}</span>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Total Views", icon: Eye, value: fmt(currViews), delta: <Delta curr={currViews} prev={prevViews} /> },
            { label: "Submitted", icon: FileText, value: fmt(currSubmissions), delta: <Delta curr={currSubmissions} prev={prevSubmissions} /> },
            { label: "Approved", icon: CheckCircle, value: fmt(currApproved), delta: <Delta curr={currApproved} prev={prevApproved} /> },
            { label: "Amount Paid", icon: DollarSign, value: fmtMoney(currSpend), delta: <Delta curr={currSpend} prev={prevSpend} /> },
            { label: "Eff. CPM", icon: Zap, value: fmtCpm(currCpm), delta: prevCpm != null ? <Delta curr={currCpm ?? 0} prev={prevCpm} /> : null },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,59,59,0.1)" }}>
                    <Icon size={14} color="var(--accent)" />
                  </div>
                  {card.delta}
                </div>
                <div>
                  <p className="text-xl font-bold leading-none mb-1"
                    style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                    {card.value}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{card.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Views chart + Platform donut side by side */}
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1fr 300px" }}>

          {/* Views over time */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Views Over Time
            </p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="shareGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF3B3B" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#FF3B3B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label"
                    tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => fmt(v)} width={44} />
                  <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), "Views"]} {...tooltipStyle} />
                  <Area type="monotone" dataKey="views" stroke="var(--accent)" strokeWidth={2}
                    fill="url(#shareGrad)"
                    dot={false} activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No data for this period yet</p>
              </div>
            )}
          </div>

          {/* Platform donut */}
          <div className="rounded-xl p-5 flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Platform Split
            </p>
            {donutData.data.length > 0 ? (
              <>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={donutData.data}
                        cx="50%" cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {donutData.data.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [fmt(Number(v)), "views"]}
                        contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 10 }}
                        labelStyle={{ color: "var(--text-secondary)", fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-1">
                  {donutData.data.map((d) => {
                    const pct = donutData.total > 0 ? Math.round((d.value / donutData.total) * 100) : 0;
                    return (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(d.value)}</span>
                          <span className="text-xs rounded-full px-1.5 py-0.5 font-medium"
                            style={{ background: `${d.color}18`, color: d.color }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No platform data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Top 5 clips */}
        {topClips.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 px-6 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <TrendingUp size={14} color="var(--success)" />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                Top Performing Clips
              </h2>
            </div>

            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {topClips.map((clip, i) => (
                <div key={i} className={`px-6 py-4 ${i === 0 ? "pt-5 pb-5" : ""}`}
                  style={{ background: i === 0 ? "rgba(61,214,140,0.025)" : undefined }}>
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                      style={i === 0
                        ? { background: "rgba(61,214,140,0.15)", color: "var(--success)", border: "1px solid rgba(61,214,140,0.25)" }
                        : { background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {clip.platform && <PlatformBadge platform={clip.platform} />}
                        {clip.creator && (
                          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            @{clip.creator}
                          </span>
                        )}
                        <span className="text-sm font-bold ml-auto"
                          style={{ color: "var(--success)", fontFamily: "var(--font-display)" }}>
                          {fmt(clip.views ?? 0)} views
                        </span>
                      </div>

                      {/* AI analysis */}
                      {clip.analysis && (
                        <p className="text-xs leading-relaxed mt-1.5"
                          style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          {clip.analysis}
                        </p>
                      )}

                      {clip.url && (
                        <a href={clip.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs mt-2 font-medium transition-colors"
                          style={{ color: "var(--accent)" }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.75")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}>
                          <ExternalLink size={11} /> View clip
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!latestStats.hasStats && (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
            <Eye size={32} color="var(--text-tertiary)" className="mx-auto mb-3" />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Data coming soon</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Stats are updated daily by your campaign team.</p>
          </div>
        )}

      </div>
    </div>
  );
}
