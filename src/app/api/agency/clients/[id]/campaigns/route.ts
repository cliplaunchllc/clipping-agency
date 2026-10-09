import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaigns = await prisma.clientCampaign.findMany({
    where: { clientId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, totalBudget, order } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const campaign = await prisma.clientCampaign.create({
    data: { clientId: id, name, totalBudget: totalBudget ?? 0, order: order ?? 1 },
  });
  return NextResponse.json(campaign, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { campaignId, name, totalBudget } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (totalBudget !== undefined) data.totalBudget = Number(totalBudget);
  const campaign = await prisma.clientCampaign.update({ where: { id: campaignId, clientId: id }, data });
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  await prisma.clientCampaign.delete({ where: { id: campaignId, clientId: id } });
  return NextResponse.json({ ok: true });
}
