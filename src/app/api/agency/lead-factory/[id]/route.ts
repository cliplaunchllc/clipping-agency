import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET — poll run status/progress
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.leadRun.findUnique({
    where: { id },
    include: { _count: { select: { leads: true } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...run, leadCount: run._count.leads });
}

// DELETE — delete run and all its leads
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.leadRun.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// PATCH — update lead status OR stop run
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Stop a running run
  if (body.action === "stop") {
    const run = await prisma.leadRun.update({
      where: { id },
      data: { status: "stopped", stage: "Stopped by user" },
      include: { _count: { select: { leads: true } } },
    });
    return NextResponse.json({ ...run, leadCount: run._count.leads });
  }

  // Update individual lead status (active / do_not_contact)
  if (body.leadId !== undefined) {
    const lead = await prisma.leadFactoryLead.update({
      where: { id: body.leadId },
      data: { status: body.status ?? "active" },
    });
    return NextResponse.json(lead);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
