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
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
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
    paidOut, effectiveCpm, budgetRemaining, clipsSubmitted, clipsApproved,
    weeklySummary, whatsWorking, whatsNotWorking, nextWeekFocus, campaignLink,
  } = body;

  if (!clientId || !weekStartDate || !weekEndDate) {
    return NextResponse.json({ error: "clientId, weekStartDate, and weekEndDate are required" }, { status: 400 });
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
      budgetRemaining: budgetRemaining ?? null,
      clipsSubmitted: clipsSubmitted ?? 0,
      clipsApproved: clipsApproved ?? 0,
      weeklySummary: weeklySummary || null,
      whatsWorking: whatsWorking || null,
      whatsNotWorking: whatsNotWorking || null,
      nextWeekFocus: nextWeekFocus || null,
      campaignLink: campaignLink || null,
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
  });

  return NextResponse.json(serialize(report), { status: 201 });
}
