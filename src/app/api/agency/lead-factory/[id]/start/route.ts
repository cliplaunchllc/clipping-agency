import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.leadRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["pending", "stopped", "failed"].includes(run.status))
    return NextResponse.json({ error: "Run is already active" }, { status: 409 });

  // Queue the run — the background worker picks it up
  await prisma.leadRun.update({
    where: { id },
    data: { status: "queued", stage: "Waiting for worker…", totalCost: 0 },
  });

  return NextResponse.json({ started: true });
}
