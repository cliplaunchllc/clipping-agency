import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { displayName } = await req.json();
  if (!displayName?.trim()) return NextResponse.json({ error: "Display name required" }, { status: 400 });
  const clipper = await prisma.clipper.update({
    where: { userId: session.user.id },
    data: { displayName: displayName.trim() },
  });
  return NextResponse.json(clipper);
}
