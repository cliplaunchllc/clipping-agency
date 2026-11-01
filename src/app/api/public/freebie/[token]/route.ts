import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const freebie = await prisma.freebie.findUnique({
    where: { shareToken: token },
    include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
  });
  if (!freebie) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(freebie);
}
