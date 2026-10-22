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

  const { prompt, offer, criteria, count, mode } = await req.json();
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const run = await prisma.leadRun.create({
    data: {
      prompt: prompt.trim(),
      offer: offer?.trim() || null,
      criteria: criteria?.trim() || null,
      count: count || 25,
      mode: mode || "deep",
      status: "pending",
    },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json({ ...run, leadCount: run._count.leads }, { status: 201 });
}
