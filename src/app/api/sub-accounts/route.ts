import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { clientId, platform, handle, profileUrl } = body;
  if (!clientId || !platform || !handle || !profileUrl) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const clipper = await prisma.clipper.findUnique({ where: { userId: session.user.id } });
  if (!clipper) return NextResponse.json({ error: "Clipper not found" }, { status: 404 });
  const subAccount = await prisma.subAccount.create({
    data: { clientId, clipperId: clipper.id, platform, handle, profileUrl },
  });
  return NextResponse.json(subAccount, { status: 201 });
}
