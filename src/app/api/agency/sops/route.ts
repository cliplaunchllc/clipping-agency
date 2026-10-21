import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "agency" && role !== "clipper") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sops = await prisma.sop.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(sops);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { title, url, category } = await req.json();
  if (!title || !url || !category) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const maxOrder = await prisma.sop.aggregate({ _max: { order: true }, where: { category } });
  const sop = await prisma.sop.create({
    data: { title, url, category, order: (maxOrder._max.order ?? 0) + 1 },
  });
  return NextResponse.json(sop, { status: 201 });
}
