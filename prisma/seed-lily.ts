/**
 * seed-lily.ts
 * Adds 4 weeks of dummy mid-week ongoing reports to Lily Kate's account.
 *
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-lily.ts
 */

import { PrismaClient, OngoingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Find Lily Kate by name
  const client = await prisma.client.findFirst({ where: { name: { contains: "Lily" } } });
  if (!client) { console.error("Could not find Lily Kate client"); process.exit(1); }
  console.log(`Found client: ${client.name} (${client.id})`);

  // Find or create a campaign for her
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let campaign = await (prisma as any).clientCampaign.findFirst({ where: { clientId: client.id } });
  if (!campaign) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campaign = await (prisma as any).clientCampaign.create({
      data: { clientId: client.id, name: "Main Campaign", totalBudget: 15000, order: 1 },
    });
    console.log("Created campaign");
  }

  // 4 weeks of reports — two per week (Mon/Wed cadence), oldest to newest
  // Week 4 → Week 1 (most recent this week)
  const weeks: Array<{ label: string; daysAgoMon: number; daysAgoWed: number }> = [
    { label: "Week 4 (oldest)", daysAgoMon: 28, daysAgoWed: 26 },
    { label: "Week 3",          daysAgoMon: 21, daysAgoWed: 19 },
    { label: "Week 2",          daysAgoMon: 14, daysAgoWed: 12 },
    { label: "Week 1 (recent)", daysAgoMon: 7,  daysAgoWed: 5  },
  ];

  let cumulativeViews = 0;
  let cumulativeSpent = 0;

  const reports: Array<{
    daysAgo: number; submissions: number; approved: number; rejected: number;
    viewsToday: number; effectiveCpm: number; status: OngoingStatus;
  }> = [
    // Week 4
    { daysAgo: 28, submissions: 48, approved: 30, rejected: 6,  viewsToday: 95_000,  effectiveCpm: 8.20, status: OngoingStatus.Normal },
    { daysAgo: 26, submissions: 52, approved: 34, rejected: 7,  viewsToday: 112_000, effectiveCpm: 7.90, status: OngoingStatus.Normal },
    // Week 3
    { daysAgo: 21, submissions: 55, approved: 37, rejected: 5,  viewsToday: 138_000, effectiveCpm: 7.50, status: OngoingStatus.Normal },
    { daysAgo: 19, submissions: 60, approved: 41, rejected: 8,  viewsToday: 155_000, effectiveCpm: 7.10, status: OngoingStatus.Strong },
    // Week 2
    { daysAgo: 14, submissions: 62, approved: 44, rejected: 6,  viewsToday: 172_000, effectiveCpm: 6.80, status: OngoingStatus.Strong },
    { daysAgo: 12, submissions: 65, approved: 47, rejected: 7,  viewsToday: 198_000, effectiveCpm: 6.50, status: OngoingStatus.Strong },
    // Week 1
    { daysAgo: 7,  submissions: 70, approved: 51, rejected: 8,  viewsToday: 221_000, effectiveCpm: 6.20, status: OngoingStatus.Strong },
    { daysAgo: 5,  submissions: 74, approved: 55, rejected: 6,  viewsToday: 247_000, effectiveCpm: 5.95, status: OngoingStatus.Strong },
  ];

  const spendPerReport = [480, 510, 560, 590, 640, 680, 720, 760];

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    const date = daysAgo(r.daysAgo);
    cumulativeViews += r.viewsToday;
    cumulativeSpent += spendPerReport[i];

    const existing = await prisma.ongoingReport.findFirst({
      where: { clientId: client.id, date },
    });
    if (existing) {
      console.log(`  Skipping ${dateStr(date)} (already exists)`);
      continue;
    }

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
        viewsTotal: cumulativeViews,
        viewsToday: r.viewsToday,
        mainTrend: "Hook-first TikTok clips driving strong engagement. Short-form UGC outperforming branded cuts.",
        mainOptimization: "Double down on trending audio formats. Push 60% of quota to hook-first clips.",
        clipperFeedback: "Clippers executing brief well. Strong engagement across all platforms.",
        status: r.status,
        amountSpent: parseFloat(cumulativeSpent.toFixed(2)),
        effectiveCpm: r.effectiveCpm,
      },
    });
    console.log(`  Created report for ${dateStr(date)} — ${cumulativeViews.toLocaleString()} views, $${cumulativeSpent.toFixed(0)} spent`);
  }

  console.log("\nDone! Lily Kate now has 8 dummy reports across 4 weeks.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
