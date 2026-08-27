import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "agency") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.action === "archive") {
    const client = await prisma.client.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
    });
    return NextResponse.json(client);
  }
  if (body.action === "unarchive") {
    const client = await prisma.client.update({
      where: { id },
      data: { status: "active", archivedAt: null },
    });
    return NextResponse.json(client);
  }

  // General update: name, deal terms
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.dealLengthDays !== undefined) data.dealLengthDays = body.dealLengthDays === "" ? null : Number(body.dealLengthDays);
  if (body.pageCount !== undefined) data.pageCount = body.pageCount === "" ? null : Number(body.pageCount);
  if (body.clipsPerDay !== undefined) data.clipsPerDay = body.clipsPerDay === "" ? null : Number(body.clipsPerDay);

  const client = await prisma.client.update({ where: { id }, data });
  return NextResponse.json(client);
}
