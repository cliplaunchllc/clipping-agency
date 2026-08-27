import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function agencyOnly(session: { user?: { role?: string } | null } | null) {
  return session?.user?.role === "agency";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const steps = await prisma.clientOnboardingStep.findMany({
    where: { clientId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { title, description, linkUrl } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const last = await prisma.clientOnboardingStep.findFirst({
    where: { clientId: id },
    orderBy: { order: "desc" },
  });
  const step = await prisma.clientOnboardingStep.create({
    data: { clientId: id, title, description: description ?? null, linkUrl: linkUrl ?? null, order: (last?.order ?? -1) + 1 },
  });
  return NextResponse.json(step, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { stepId, completed, title, description, linkUrl } = await req.json();

  const isAgency = session.user.role === "agency";
  const isClient = session.user.role === "client" &&
    (session.user as { clientId?: string | null }).clientId === id;

  if (!isAgency && !isClient) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clients can only toggle completed — not edit title/description/linkUrl
  const data: Record<string, unknown> = {};
  if (completed !== undefined) data.completed = completed;
  if (isAgency) {
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (linkUrl !== undefined) data.linkUrl = linkUrl;
  }

  const step = await prisma.clientOnboardingStep.update({ where: { id: stepId }, data });
  return NextResponse.json(step);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!agencyOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;
  const { stepId } = await req.json();
  await prisma.clientOnboardingStep.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
