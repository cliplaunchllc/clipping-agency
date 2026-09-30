import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: { name: { contains: "Apex", mode: "insensitive" } },
  });

  if (!client) {
    return NextResponse.json({ error: "Apex Media client not found" }, { status: 404 });
  }

  // Clear existing reports
  await prisma.ongoingReport.deleteMany({ where: { clientId: client.id } });
  await prisma.campaignReport.deleteMany({ where: { clientId: client.id } });

  const baseDate = new Date("2026-09-16T12:00:00Z");
  const rows = [
    { d: 0,  subs: 12, pend: 3, appr: 9,  vToday: 42_000,  vTotal: 42_000 },
    { d: 1,  subs: 15, pend: 2, appr: 13, vToday: 67_500,  vTotal: 109_500 },
    { d: 2,  subs: 10, pend: 4, appr: 6,  vToday: 38_200,  vTotal: 147_700 },
    { d: 3,  subs: 18, pend: 1, appr: 17, vToday: 94_000,  vTotal: 241_700 },
    { d: 4,  subs: 14, pend: 5, appr: 9,  vToday: 51_300,  vTotal: 293_000 },
    { d: 5,  subs: 20, pend: 2, appr: 18, vToday: 128_000, vTotal: 421_000 },
    { d: 6,  subs: 11, pend: 3, appr: 8,  vToday: 44_100,  vTotal: 465_100 },
    { d: 7,  subs: 22, pend: 0, appr: 22, vToday: 176_000, vTotal: 641_100 },
    { d: 8,  subs: 9,  pend: 4, appr: 5,  vToday: 29_800,  vTotal: 670_900 },
    { d: 9,  subs: 17, pend: 2, appr: 15, vToday: 112_400, vTotal: 783_300 },
    { d: 10, subs: 13, pend: 6, appr: 7,  vToday: 58_700,  vTotal: 842_000 },
    { d: 11, subs: 25, pend: 1, appr: 24, vToday: 204_000, vTotal: 1_046_000 },
    { d: 12, subs: 16, pend: 3, appr: 13, vToday: 89_600,  vTotal: 1_135_600 },
    { d: 13, subs: 21, pend: 2, appr: 19, vToday: 147_200, vTotal: 1_282_800 },
  ];

  const created = [];
  for (const row of rows) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + row.d);
    const report = await prisma.ongoingReport.create({
      data: {
        clientId: client.id,
        date,
        campaignName: "Apex Media — Main",
        totalSubmissions: row.subs,
        pending: row.pend,
        approved: row.appr,
        rejected: 0,
        viewsToday: row.vToday,
        viewsTotal: row.vTotal,
        status: "Normal",
      },
    });
    created.push({ date: date.toISOString().slice(0, 10), viewsToday: row.vToday });
  }

  // Seed 2 end-of-week CampaignReports
  const weeklyReports = [
    {
      weekStartDate: new Date("2026-09-16T12:00:00Z"),
      weekEndDate:   new Date("2026-09-22T12:00:00Z"),
      totalViews: 465_100,
      tiktokViews: 280_000,
      instagramViews: 120_000,
      youtubeViews: 45_100,
      twitterViews: 20_000,
      paidOut: 930.20,
      effectiveCpm: 2.00,
      budgetRemaining: 4069.80,
      clipsSubmitted: 90,
      clipsApproved: 75,
      weeklySummary: "Strong opening week with TikTok leading performance. Viral clip on Sep 21 drove a single-day spike of 128K views. Approval rate held at 83%.",
      whatsWorking: "Short-form TikTok hooks (under 7 sec) are outperforming longer cuts 3:1. Posts between 7–9 PM EST consistently hit higher view velocity.",
      whatsNotWorking: "Instagram Reels underperformed — lower reach than expected possibly due to hashtag strategy. Testing new tag sets next week.",
      nextWeekFocus: "Push TikTok volume to 15+ clips/day. Test 3 Instagram Reels formats with broader hashtag sets. Target 600K total views.",
      published: true,
      publishedAt: new Date("2026-09-23T09:00:00Z"),
    },
    {
      weekStartDate: new Date("2026-09-23T12:00:00Z"),
      weekEndDate:   new Date("2026-09-29T12:00:00Z"),
      totalViews: 817_700,
      tiktokViews: 520_000,
      instagramViews: 180_000,
      youtubeViews: 80_000,
      twitterViews: 37_700,
      paidOut: 1635.40,
      effectiveCpm: 2.00,
      budgetRemaining: 2434.40,
      clipsSubmitted: 105,
      clipsApproved: 91,
      weeklySummary: "Best week yet — 817K views, up 76% over Week 1. The Sep 27 clip hit 204K views alone, driven by a trending audio hook. Approval rate improved to 87%.",
      whatsWorking: "Trending audio integrations are delivering outsized reach. Consistency in posting schedule has improved account algorithmic favor on TikTok.",
      whatsNotWorking: "YouTube Shorts still low relative to effort invested. May reallocate clipper time away from YT toward TikTok and Instagram.",
      nextWeekFocus: "Target 1M+ total views. Scale TikTok to 20 clips/day. Reduce YouTube to 2 clips/day and redirect effort. Continue trending audio sourcing.",
      published: true,
      publishedAt: new Date("2026-09-30T09:00:00Z"),
    },
  ];

  for (const wr of weeklyReports) {
    await prisma.campaignReport.create({ data: { clientId: client.id, ...wr } });
  }

  return NextResponse.json({
    ok: true,
    client: client.name,
    dailyReportsCreated: created.length,
    weeklyReportsCreated: weeklyReports.length,
    reports: created,
  });
}
