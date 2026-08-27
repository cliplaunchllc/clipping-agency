import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClipperDashboard from "@/components/clipper/ClipperDashboard";

export default async function ClipperPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if (session.user.status === "pending") redirect("/clipper/pending");

  const userId = session.user.id;
  const clientId = session.user.clientId!;

  const [profile, clips, client, allClipperUsers] = await Promise.all([
    prisma.clipperProfile.findUnique({
      where: { userId },
      include: { subAccounts: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.clip.findMany({
      where: { clientId, clipper: { userId } },
      include: { subAccount: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.client.findUnique({ where: { id: clientId } }),
    // Leaderboard: all clippers on this client
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

  if (!profile) redirect("/login");
  if (client?.status === "archived") {
    // Show blocked message
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05070D" }}>
        <div className="text-center max-w-sm px-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#F5F6FA" }}>Campaign Paused</h1>
          <p className="text-sm" style={{ color: "#8A93A6" }}>
            {client.name}&apos;s campaign is currently inactive. Contact your agency for more info.
          </p>
        </div>
      </div>
    );
  }

  const serializedSubs = profile.subAccounts.map((s) => ({
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
    lastScraped: c.lastScraped?.toISOString() ?? null,
    title: c.title ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
    subAccount: c.subAccount ? { platform: c.subAccount.platform, handle: c.subAccount.handle } : null,
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
      userName={session.user.name ?? "Clipper"}
      clientName={client?.name ?? "Campaign"}
      subAccounts={serializedSubs}
      clips={serializedClips}
      leaderboard={leaderboard}
    />
  );
}
