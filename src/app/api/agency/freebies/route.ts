import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type") ?? "freebie";
  const freebies = await prisma.freebie.findMany({
    where: { type },
    include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(freebies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type } = await req.json();
  const count = await prisma.freebie.count({ where: { type: type ?? "freebie" } });
  const freebie = await prisma.freebie.create({
    data: { name: name ?? "New Lead Magnet", type: type ?? "freebie", order: count },
    include: { links: true, assets: true },
  });
  return NextResponse.json(freebie, { status: 201 });
}
