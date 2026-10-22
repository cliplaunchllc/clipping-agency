import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { processLeadRun } from "@/lib/lead-factory/pipeline";

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

  // Reset for fresh start
  await prisma.leadRun.update({
    where: { id },
    data: { status: "planning", stage: "Starting…", totalCost: 0 },
  });

  // Fire and forget — returns immediately, pipeline runs in background
  processLeadRun(id).catch(async (err) => {
    await prisma.leadRun
      .update({ where: { id }, data: { status: "failed", stage: String(err).slice(0, 200) } })
      .catch(() => {});
  });

  return NextResponse.json({ started: true });
}
