import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Creating CPM demo client...");

  // Create the client record
  const client = await prisma.client.upsert({
    where: { id: "cpm-demo-client-1" },
    update: {
      campaignType: "cpm",
      dealStartDate: new Date("2025-09-01"),
      dealLengthDays: 90,
      clipsPerDay: 3,
      pageCount: 4,
    },
    create: {
      id: "cpm-demo-client-1",
      name: "Apex Media",
      status: "active",
      campaignType: "cpm",
      dealStartDate: new Date("2025-09-01"),
      dealLengthDays: 90,
      clipsPerDay: 3,
      pageCount: 4,
    },
  });

  // Create the login user
  await prisma.user.upsert({
    where: { email: "apex@demo.com" },
    update: {},
    create: {
      email: "apex@demo.com",
      name: "Apex Media",
      passwordHash: await bcrypt.hash("apex1234", 10),
      role: "client",
      status: "active",
      clientId: client.id,
    },
  });

  // Add onboarding steps
  const steps = [
    { title: "Sign your contract", description: "Review and sign the campaign agreement.", completed: true },
    { title: "Submit brand assets", description: "Logo, brand colors, and product images.", completed: true },
    { title: "Approve content brief", description: "Review clipper guidelines and messaging.", completed: false },
    { title: "Review first week clips", description: "Check your first batch of approved clips.", completed: false },
  ];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await prisma.clientOnboardingStep.create({
      data: {
        clientId: client.id,
        title: s.title,
        description: s.description,
        order: i,
        completed: s.completed,
      },
    });
  }

  // Seed ongoing reports — last 6 weeks (Mon + Wed each week)
  const today = new Date("2025-10-22");
  const reports = [
    // Week of Oct 20
    { date: "2025-10-20", submissions: 84, pending: 12, approved: 61, rejected: 11, status: "Strong", trend: "TikTok clips with trending audio performing 2x vs static content. Hook-first formats dominating.", optimization: "Double down on trending sound clips — allocate 60% of quota to TikTok hook formats this week.", feedback: "Clippers noting brand overlay guidelines are too strict — loosening color contrast rule helped approval rate." },
    { date: "2025-10-22", submissions: 91, pending: 8, approved: 69, rejected: 14, status: "Strong", trend: "Wednesday push shows strong carry-over momentum. Approval rate hit 75% — highest of campaign.", optimization: "Maintain current format mix. Test 15s vs 30s cut comparison on Instagram Reels.", feedback: "Two clippers flagged upload portal slowness — resolved after cache clear." },
    // Week of Oct 13
    { date: "2025-10-13", submissions: 76, pending: 15, approved: 52, rejected: 9, status: "Normal", trend: "Solid week overall. Short-form outperforming long-form 3:1. UGC-style clips driving most reach.", optimization: "Push clippers toward raw/authentic style — avoid over-produced intros.", feedback: "New clippers onboarded well. Minor brief confusion on CTA placement — clarified." },
    { date: "2025-10-15", submissions: 70, pending: 18, approved: 46, rejected: 6, status: "Normal", trend: "Mid-week dip in submissions from smaller accounts. Top 3 clippers responsible for 65% of approved clips.", optimization: "Re-engage lower-volume clippers with direct feedback and example clips.", feedback: "Overall positive sentiment. One clipper requesting higher-res brand assets." },
    // Week of Oct 6
    { date: "2025-10-06", submissions: 58, pending: 22, approved: 28, rejected: 8, status: "NeedsAttention", trend: "Below-target week. Clips lacking strong hook in first 2 seconds. Retention dropping off early.", optimization: "Mandatory hook workshop for all clippers. Brief updated with 3 hook templates.", feedback: "Clippers said brief was unclear on product angle — updated with clearer direction." },
    { date: "2025-10-08", submissions: 63, pending: 19, approved: 35, rejected: 9, status: "Normal", trend: "Recovery from Monday. Updated brief showing results — approval rate climbing back toward baseline.", optimization: "Continue reinforcing hook-first format. Monitor retention metrics on approved clips.", feedback: "Good response to updated brief. Two clippers submitted standout clips worth boosting." },
    // Week of Sep 29
    { date: "2025-09-29", submissions: 80, pending: 10, approved: 59, rejected: 11, status: "Strong", trend: "Strong end to September. Product demo clips outperforming lifestyle content by 40%.", optimization: "Shift content mix: 50% product demo, 30% lifestyle, 20% testimonial.", feedback: "High clipper morale. Payout processed on time — positive feedback from team." },
    { date: "2025-10-01", submissions: 75, pending: 14, approved: 52, rejected: 9, status: "Strong", trend: "October kickoff strong. Consistency from core clipper group driving reliable output.", optimization: "Lock in consistent top performers for priority review. Fast-track approvals for proven accounts.", feedback: "No major issues. Clippers requesting feedback turnaround under 24 hours — implemented." },
    // Week of Sep 22
    { date: "2025-09-22", submissions: 67, pending: 20, approved: 40, rejected: 7, status: "Normal", trend: "Steady week. No major spikes. Platform mix balanced across TikTok and Instagram.", optimization: "Test YouTube Shorts pipeline — two clippers willing to expand platform coverage.", feedback: "Minor formatting inconsistency in some clips — reminder sent to team." },
    { date: "2025-09-24", submissions: 72, pending: 16, approved: 47, rejected: 9, status: "Normal", trend: "Wednesday numbers hold steady. Top clip generated 180K organic views — brand loves it.", optimization: "Replicate high-performing clip format across 5 clippers for next cycle.", feedback: "Strong engagement on viral clip. Client team excited — morale boost for clippers." },
  ];

  for (const r of reports) {
    await prisma.ongoingReport.create({
      data: {
        clientId: client.id,
        date: new Date(r.date),
        campaignName: "Apex Media",
        totalSubmissions: r.submissions,
        pending: r.pending,
        approved: r.approved,
        rejected: r.rejected,
        mainTrend: r.trend,
        mainOptimization: r.optimization,
        clipperFeedback: r.feedback,
        status: r.status as "Strong" | "Normal" | "NeedsAttention",
      },
    });
  }

  console.log("Done. Login: apex@demo.com / apex1234");
}

main().catch(console.error).finally(() => prisma.$disconnect());
