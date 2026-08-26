import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "clipper") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const profile = await prisma.clipperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sub = await prisma.clipperSubAccount.findFirst({ where: { id, clipperId: profile.id } });
  if (!sub) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.clipperSubAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
