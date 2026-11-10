import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function requireSecret(req: NextRequest): boolean {
  const secret = process.env.REPORT_SECRET;
  return !!secret && req.headers.get("x-report-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!requireSecret(req))
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
