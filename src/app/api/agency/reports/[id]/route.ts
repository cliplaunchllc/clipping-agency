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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.campaignReport.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serialize(report));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    weekStartDate, weekEndDate,
    totalViews, tiktokViews, instagramViews, youtubeViews, twitterViews,
    paidOut, effectiveCpm, clipsSubmitted, clipsApproved,
    cumViews, cumTiktokViews, cumInstagramViews, cumYoutubeViews, cumTwitterViews,
    cumPaidOut, cumClipsSubmitted, cumClipsApproved, cumEffectiveCpm,
    weeklySummary, whatsWorking, whatsNotWorking, nextWeekFocus, campaignLink,
    campaignId, amountSpent,
  } = body;

  // Fetch existing record to get clientId and fallback values
  const existing = await prisma.campaignReport.findUnique({
    where: { id },
    select: { clientId: true, campaignId: true, effectiveCpm: true, cumEffectiveCpm: true, totalViews: true, cumViews: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-calculate budget remaining
  const resolvedCampaignId = campaignId !== undefined ? (campaignId || null) : existing.campaignId;
  const resolvedCumCpm = cumEffectiveCpm !== undefined ? cumEffectiveCpm : existing.cumEffectiveCpm;
  const resolvedCpm = resolvedCumCpm ?? (effectiveCpm !== undefined ? effectiveCpm : existing.effectiveCpm);

  let budgetRemainingCalc: number | null = null;
  if (resolvedCampaignId && resolvedCpm != null) {
    const [campaign, otherSum] = await Promise.all([
      prisma.clientCampaign.findUnique({ where: { id: resolvedCampaignId }, select: { totalBudget: true } }),
      prisma.campaignReport.aggregate({ where: { clientId: existing.clientId, id: { not: id } }, _sum: { totalViews: true } }),
    ]);
    if (campaign && campaign.totalBudget > 0) {
      const thisWeekViews = totalViews !== undefined ? totalViews : existing.totalViews;
      const resolvedCumViews = cumViews !== undefined ? cumViews : existing.cumViews;
      const effectiveCumViews = resolvedCumViews > 0
        ? resolvedCumViews
        : (otherSum._sum.totalViews ?? 0) + thisWeekViews;
      budgetRemainingCalc = Math.max(0, campaign.totalBudget - (effectiveCumViews / 1000 * resolvedCpm));
    }
  }

  const report = await prisma.campaignReport.update({
    where: { id },
    data: {
      ...(weekStartDate && { weekStartDate: new Date(weekStartDate) }),
      ...(weekEndDate && { weekEndDate: new Date(weekEndDate) }),
      ...(totalViews !== undefined && { totalViews }),
      ...(tiktokViews !== undefined && { tiktokViews }),
      ...(instagramViews !== undefined && { instagramViews }),
      ...(youtubeViews !== undefined && { youtubeViews }),
      ...(twitterViews !== undefined && { twitterViews }),
      ...(paidOut !== undefined && { paidOut }),
      ...(effectiveCpm !== undefined && { effectiveCpm }),
      budgetRemaining: budgetRemainingCalc,
      ...(clipsSubmitted !== undefined && { clipsSubmitted }),
      ...(clipsApproved !== undefined && { clipsApproved }),
      ...(cumViews !== undefined && { cumViews }),
      ...(cumTiktokViews !== undefined && { cumTiktokViews }),
      ...(cumInstagramViews !== undefined && { cumInstagramViews }),
      ...(cumYoutubeViews !== undefined && { cumYoutubeViews }),
      ...(cumTwitterViews !== undefined && { cumTwitterViews }),
      ...(cumPaidOut !== undefined && { cumPaidOut }),
      ...(cumClipsSubmitted !== undefined && { cumClipsSubmitted }),
      ...(cumClipsApproved !== undefined && { cumClipsApproved }),
      ...(cumEffectiveCpm !== undefined && { cumEffectiveCpm: cumEffectiveCpm != null ? parseFloat(cumEffectiveCpm) : null }),
      ...(weeklySummary !== undefined && { weeklySummary: weeklySummary || null }),
      ...(whatsWorking !== undefined && { whatsWorking: whatsWorking || null }),
      ...(whatsNotWorking !== undefined && { whatsNotWorking: whatsNotWorking || null }),
      ...(nextWeekFocus !== undefined && { nextWeekFocus: nextWeekFocus || null }),
      ...(campaignLink !== undefined && { campaignLink: campaignLink || null }),
      ...(campaignId !== undefined && { campaignId: campaignId || null }),
      ...(amountSpent !== undefined && { amountSpent: amountSpent != null ? parseFloat(amountSpent) : null }),
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
  });

  return NextResponse.json(serialize(report));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.campaignReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
