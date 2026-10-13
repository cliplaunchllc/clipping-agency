/**
 * seed-dummy.ts
 * Creates 6 dummy CPM clients with campaigns, M/W ongoing reports,
 * weekly campaign reports, and varied contact dates/statuses.
 *
 * Run: ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-dummy.ts
 */

import { PrismaClient, ClientStatus, OngoingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function mondayOfWeek(weeksAgo: number): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diffToMon - weeksAgo * 7);
  d.setHours(12, 0, 0, 0);
  return d;
}

function wednesdayOfWeek(weeksAgo: number): Date {
  const d = mondayOfWeek(weeksAgo);
  d.setDate(d.getDate() + 2);
  return d;
}

function sundayOfWeek(weeksAgo: number): Date {
  const d = mondayOfWeek(weeksAgo);
  d.setDate(d.getDate() + 6);
  return d;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randF(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Client definitions ───────────────────────────────────────────────────────

const CLIENTS: Array<{
  id: string; name: string; status: ClientStatus; budget: number;
  lastContactedDaysAgo: number; dealStartDaysAgo: number; dealLengthDays: number;
  clipsPerDay: number; campaignTrackerUrl: string | null;
}> = [
  {
    id: "dummy-client-novalux",
    name: "NovaLux Skincare",
    status: ClientStatus.active,
    budget: 18000,
    lastContactedDaysAgo: 1,
    dealStartDaysAgo: 62,
    dealLengthDays: 90,
    clipsPerDay: 4,
    campaignTrackerUrl: "https://docs.google.com/spreadsheets/d/demo-novalux",
  },
  {
    id: "dummy-client-ironpeak",
    name: "IronPeak Supplements",
    status: ClientStatus.active,
    budget: 25000,
    lastContactedDaysAgo: 4,
    dealStartDaysAgo: 45,
    dealLengthDays: 120,
    clipsPerDay: 6,
    campaignTrackerUrl: "https://docs.google.com/spreadsheets/d/demo-ironpeak",
  },
  {
    id: "dummy-client-driftco",
    name: "Drift & Co.",
    status: ClientStatus.active,
    budget: 12000,
    lastContactedDaysAgo: 2,
    dealStartDaysAgo: 30,
    dealLengthDays: 60,
    clipsPerDay: 3,
    campaignTrackerUrl: null,
  },
  {
    id: "dummy-client-luxora",
    name: "Luxora Fashion",
    status: ClientStatus.justlaunched,
    budget: 20000,
    lastContactedDaysAgo: 0,
    dealStartDaysAgo: 7,
    dealLengthDays: 90,
    clipsPerDay: 5,
    campaignTrackerUrl: null,
  },
  {
    id: "dummy-client-vaultfit",
    name: "VaultFit",
    status: "active" as const,
    budget: 30000,
    lastContactedDaysAgo: 6,
    dealStartDaysAgo: 78,
    dealLengthDays: 90,
    clipsPerDay: 7,
    campaignTrackerUrl: "https://docs.google.com/spreadsheets/d/demo-vaultfit",
  },
  {
    id: "dummy-client-solarbrew",
    name: "Solar Brew Co.",
    status: "active" as const,
    budget: 8500,
    lastContactedDaysAgo: 3,
    dealStartDaysAgo: 20,
    dealLengthDays: 60,
    clipsPerDay: 2,
    campaignTrackerUrl: null,
  },
];

// M/W report templates
const TRENDS = [
  "Hook-first TikTok clips driving 2× avg views. Short-form UGC outperforming branded cuts.",
  "Product demo format dominating. 15s cuts getting pushed by algorithm over 30s.",
  "Trending audio clips performing 40% above baseline. Authentic unboxing style winning.",
  "Lifestyle B-roll + voiceover combo getting strong retention. Reels performing well.",
  "Before/after format clips going viral on TikTok. Approval rate at campaign high.",
  "High-energy hooks under 2s converting best. POV-style content resonating.",
  "User testimonial format outperforming scripted ads 3:1. Raw authentic wins.",
];

const OPTIMIZATIONS = [
  "Double down on trending audio formats. Push 60% of quota to hook-first clips.",
  "Test 15s vs 30s comparison on Reels. Monitor retention drop-off on longer cuts.",
  "Replicate top-performing clip format across 5+ clippers for next cycle.",
  "Reinforce hook-first brief update. Mandatory review of new format template.",
  "Reallocate to top 3 clippers who are at 75%+ approval rate.",
  "Fast-track approvals for proven accounts. New clippers on probationary review.",
  "Shift mix: 50% product demo, 30% lifestyle, 20% testimonial based on data.",
];

const FEEDBACK = [
  "Clippers noting brief is clear. One request for higher-res brand assets — sent.",
  "Two clippers flagged upload portal issue — resolved. General morale high.",
  "Minor CTA placement confusion — clarified in brief update. No major issues.",
  "New clippers onboarded well. Brief confusion on color overlay — addressed.",
  "Strong response to updated brief. Two standout clips worth boosting.",
  "Clippers requesting faster feedback turnaround — implementing 24h SLA.",
  "Top performers engaged and consistent. Lower-volume clippers need re-engagement.",
];

// Weekly report text templates
const WEEKLY_SUMMARIES = [
  "Strong week overall. Top clips continue to trend and the approval rate held steady. Budget pacing on track.",
  "Best week of the campaign so far. Viral clip hit 400K organic views. Client extremely happy with results.",
  "Slight dip mid-week recovered by Friday. New brief format driving better clip quality across the board.",
  "Consistent performance. Platform mix balanced. TikTok leading with 65% of total views this week.",
  "Record approval rate this week at 78%. Clippers executing brief well after format refinement.",
];

const WHATS_WORKING = [
  "Hook-first formats, trending audio overlays, authentic product demo style.",
  "Short POV clips under 20s, UGC-style content, before/after transformations.",
  "TikTok algorithm pushing clips consistently. Top 3 clippers producing 70% of results.",
  "Instagram Reels gaining traction. YouTube Shorts emerging as a strong secondary platform.",
  "Product unboxing format getting high saves and shares — strong purchase intent signal.",
];

const WHATS_NOT_WORKING = [
  "Over-produced branded intros losing viewers in first 2 seconds. Removing from brief.",
  "Long-form content (30s+) underperforming on TikTok. Switching to 15s max.",
  "Generic lifestyle clips without product integration not converting.",
  "Clips without clear CTA seeing low link-click rate. Reinforcing CTA placement.",
];

const NEXT_WEEK = [
  "Push hook workshop output clips. Test 3 new format variants. Expand to YouTube Shorts.",
  "Scale top-performing format. Onboard 2 new clippers. Target 80%+ approval rate.",
  "Refine brief based on data. Brief all clippers on winning hook templates.",
  "Double quota on top 3 accounts. A/B test product demo vs lifestyle ratio.",
  "Launch Instagram Reels push. Target 1M cumulative views by end of next week.",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Creating 6 dummy clients with reports...\n");

  for (const def of CLIENTS) {
    console.log(`  → ${def.name}`);

    // Upsert client
    const client = await prisma.client.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        status: def.status,
        campaignType: "cpm",
        dealStartDate: daysAgo(def.dealStartDaysAgo),
        dealLengthDays: def.dealLengthDays,
        clipsPerDay: def.clipsPerDay,
        lastContactedAt: daysAgo(def.lastContactedDaysAgo),
        campaignTrackerUrl: def.campaignTrackerUrl,
      },
      create: {
        id: def.id,
        name: def.name,
        status: def.status,
        campaignType: "cpm",
        dealStartDate: daysAgo(def.dealStartDaysAgo),
        dealLengthDays: def.dealLengthDays,
        clipsPerDay: def.clipsPerDay,
        lastContactedAt: daysAgo(def.lastContactedDaysAgo),
        campaignTrackerUrl: def.campaignTrackerUrl,
      },
    });

    // Campaign
    const existingCampaign = await (prisma as any).clientCampaign.findFirst({
      where: { clientId: client.id, name: "Main Campaign" },
    });
    const campaign = existingCampaign ?? await (prisma as any).clientCampaign.create({
      data: {
        clientId: client.id,
        name: "Main Campaign",
        totalBudget: def.budget,
        order: 1,
      },
    });

    // Running totals for ongoing reports (simulate growth over time)
    let cumulativeViews = 0;
    let cumulativeSpent = 0;

    // How many weeks of history to generate (justlaunched gets fewer)
    const weeksBack = def.status === "justlaunched" ? 1 : 5;

    // Generate M/W ongoing reports from oldest to newest
    for (let w = weeksBack; w >= 0; w--) {
      const mon = mondayOfWeek(w);
      const wed = wednesdayOfWeek(w);

      // Skip future dates
      const now = new Date();
      const days: Array<{ date: Date; isWed: boolean }> = [];
      if (mon <= now) days.push({ date: mon, isWed: false });
      if (wed <= now) days.push({ date: wed, isWed: true });

      for (const { date } of days) {
        const submissions = rand(55, 95);
        const approved = rand(Math.floor(submissions * 0.55), Math.floor(submissions * 0.82));
        const rejected = rand(5, Math.floor(submissions * 0.15));
        const pending = submissions - approved - rejected;
        const viewsToday = rand(80_000, 420_000);
        cumulativeViews += viewsToday;

        const spendChunk = randF(def.budget * 0.03, def.budget * 0.07);
        cumulativeSpent = Math.min(cumulativeSpent + spendChunk, def.budget * 0.92);

        const effectiveCpm = randF(3.5, 11.0);
        const statusOpts: OngoingStatus[] = [OngoingStatus.Strong, OngoingStatus.Normal, OngoingStatus.Normal, OngoingStatus.NeedsAttention];
        const status: OngoingStatus = w === weeksBack && def.status !== ClientStatus.justlaunched
          ? pick([OngoingStatus.NeedsAttention, OngoingStatus.Normal])
          : pick(statusOpts);

        // Check if report already exists for this date+client
        const existing = await prisma.ongoingReport.findFirst({
          where: { clientId: client.id, date },
        });
        if (existing) continue;

        await prisma.ongoingReport.create({
          data: {
            clientId: client.id,
            campaignId: campaign.id,
            date,
            campaignName: def.name,
            totalSubmissions: submissions,
            pending: Math.max(0, pending),
            approved,
            rejected,
            viewsTotal: cumulativeViews,
            viewsToday,
            mainTrend: pick(TRENDS),
            mainOptimization: pick(OPTIMIZATIONS),
            clipperFeedback: pick(FEEDBACK),
            status,
            amountSpent: parseFloat(cumulativeSpent.toFixed(2)),
            effectiveCpm,
          },
        });
      }
    }

    // Generate weekly (CampaignReport) for completed weeks — skip justlaunched
    if (def.status !== "justlaunched") {
      let weeklySpent = 0;

      for (let w = weeksBack; w >= 1; w--) {
        const weekStart = mondayOfWeek(w);
        const weekEnd = sundayOfWeek(w);

        const existing = await prisma.campaignReport.findFirst({
          where: { clientId: client.id, weekEndDate: weekEnd },
        });
        if (existing) continue;

        const totalViews = rand(400_000, 1_800_000);
        const tiktok = Math.floor(totalViews * randF(0.45, 0.65));
        const instagram = Math.floor(totalViews * randF(0.20, 0.35));
        const youtube = Math.floor(totalViews * randF(0.05, 0.12));
        const twitter = totalViews - tiktok - instagram - youtube;

        const clipsSubmitted = rand(120, 220);
        const clipsApproved = rand(Math.floor(clipsSubmitted * 0.60), Math.floor(clipsSubmitted * 0.82));

        const weekSpend = randF(def.budget * 0.12, def.budget * 0.22);
        weeklySpent = Math.min(weeklySpent + weekSpend, def.budget * 0.88);
        const paidOut = parseFloat(weeklySpent.toFixed(2));
        const effectiveCpm = parseFloat((paidOut / (totalViews / 1000)).toFixed(2));
        const budgetRemaining = parseFloat((def.budget - paidOut).toFixed(2));

        await prisma.campaignReport.create({
          data: {
            clientId: client.id,
            weekStartDate: weekStart,
            weekEndDate: weekEnd,
            totalViews,
            tiktokViews: tiktok,
            instagramViews: instagram,
            youtubeViews: youtube,
            twitterViews: Math.max(0, twitter),
            paidOut,
            effectiveCpm,
            budgetRemaining,
            clipsSubmitted,
            clipsApproved,
            amountSpent: paidOut,
            weeklySummary: pick(WEEKLY_SUMMARIES),
            whatsWorking: pick(WHATS_WORKING),
            whatsNotWorking: pick(WHATS_NOT_WORKING),
            nextWeekFocus: pick(NEXT_WEEK),
            published: true,
            publishedAt: weekEnd,
          },
        });
      }
    }
  }

  console.log("\nDone! Dummy clients created:");
  for (const c of CLIENTS) {
    console.log(`  ${c.name} (${c.status}) — $${c.budget.toLocaleString()} budget, contacted ${c.lastContactedDaysAgo}d ago`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
