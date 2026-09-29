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
    ...r,
    weekStartDate: r.weekStartDate.toISOString(),
    weekEndDate: r.weekEndDate.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
}
