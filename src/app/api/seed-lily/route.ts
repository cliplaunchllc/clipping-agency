import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: { name: { contains: "Lily", mode: "insensitive" } },
  });
  if (!client) return NextResponse.json({ error: "Lily Kate client not found" }, { status: 404 });

  // Find or create campaign
  let campaign = await prisma.clientCampaign.findFirst({ where: { clientId: client.id } });
  if (!campaign) {
    campaign = await prisma.clientCampaign.create({
      data: { clientId: client.id, name: "Main Campaign", totalBudget: 15000, order: 1 },
    });
  }

  // Clear old reports so re-running is idempotent
  await prisma.ongoingReport.deleteMany({ where: { clientId: client.id } });

  // Build 8 reports: 4 weeks × 2 per week (Mon/Wed cadence), ascending date
  const now = new Date();
  function daysAgo(n: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  type ReportRow = {
    daysBack: number; submissions: number; approved: number; rejected: number;
    viewsToday: number; viewsTotal: number; amountSpent: number; effectiveCpm: number;
  };

  const rows: ReportRow[] = [
    // Week 4 (oldest)
    { daysBack: 28, submissions: 48, approved: 30, rejected: 6,  viewsToday: 95_000,  viewsTotal: 95_000,    amountSpent: 480,  effectiveCpm: 8.20 },
    { daysBack: 26, submissions: 52, approved: 34, rejected: 7,  viewsToday: 112_000, viewsTotal: 207_000,   amountSpent: 990,  effectiveCpm: 7.90 },
    // Week 3
    { daysBack: 21, submissions: 55, approved: 37, rejected: 5,  viewsToday: 138_000, viewsTotal: 345_000,   amountSpent: 1550, effectiveCpm: 7.50 },
    { daysBack: 19, submissions: 60, approved: 41, rejected: 8,  viewsToday: 155_000, viewsTotal: 500_000,   amountSpent: 2140, effectiveCpm: 7.10 },
    // Week 2
    { daysBack: 14, submissions: 62, approved: 44, rejected: 6,  viewsToday: 172_000, viewsTotal: 672_000,   amountSpent: 2780, effectiveCpm: 6.80 },
    { daysBack: 12, submissions: 65, approved: 47, rejected: 7,  viewsToday: 198_000, viewsTotal: 870_000,   amountSpent: 3460, effectiveCpm: 6.50 },
    // Week 1 (most recent)
    { daysBack: 7,  submissions: 70, approved: 51, rejected: 8,  viewsToday: 221_000, viewsTotal: 1_091_000, amountSpent: 4180, effectiveCpm: 6.20 },
    { daysBack: 5,  submissions: 74, approved: 55, rejected: 6,  viewsToday: 247_000, viewsTotal: 1_338_000, amountSpent: 4940, effectiveCpm: 5.95 },
  ];

  const created: string[] = [];
  for (const r of rows) {
    const date = daysAgo(r.daysBack);
    await prisma.ongoingReport.create({
      data: {
        clientId: client.id,
        campaignId: campaign.id,
        date,
        campaignName: client.name,
        totalSubmissions: r.submissions,
        pending: Math.max(0, r.submissions - r.approved - r.rejected),
        approved: r.approved,
        rejected: r.rejected,
        viewsTotal: r.viewsTotal,
        viewsToday: r.viewsToday,
        mainTrend: "Hook-first TikTok clips driving strong engagement. Short-form UGC outperforming branded cuts.",
        mainOptimization: "Double down on trending audio formats. Push 60% of quota to hook-first clips.",
        clipperFeedback: "Clippers executing brief well. Strong engagement across all platforms.",
        status: r.viewsToday > 200_000 ? "Strong" : "Normal",
        amountSpent: r.amountSpent,
        effectiveCpm: r.effectiveCpm,
      },
    });
    created.push(date.toISOString().slice(0, 10));
  }

  return NextResponse.json({ ok: true, client: client.name, created });
}
