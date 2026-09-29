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

export async function GET() {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.ongoingReport.findMany({
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: [{ clientId: "asc" }, { date: "desc" }],
  });

  return NextResponse.json(reports.map(serialize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    clientId, date, campaignName,
    totalSubmissions, pending, approved, rejected,
    mainTrend, clipperFeedback, mainOptimization, status,
  } = body;

  if (!clientId || !date || !status) {
    return NextResponse.json({ error: "clientId, date, and status are required" }, { status: 400 });
  }

  const report = await prisma.ongoingReport.create({
    data: {
      clientId,
      date: new Date(date),
      campaignName: campaignName || "",
      totalSubmissions: totalSubmissions ?? 0,
      pending: pending ?? 0,
      approved: approved ?? 0,
      rejected: rejected ?? 0,
      mainTrend: mainTrend || null,
      clipperFeedback: clipperFeedback || null,
      mainOptimization: mainOptimization || null,
      status,
    },
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
  });

  return NextResponse.json(serialize(report), { status: 201 });
}
