import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clipperId, clientId } = await req.json();
  const assignment = await prisma.clipperClientAssignment.create({ data: { clipperId, clientId } });
  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clipperId, clientId } = await req.json();
  await prisma.clipperClientAssignment.delete({ where: { clipperId_clientId: { clipperId, clientId } } });
  return NextResponse.json({ ok: true });
}
