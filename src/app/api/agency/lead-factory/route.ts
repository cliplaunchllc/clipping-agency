import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await prisma.leadRun.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json(runs.map((r) => ({ ...r, leadCount: r._count.leads })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { criteria, count, mode } = await req.json();

  const run = await prisma.leadRun.create({
    data: {
      prompt: criteria?.trim() || "game studio or app developer",
      criteria: criteria?.trim() || null,
      count: count || 25,
      mode: mode || "bulk",
      status: "pending",
    },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json({ ...run, leadCount: run._count.leads }, { status: 201 });
}
