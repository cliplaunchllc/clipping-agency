import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = (process.env.REPORT_SECRET ?? "").trim();
  const provided = (req.headers.get("x-report-secret") ?? "").trim();
  if (!secret || provided !== secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      campaigns: {
        select: { id: true, name: true, totalBudget: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ clients });
}
