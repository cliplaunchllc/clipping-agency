import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "client") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = (session.user as { clientId?: string | null }).clientId;
  if (!clientId) return NextResponse.json({ error: "No client" }, { status: 400 });

  const reports = await prisma.campaignReport.findMany({
    where: { clientId, published: true },
    orderBy: { weekEndDate: "desc" },
  });

  return NextResponse.json(reports.map((r) => ({
    id: r.id,
    weekStartDate: r.weekStartDate.toISOString(),
    weekEndDate: r.weekEndDate.toISOString(),
    totalViews: r.totalViews,
    tiktokViews: r.tiktokViews,
    instagramViews: r.instagramViews,
    youtubeViews: r.youtubeViews,
    twitterViews: r.twitterViews,
    paidOut: r.paidOut,
    effectiveCpm: r.effectiveCpm,
    budgetRemaining: r.budgetRemaining,
    clipsSubmitted: r.clipsSubmitted,
    clipsApproved: r.clipsApproved,
    cumViews: r.cumViews,
    cumTiktokViews: r.cumTiktokViews,
    cumInstagramViews: r.cumInstagramViews,
    cumYoutubeViews: r.cumYoutubeViews,
    cumTwitterViews: r.cumTwitterViews,
    cumPaidOut: r.cumPaidOut,
    cumClipsSubmitted: r.cumClipsSubmitted,
    cumClipsApproved: r.cumClipsApproved,
    cumEffectiveCpm: r.cumEffectiveCpm ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
  })));
}
