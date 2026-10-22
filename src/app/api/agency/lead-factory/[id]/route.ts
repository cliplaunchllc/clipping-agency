import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.leadRun.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Update lead status (active / do_not_contact)
  if (body.leadId !== undefined) {
    const lead = await prisma.leadFactoryLead.update({
      where: { id: body.leadId },
      data: { status: body.status ?? "active" },
    });
    return NextResponse.json(lead);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
