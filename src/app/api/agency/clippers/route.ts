import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clippers = await prisma.user.findMany({
    where: { role: "clipper" },
    include: {
      client: true,
      clipperProfile: { include: { _count: { select: { clips: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(clippers);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clipperId, clientId } = await req.json();
  if (!clipperId) return NextResponse.json({ error: "Missing clipperId" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: clipperId },
    data: {
      clientId: clientId || null,
      status: clientId ? "active" : "pending",
    },
  });
  return NextResponse.json(updated);
}
