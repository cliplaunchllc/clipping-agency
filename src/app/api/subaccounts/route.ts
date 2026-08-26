import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "clipper") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.clipperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json([]);

  const subs = await prisma.clipperSubAccount.findMany({
    where: { clipperId: profile.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "clipper") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, handle, profileUrl } = await req.json();
  if (!platform || !handle) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const profile = await prisma.clipperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "No clipper profile" }, { status: 404 });

  const sub = await prisma.clipperSubAccount.create({
    data: { clipperId: profile.id, platform, handle, profileUrl },
  });
  return NextResponse.json(sub, { status: 201 });
}
