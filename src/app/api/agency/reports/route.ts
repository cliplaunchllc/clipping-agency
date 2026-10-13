import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

function serialize(r: {
  weekStartDate: Date; weekEndDate: Date; publishedAt: Date | null;
  createdAt: Date; updatedAt: Date; [key: string]: unknown;
}) {
  return {
    ...r,
    weekStartDate: r.weekStartDate.toISOString(),
    weekEndDate: r.weekEndDate.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.campaignReport.findMany({
    include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
    orderBy: [{ clientId: "asc" }, { weekEndDate: "desc" }],
  });

  return NextResponse.json(reports.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    clientId, weekStartDate, weekEndDate,
    totalViews, tiktokViews, instagramViews, youtubeViews, twitterViews,
    paidOut, effectiveCpm, clipsSubmitted, clipsApproved,
    cumViews, cumTiktokViews, cumInstagramViews, cumYoutubeViews, cumTwitterViews,
    cumPaidOut, cumClipsSubmitted, cumClipsApproved,
    weeklySummary, whatsWorking, whatsNotWorking, nextWeekFocus, campaignLink,
    campaignId, amountSpent,
  } = body;

  if (!clientId || !weekStartDate || !weekEndDate) {
    return NextResponse.json({ error: "clientId, weekStartDate, and weekEndDate are required" }, { status: 400 });
  }

  // Auto-calculate budget remaining from campaign budget - (cumViews / 1000 * CPM)
  let budgetRemainingCalc: number | null = null;
  if (campaignId && effectiveCpm != null) {
    const [campaign, prevSum] = await Promise.all([
      prisma.clientCampaign.findUnique({ where: { id: campaignId }, select: { totalBudget: true } }),
      prisma.campaignReport.aggregate({ where: { clientId }, _sum: { totalViews: true } }),
    ]);
    if (campaign && campaign.totalBudget > 0) {
      const effectiveCumViews = (cumViews ?? 0) > 0
        ? (cumViews ?? 0)
        : (prevSum._sum.totalViews ?? 0) + (totalViews ?? 0);
      budgetRemainingCalc = Math.max(0, campaign.totalBudget - (effectiveCumViews / 1000 * effectiveCpm));
    }
  }

  const report = await prisma.campaignReport.create({
    data: {
      clientId,
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
      totalViews: totalViews ?? 0,
      tiktokViews: tiktokViews ?? 0,
      instagramViews: instagramViews ?? 0,
      youtubeViews: youtubeViews ?? 0,
      twitterViews: twitterViews ?? 0,
      paidOut: paidOut ?? 0,
      effectiveCpm: effectiveCpm ?? null,
      budgetRemaining: budgetRemainingCalc,
      clipsSubmitted: clipsSubmitted ?? 0,
      clipsApproved: clipsApproved ?? 0,
      cumViews: cumViews ?? 0,
      cumTiktokViews: cumTiktokViews ?? 0,
      cumInstagramViews: cumInstagramViews ?? 0,
      cumYoutubeViews: cumYoutubeViews ?? 0,
      cumTwitterViews: cumTwitterViews ?? 0,
      cumPaidOut: cumPaidOut ?? 0,
      cumClipsSubmitted: cumClipsSubmitted ?? 0,
      cumClipsApproved: cumClipsApproved ?? 0,
      weeklySummary: weeklySummary || null,
      whatsWorking: whatsWorking || null,
      whatsNotWorking: whatsNotWorking || null,
      nextWeekFocus: nextWeekFocus || null,
      campaignLink: campaignLink || null,
      campaignId: campaignId || null,
      amountSpent: amountSpent != null ? parseFloat(amountSpent) : null,
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
  });

  return NextResponse.json(serialize(report), { status: 201 });
}
