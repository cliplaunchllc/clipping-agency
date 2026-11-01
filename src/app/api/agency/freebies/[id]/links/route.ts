import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: freebieId } = await params;
  const { label, url } = await req.json();
  const count = await prisma.freebieLink.count({ where: { freebieId } });
  const link = await prisma.freebieLink.create({ data: { freebieId, label, url, order: count } });
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId required" }, { status: 400 });
  await prisma.freebieLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, label, url } = await req.json();
  const link = await prisma.freebieLink.update({
    where: { id },
    data: { ...(label !== undefined && { label }), ...(url !== undefined && { url }) },
  });
  return NextResponse.json(link);
}
