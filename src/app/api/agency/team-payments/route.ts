import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function GET() {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const members = await prisma.teamPaymentMember.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, role, category, payRate, payFrequency, lastPaidAt, nextPaymentDue, notes, commissions, basePay } = await req.json();
  if (!name || !category) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const member = await prisma.teamPaymentMember.create({
    data: {
      name,
      role: role || null,
      category,
      payRate: payRate != null ? parseFloat(payRate) : null,
      payFrequency: payFrequency || null,
      lastPaidAt: lastPaidAt ? new Date(lastPaidAt) : null,
      nextPaymentDue: nextPaymentDue ? new Date(nextPaymentDue) : null,
      notes: notes || null,
      basePay: basePay != null ? parseFloat(basePay) : null,
      commissions: commissions ?? null,
    },
  });
  return NextResponse.json(member, { status: 201 });
}
