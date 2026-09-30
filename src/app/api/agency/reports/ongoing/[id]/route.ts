import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

function serialize(r: { date: Date; createdAt: Date; updatedAt: Date; [key: string]: unknown }) {
  return {
    ...r,
    date: r.date.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    date, campaignName,
    totalSubmissions, pending, approved, rejected,
    viewsTotal, viewsToday,
    mainTrend, clipperFeedback, mainOptimization, status,
  } = body;

  const report = await prisma.ongoingReport.update({
    where: { id },
    data: {
      ...(date && { date: new Date(date) }),
      ...(campaignName !== undefined && { campaignName: campaignName || "" }),
      ...(totalSubmissions !== undefined && { totalSubmissions }),
      ...(pending !== undefined && { pending }),
      ...(approved !== undefined && { approved }),
      ...(rejected !== undefined && { rejected }),
      ...(viewsTotal !== undefined && { viewsTotal }),
      ...(viewsToday !== undefined && { viewsToday }),
      ...(mainTrend !== undefined && { mainTrend: mainTrend || null }),
      ...(clipperFeedback !== undefined && { clipperFeedback: clipperFeedback || null }),
      ...(mainOptimization !== undefined && { mainOptimization: mainOptimization || null }),
      ...(status && { status }),
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
  });

  return NextResponse.json(serialize(report));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.ongoingReport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
