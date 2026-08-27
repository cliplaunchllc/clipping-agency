import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchStatsForClip, fetchThumbnailUrl } from "@/lib/statsService";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(clip: any) {
  return {
    ...clip,
    views: Number(clip.views),
    likes: Number(clip.likes),
    comments: Number(clip.comments),
    shares: Number(clip.shares),
    saves: Number(clip.saves),
    submittedAt: clip.submittedAt?.toISOString?.() ?? clip.submittedAt,
    lastScraped: clip.lastScraped?.toISOString?.() ?? null,
    title: clip.title ?? null,
    thumbnailUrl: clip.thumbnailUrl ?? null,
  };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const clip = await prisma.clip.findUnique({ where: { id } });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, id: userId } = session.user;

  if (role === "clipper") {
    const profile = await prisma.clipperProfile.findUnique({ where: { userId } });
    if (!profile || clip.clipperId !== profile.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (role !== "agency") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.clip.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const clip = await prisma.clip.findUnique({
    where: { id },
    include: { subAccount: true },
  });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, id: userId } = session.user;

  if (role === "clipper") {
    const profile = await prisma.clipperProfile.findUnique({ where: { userId } });
    if (!profile || clip.clipperId !== profile.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (role === "client") {
    const clientId = (session.user as { clientId?: string | null }).clientId;
    if (!clientId || clip.clientId !== clientId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (role !== "agency") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await fetchStatsForClip(clip.id, clip.url, clip.subAccount.platform);

  const thumbnailUrl = await fetchThumbnailUrl(clip.url, clip.subAccount.platform);
  if (thumbnailUrl) {
    await prisma.clip.update({ where: { id }, data: { thumbnailUrl } });
  }

  const updated = await prisma.clip.findUnique({ where: { id } });
  return NextResponse.json(serialize(updated));
}
