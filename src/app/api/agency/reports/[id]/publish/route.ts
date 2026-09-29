import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.campaignReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nowPublished = !existing.published;
  const report = await prisma.campaignReport.update({
    where: { id },
    data: {
      published: nowPublished,
      publishedAt: nowPublished ? new Date() : null,
    },
  });

  return NextResponse.json({
    ...report,
    weekStartDate: report.weekStartDate.toISOString(),
    weekEndDate: report.weekEndDate.toISOString(),
    publishedAt: report.publishedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  });
}
