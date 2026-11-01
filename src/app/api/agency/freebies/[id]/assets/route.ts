import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: freebieId } = await params;
  const { label, url } = await req.json();
  const count = await prisma.freebieAsset.count({ where: { freebieId } });
  const asset = await prisma.freebieAsset.create({ data: { freebieId, label, url, order: count } });
  return NextResponse.json(asset, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assetId = new URL(req.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  await prisma.freebieAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, label, url } = await req.json();
  const asset = await prisma.freebieAsset.update({
    where: { id },
    data: { ...(label !== undefined && { label }), ...(url !== undefined && { url }) },
  });
  return NextResponse.json(asset);
}
