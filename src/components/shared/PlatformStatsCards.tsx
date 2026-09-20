"use client";

import { PieChart, Pie, Cell } from "recharts";
import { Eye } from "lucide-react";
import { PlatformIcon, PLATFORM_COLORS, PLATFORM_LABELS } from "./PlatformIcon";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface DonutCardProps {
  title: string;
  dataByPlatform: Record<string, number>;
  totalLabel: string;
  icon: React.ReactNode;
}

function DonutCard({ title, dataByPlatform, totalLabel, icon }: DonutCardProps) {
  const platforms = Object.keys(dataByPlatform)
    .filter((p) => (dataByPlatform[p] ?? 0) > 0)
    .sort((a, b) => (dataByPlatform[b] ?? 0) - (dataByPlatform[a] ?? 0));
  const total = platforms.reduce((a, p) => a + (dataByPlatform[p] ?? 0), 0);

  const pieData = platforms.map((p) => ({
    name: p,
    value: dataByPlatform[p] ?? 0,
    color: PLATFORM_COLORS[p] ?? "#8A93A6",
  }));
  const emptySlice = [{ name: "empty", value: 1, color: "rgba(255,255,255,0.07)" }];

  return (
    <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-5">
        {icon}
        <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
          {title}
        </h2>
      </div>
      {total === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#8A93A6" }}>No data in this period</p>
      ) : (
        <div className="flex items-center gap-5">
          {/* Donut */}
          <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
            <PieChart width={120} height={120}>
              <Pie
                data={pieData.length > 0 ? pieData : emptySlice}
                cx={55} cy={55}
                innerRadius={36} outerRadius={52}
                dataKey="value"
                paddingAngle={pieData.length > 1 ? 2 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {(pieData.length > 0 ? pieData : emptySlice).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-bold leading-none" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                {fmt(total)}
              </span>
              <span className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>{totalLabel}</span>
            </div>
          </div>
          {/* Bars */}
          <div className="flex-1 space-y-2.5 min-w-0">
            {platforms.map((p) => {
              const val = dataByPlatform[p] ?? 0;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              const color = PLATFORM_COLORS[p] ?? "#8A93A6";
              return (
                <div key={p}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PlatformIcon platform={p} size={12} />
                      <span className="text-xs font-medium truncate" style={{ color: "#F5F6FA" }}>
                        {PLATFORM_LABELS[p] ?? p}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs" style={{ color: "#8A93A6" }}>{fmt(val)}</span>
                      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  viewsByPlatform: Record<string, number>;
  clipsByPlatform: Record<string, number>;
}

export function PlatformBreakdownTable({ viewsByPlatform, clipsByPlatform }: Props) {
  const platforms = [
    ...new Set([...Object.keys(viewsByPlatform), ...Object.keys(clipsByPlatform)]),
  ].filter((p) => (viewsByPlatform[p] ?? 0) > 0 || (clipsByPlatform[p] ?? 0) > 0)
    .sort((a, b) => (viewsByPlatform[b] ?? 0) - (viewsByPlatform[a] ?? 0));

  const totalViews = platforms.reduce((a, p) => a + (viewsByPlatform[p] ?? 0), 0);

  if (platforms.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p className="text-sm" style={{ color: "#8A93A6" }}>No platform data in this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Platform", "Posts", "Views", "Avg Views / Post", "% of Views"].map((h) => (
              <th key={h} className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider"
                style={{ color: "#8A93A6" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {platforms.map((p, i) => {
            const views = viewsByPlatform[p] ?? 0;
            const clips = clipsByPlatform[p] ?? 0;
            const avg = clips > 0 ? Math.round(views / clips) : 0;
            const pct = totalViews > 0 ? Math.round((views / totalViews) * 100) : 0;
            const color = PLATFORM_COLORS[p] ?? "#8A93A6";
            return (
              <tr key={p} style={{ borderBottom: i < platforms.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={p} size={14} />
                    <span className="text-sm font-medium" style={{ color }}>{PLATFORM_LABELS[p] ?? p}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-medium" style={{ color: "#F5F6FA" }}>{clips.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-semibold" style={{ color: "#3DFFA2" }}>{fmt(views)}</td>
                <td className="px-6 py-4 text-sm" style={{ color: "#F5F6FA" }}>{fmt(avg)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", minWidth: 80 }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PlatformStatsCards({ viewsByPlatform, clipsByPlatform }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <DonutCard
        title="Platform Stats"
        dataByPlatform={viewsByPlatform}
        totalLabel="views"
        icon={<Eye size={14} color="#3DFFA2" />}
      />
      <DonutCard
        title="Posts by Platform"
        dataByPlatform={clipsByPlatform}
        totalLabel="posts"
        icon={
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        }
      />
    </div>
  );
}
