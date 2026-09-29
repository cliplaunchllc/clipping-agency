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
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
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
    paidOut, effectiveCpm, budgetRemaining, clipsSubmitted, clipsApproved,
    weeklySummary, whatsWorking, whatsNotWorking, nextWeekFocus, campaignLink,
  } = body;

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
      ...(budgetRemaining !== undefined && { budgetRemaining }),
      ...(clipsSubmitted !== undefined && { clipsSubmitted }),
      ...(clipsApproved !== undefined && { clipsApproved }),
      ...(weeklySummary !== undefined && { weeklySummary: weeklySummary || null }),
      ...(whatsWorking !== undefined && { whatsWorking: whatsWorking || null }),
      ...(whatsNotWorking !== undefined && { whatsNotWorking: whatsNotWorking || null }),
      ...(nextWeekFocus !== undefined && { nextWeekFocus: nextWeekFocus || null }),
      ...(campaignLink !== undefined && { campaignLink: campaignLink || null }),
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
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
