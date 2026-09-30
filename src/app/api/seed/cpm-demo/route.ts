import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token } = await req.json();
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Client record
  const client = await prisma.client.upsert({
    where: { id: "cpm-demo-client-1" },
    update: { campaignType: "cpm" },
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

  // Login user
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

  // Onboarding steps
  const existing = await prisma.clientOnboardingStep.count({ where: { clientId: client.id } });
  if (existing === 0) {
    await prisma.clientOnboardingStep.createMany({
      data: [
        { clientId: client.id, title: "Sign your contract", description: "Review and sign the campaign agreement.", order: 0, completed: true },
        { clientId: client.id, title: "Submit brand assets", description: "Logo, brand colors, and product images.", order: 1, completed: true },
        { clientId: client.id, title: "Approve content brief", description: "Review clipper guidelines and messaging.", order: 2, completed: false },
        { clientId: client.id, title: "Review first week clips", description: "Check your first batch of approved clips.", order: 3, completed: false },
      ],
    });
  }

  // Delete existing reports so we can re-seed cleanly
  await prisma.ongoingReport.deleteMany({ where: { clientId: client.id } });

  const reports = [
    { date: "2025-10-20", submissions: 84, pending: 12, approved: 61, rejected: 11, status: "Strong",
      trend: "TikTok clips with trending audio performing 2x vs static content. Hook-first formats dominating.",
      optimization: "Double down on trending sound clips — allocate 60% of quota to TikTok hook formats this week.",
      feedback: "Clippers noting brand overlay guidelines are too strict — loosening color contrast rule helped approval rate." },
    { date: "2025-10-22", submissions: 91, pending: 8, approved: 69, rejected: 14, status: "Strong",
      trend: "Wednesday push shows strong carry-over momentum. Approval rate hit 75% — highest of campaign.",
      optimization: "Maintain current format mix. Test 15s vs 30s cut comparison on Instagram Reels.",
      feedback: "Two clippers flagged upload portal slowness — resolved after cache clear." },
    { date: "2025-10-13", submissions: 76, pending: 15, approved: 52, rejected: 9, status: "Normal",
      trend: "Solid week overall. Short-form outperforming long-form 3:1. UGC-style clips driving most reach.",
      optimization: "Push clippers toward raw/authentic style — avoid over-produced intros.",
      feedback: "New clippers onboarded well. Minor brief confusion on CTA placement — clarified." },
    { date: "2025-10-15", submissions: 70, pending: 18, approved: 46, rejected: 6, status: "Normal",
      trend: "Mid-week dip in submissions from smaller accounts. Top 3 clippers responsible for 65% of approved clips.",
      optimization: "Re-engage lower-volume clippers with direct feedback and example clips.",
      feedback: "Overall positive sentiment. One clipper requesting higher-res brand assets." },
    { date: "2025-10-06", submissions: 58, pending: 22, approved: 28, rejected: 8, status: "NeedsAttention",
      trend: "Below-target week. Clips lacking strong hook in first 2 seconds. Retention dropping off early.",
      optimization: "Mandatory hook workshop for all clippers. Brief updated with 3 hook templates.",
      feedback: "Clippers said brief was unclear on product angle — updated with clearer direction." },
    { date: "2025-10-08", submissions: 63, pending: 19, approved: 35, rejected: 9, status: "Normal",
      trend: "Recovery from Monday. Updated brief showing results — approval rate climbing back toward baseline.",
      optimization: "Continue reinforcing hook-first format. Monitor retention metrics on approved clips.",
      feedback: "Good response to updated brief. Two clippers submitted standout clips worth boosting." },
    { date: "2025-09-29", submissions: 80, pending: 10, approved: 59, rejected: 11, status: "Strong",
      trend: "Strong end to September. Product demo clips outperforming lifestyle content by 40%.",
      optimization: "Shift content mix: 50% product demo, 30% lifestyle, 20% testimonial.",
      feedback: "High clipper morale. Payout processed on time — positive feedback from team." },
    { date: "2025-10-01", submissions: 75, pending: 14, approved: 52, rejected: 9, status: "Strong",
      trend: "October kickoff strong. Consistency from core clipper group driving reliable output.",
      optimization: "Lock in consistent top performers for priority review. Fast-track approvals for proven accounts.",
      feedback: "No major issues. Clippers requesting feedback turnaround under 24 hours — implemented." },
    { date: "2025-09-22", submissions: 67, pending: 20, approved: 40, rejected: 7, status: "Normal",
      trend: "Steady week. No major spikes. Platform mix balanced across TikTok and Instagram.",
      optimization: "Test YouTube Shorts pipeline — two clippers willing to expand platform coverage.",
      feedback: "Minor formatting inconsistency in some clips — reminder sent to team." },
    { date: "2025-09-24", submissions: 72, pending: 16, approved: 47, rejected: 9, status: "Normal",
      trend: "Wednesday numbers hold steady. Top clip generated 180K organic views — brand loves it.",
      optimization: "Replicate high-performing clip format across 5 clippers for next cycle.",
      feedback: "Strong engagement on viral clip. Client team excited — morale boost for clippers." },
  ];

  await prisma.ongoingReport.createMany({
    data: reports.map((r) => ({
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
    })),
  });

  return NextResponse.json({ ok: true, login: "apex@demo.com", password: "apex1234" });
}
