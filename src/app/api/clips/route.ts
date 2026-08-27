import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchStatsForClip, fetchThumbnailUrl } from "@/lib/statsService";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, clientId, id: userId } = session.user;

  if (role === "agency") {
    const clips = await prisma.clip.findMany({
      include: {
        clipper: { include: { user: true } },
        client: true,
        subAccount: true,
      },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json(clips.map(serialize));
  }

  if ((role === "clipper" || role === "client") && clientId) {
    const where = role === "clipper"
      ? { clientId, clipper: { userId } }
      : { clientId };

    const clips = await prisma.clip.findMany({
      where,
      include: {
        clipper: { include: { user: true } },
        subAccount: true,
        client: true,
      },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json(clips.map(serialize));
  }

  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "clipper") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, subAccountId, title, clientId: bodyClientId } = await req.json();
  if (!url || !subAccountId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const userId = session.user.id;
  const sessionClientId = session.user.clientId;

  const profile = await prisma.clipperProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "No clipper profile" }, { status: 404 });

  // Determine clientId: use body value if provided and valid, else fall back to session
  let clientId = sessionClientId;
  if (bodyClientId && bodyClientId !== sessionClientId) {
    // Validate the clipper has actually worked for this client
    const hasClips = await prisma.clip.findFirst({ where: { clipperId: profile.id, clientId: bodyClientId } });
    if (hasClips) clientId = bodyClientId;
  }
  if (!clientId) return NextResponse.json({ error: "Not assigned to a client" }, { status: 403 });

  // Verify subAccount belongs to this clipper
  const sub = await prisma.clipperSubAccount.findFirst({ where: { id: subAccountId, clipperId: profile.id } });
  if (!sub) return NextResponse.json({ error: "Invalid subaccount" }, { status: 403 });

  const clip = await prisma.clip.create({
    data: {
      clipperId: profile.id,
      clientId,
      subAccountId,
      url,
      title: title ?? null,
    },
    include: { subAccount: true, client: true },
  });

  // fire-and-forget — don't await, don't block the response
  fetchStatsForClip(clip.id, url, sub.platform).catch(() => {});

  return NextResponse.json(serialize(clip), { status: 201 });
}

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
    title: clip.title ?? null,
    thumbnailUrl: clip.thumbnailUrl ?? null,
    lastScraped: clip.lastScraped?.toISOString?.() ?? null,
  };
}
