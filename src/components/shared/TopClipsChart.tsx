"use client";

import { Trophy } from "lucide-react";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface Clip {
  id: string;
  url: string;
  views: number;
  likes: number;
  thumbnailUrl: string | null;
  title?: string | null;
  platform: string;
  handle: string;
}

interface Props {
  clips: Clip[];
}

const BAR_H = 180; // px — max bar height
const THUMB_H = 60; // px — thumbnail row height

export default function TopClipsChart({ clips }: Props) {
  const top10 = [...clips].sort((a, b) => b.views - a.views).slice(0, 10);
  if (top10.length === 0) return null;

  const maxViews = top10[0].views || 1;

  // Y-axis tick values at 0%, 25%, 50%, 75%, 100% of max
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => ({
    label: fmt(Math.round(maxViews * f)),
    pct: f,
  }));

  const rankColors = ["#3DFFA2", "#a78bfa", "#FB923C", "#8A93A6", "#8A93A6"];

  return (
    <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={14} color="#3DFFA2" />
        <h2 className="text-sm font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
          Top {top10.length} Clips by Views
        </h2>
      </div>

      {/* Chart */}
      <div className="flex gap-3" style={{ alignItems: "flex-end" }}>
        {/* Y-axis */}
        <div className="flex-shrink-0 flex flex-col justify-between pr-2" style={{ height: BAR_H + THUMB_H, paddingBottom: THUMB_H }}>
          {yTicks.map((t) => (
            <span key={t.pct} className="text-right block" style={{ fontSize: 10, color: "#8A93A6", lineHeight: 1 }}>
              {t.label}
            </span>
          ))}
        </div>

        {/* Bars + thumbnails */}
        <div className="flex-1 relative" style={{ height: BAR_H + THUMB_H }}>
          {/* Horizontal grid lines */}
          {yTicks.map((t) => (
            <div key={t.pct} className="absolute left-0 right-0 pointer-events-none"
              style={{
                bottom: THUMB_H + t.pct * BAR_H,
                height: 1,
                background: t.pct === 1
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.04)",
                borderTop: t.pct === 0 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }} />
          ))}

          {/* Columns */}
          <div className="absolute inset-0 flex gap-1.5" style={{ alignItems: "flex-end" }}>
            {top10.map((clip, i) => {
              const barHeight = Math.max(4, (clip.views / maxViews) * BAR_H);
              const isTop3 = i < 3;
              const barColor = i === 0
                ? "linear-gradient(to top, #FF3B3B, #FF6060)"
                : i === 1
                  ? "linear-gradient(to top, rgba(255,59,59,0.75), rgba(255,96,96,0.75))"
                  : i === 2
                    ? "linear-gradient(to top, rgba(255,59,59,0.55), rgba(255,96,96,0.55))"
                    : "linear-gradient(to top, rgba(255,59,59,0.32), rgba(255,96,96,0.32))";

              return (
                <div key={clip.id} className="flex-1 flex flex-col" style={{ height: BAR_H + THUMB_H, alignItems: "center", justifyContent: "flex-end" }}>
                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* View count above bar */}
                  <span style={{ fontSize: 9, color: isTop3 ? "#F5F6FA" : "#8A93A6", marginBottom: 3, fontFamily: "Space Grotesk, sans-serif", fontWeight: isTop3 ? 600 : 400 }}>
                    {fmt(clip.views)}
                  </span>

                  {/* Bar */}
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="w-full block"
                    style={{ height: barHeight, background: barColor, borderRadius: "4px 4px 0 0", transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    title={clip.title ?? `@${clip.handle}`}
                  />

                  {/* Thumbnail */}
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="w-full block"
                    style={{ height: THUMB_H - 16, marginTop: 3, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                    {clip.thumbnailUrl ? (
                      <img src={clip.thumbnailUrl} alt={`#${i + 1}`}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 9, color: "#8A93A6" }}>{i + 1}</span>
                      </div>
                    )}
                  </a>

                  {/* Rank */}
                  <span style={{ fontSize: 9, color: rankColors[i] ?? "#8A93A6", marginTop: 3, fontWeight: 600, lineHeight: 1 }}>
                    #{i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
