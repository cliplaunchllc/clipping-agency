import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const freebie = await prisma.freebie.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.headerImageUrl !== undefined && { headerImageUrl: body.headerImageUrl || null }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.category !== undefined && { category: body.category || null }),
      ...(body.order !== undefined && { order: body.order }),
    },
    include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(freebie);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.freebie.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
