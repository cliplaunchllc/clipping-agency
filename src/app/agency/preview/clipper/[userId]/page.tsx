import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClipperDashboard from "@/components/clipper/ClipperDashboard";

export default async function PreviewClipperPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId, role: "clipper" },
    include: {
      client: true,
      clipperProfile: {
        include: { subAccounts: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!user || !user.clientId) redirect("/agency");

  const clientId = user.clientId;

  const [clips, allClipperUsers] = await Promise.all([
    prisma.clip.findMany({
      where: { clientId, clipper: { userId } },
      include: { subAccount: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "clipper", clientId, status: "active" },
      include: {
        clipperProfile: {
          include: {
            clips: { where: { clientId }, select: { views: true } },
          },
        },
      },
    }),
  ]);

  const serializedSubs = (user.clipperProfile?.subAccounts ?? []).map((s) => ({
    id: s.id,
    platform: s.platform,
    handle: s.handle,
    profileUrl: s.profileUrl,
  }));

  const serializedClips = clips.map((c) => ({
    id: c.id,
    url: c.url,
    views: Number(c.views),
    likes: Number(c.likes),
    comments: Number(c.comments),
    shares: Number(c.shares),
    saves: Number(c.saves),
    submittedAt: c.submittedAt.toISOString(),
    subAccount: { platform: c.subAccount.platform, handle: c.subAccount.handle },
  }));

  const leaderboard = allClipperUsers
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      totalViews: u.clipperProfile?.clips.reduce((acc, cl) => acc + Number(cl.views), 0) ?? 0,
    }))
    .sort((a, b) => b.totalViews - a.totalViews);

  return (
    <ClipperDashboard
      userName={user.name ?? user.email}
      clientName={user.client?.name ?? "Campaign"}
      subAccounts={serializedSubs}
      clips={serializedClips}
      leaderboard={leaderboard}
      previewMode
    />
  );
}
