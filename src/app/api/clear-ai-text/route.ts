import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AI_ONGOING_STRINGS = [
  "Hook-first TikTok clips driving strong engagement. Short-form UGC outperforming branded cuts.",
  "Double down on trending audio formats. Push 60% of quota to hook-first clips.",
  "Clippers executing brief well. Strong engagement across all platforms.",
];

const AI_WEEKLY_STRINGS = [
  // Apex week 1
  "Strong opening week with TikTok leading performance. Viral clip on Sep 21 drove a single-day spike of 128K views. Approval rate held at 83%.",
  "Short-form TikTok hooks (under 7 sec) are outperforming longer cuts 3:1. Posts between 7–9 PM EST consistently hit higher view velocity.",
  "Instagram Reels underperformed — lower reach than expected possibly due to hashtag strategy. Testing new tag sets next week.",
  "Push TikTok volume to 15+ clips/day. Test 3 Instagram Reels formats with broader hashtag sets. Target 600K total views.",
  // Apex week 2
  "Best week yet — 817K views, up 76% over Week 1. The Sep 27 clip hit 204K views alone, driven by a trending audio hook. Approval rate improved to 87%.",
  "Trending audio integrations are delivering outsized reach. Consistency in posting schedule has improved account algorithmic favor on TikTok.",
  "YouTube Shorts still low relative to effort invested. May reallocate clipper time away from YT toward TikTok and Instagram.",
  "Target 1M+ total views. Scale TikTok to 20 clips/day. Reduce YouTube to 2 clips/day and redirect effort. Continue trending audio sourcing.",
];

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.REPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let cleared = 0;

  // Clear AI text from ongoing reports
  const ongoingReports = await prisma.ongoingReport.findMany({
    where: {
      OR: [
        { mainTrend: { in: AI_ONGOING_STRINGS } },
        { mainOptimization: { in: AI_ONGOING_STRINGS } },
        { clipperFeedback: { in: AI_ONGOING_STRINGS } },
      ],
    },
    select: { id: true, mainTrend: true, mainOptimization: true, clipperFeedback: true },
  });

  for (const r of ongoingReports) {
    await prisma.ongoingReport.update({
      where: { id: r.id },
      data: {
        mainTrend: AI_ONGOING_STRINGS.includes(r.mainTrend ?? "") ? null : r.mainTrend,
        mainOptimization: AI_ONGOING_STRINGS.includes(r.mainOptimization ?? "") ? null : r.mainOptimization,
        clipperFeedback: AI_ONGOING_STRINGS.includes(r.clipperFeedback ?? "") ? null : r.clipperFeedback,
      },
    });
    cleared++;
  }

  // Clear AI text from weekly campaign reports
  const weeklyReports = await prisma.campaignReport.findMany({
    where: {
      OR: [
        { weeklySummary: { in: AI_WEEKLY_STRINGS } },
        { whatsWorking: { in: AI_WEEKLY_STRINGS } },
        { whatsNotWorking: { in: AI_WEEKLY_STRINGS } },
        { nextWeekFocus: { in: AI_WEEKLY_STRINGS } },
      ],
    },
    select: { id: true, weeklySummary: true, whatsWorking: true, whatsNotWorking: true, nextWeekFocus: true },
  });

  for (const r of weeklyReports) {
    await prisma.campaignReport.update({
      where: { id: r.id },
      data: {
        weeklySummary: AI_WEEKLY_STRINGS.includes(r.weeklySummary ?? "") ? null : r.weeklySummary,
        whatsWorking: AI_WEEKLY_STRINGS.includes(r.whatsWorking ?? "") ? null : r.whatsWorking,
        whatsNotWorking: AI_WEEKLY_STRINGS.includes(r.whatsNotWorking ?? "") ? null : r.whatsNotWorking,
        nextWeekFocus: AI_WEEKLY_STRINGS.includes(r.nextWeekFocus ?? "") ? null : r.nextWeekFocus,
      },
    });
    cleared++;
  }

  return NextResponse.json({ ok: true, cleared, ongoingCleared: ongoingReports.length, weeklyCleared: weeklyReports.length });
}
