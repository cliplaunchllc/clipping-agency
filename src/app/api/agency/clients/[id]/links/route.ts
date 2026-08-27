import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session) && session?.user?.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const links = await prisma.clientLink.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { label, url } = await req.json();
  if (!label || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const link = await prisma.clientLink.create({ data: { clientId: id, label, url } });
  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params; // consume params
  const { linkId } = await req.json();
  await prisma.clientLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
