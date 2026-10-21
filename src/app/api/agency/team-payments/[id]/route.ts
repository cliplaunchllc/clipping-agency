import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.role !== undefined) data.role = body.role || null;
  if (body.payRate !== undefined) data.payRate = body.payRate != null ? parseFloat(body.payRate) : null;
  if (body.payFrequency !== undefined) data.payFrequency = body.payFrequency || null;
  if (body.lastPaidAt !== undefined) data.lastPaidAt = body.lastPaidAt ? new Date(body.lastPaidAt) : null;
  if (body.nextPaymentDue !== undefined) data.nextPaymentDue = body.nextPaymentDue ? new Date(body.nextPaymentDue) : null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.basePay !== undefined) data.basePay = body.basePay != null ? parseFloat(body.basePay) : null;
  if (body.commissions !== undefined) data.commissions = body.commissions ?? null;
  const member = await prisma.teamPaymentMember.update({ where: { id }, data });
  return NextResponse.json(member);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.teamPaymentMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
