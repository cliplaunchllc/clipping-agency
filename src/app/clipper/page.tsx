import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClipperDashboard from "@/components/clipper/ClipperDashboard";

export default async function ClipperPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if (session.user.status === "pending") redirect("/clipper/pending");

  const userId = session.user.id;
  const sessionClientId = session.user.clientId!;

  const profile = await prisma.clipperProfile.findUnique({
    where: { userId },
    include: {
      subAccounts: { orderBy: { createdAt: "asc" } },
      clips: {
        include: { subAccount: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!profile) redirect("/login");

  // All distinct clientIds this clipper has clips for, plus their session clientId
  const clipClientIds = [...new Set(profile.clips.map((c) => c.clientId))];
  if (!clipClientIds.includes(sessionClientId)) clipClientIds.push(sessionClientId);

  // Fetch all those clients
  const clients = await prisma.client.findMany({
    where: { id: { in: clipClientIds } },
  });

  // Check primary client status
  const primaryClient = clients.find((c) => c.id === sessionClientId);
  if (primaryClient?.status === "archived" && clients.filter((c) => c.status === "active").length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05070D" }}>
        <div className="text-center max-w-sm px-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#F5F6FA" }}>Campaign Paused</h1>
          <p className="text-sm" style={{ color: "#8A93A6" }}>
            {primaryClient.name}&apos;s campaign is currently inactive. Contact your agency for more info.
          </p>
        </div>
      </div>
    );
  }

  // Leaderboard per client
  const leaderboardByClient: Record<string, { id: string; name: string; totalViews: number }[]> = {};
  await Promise.all(
    clipClientIds.map(async (cid) => {
      const users = await prisma.user.findMany({
        where: { role: "clipper", clientId: cid, status: "active" },
        include: {
          clipperProfile: {
            include: { clips: { where: { clientId: cid }, select: { views: true } } },
          },
        },
      });
      leaderboardByClient[cid] = users
        .map((u) => ({
          id: u.id,
          name: u.name ?? u.email,
          totalViews: u.clipperProfile?.clips.reduce((acc, cl) => acc + Number(cl.views), 0) ?? 0,
        }))
        .sort((a, b) => b.totalViews - a.totalViews);
    })
  );

  const serializedSubs = profile.subAccounts.map((s) => ({
    id: s.id,
    platform: s.platform,
    handle: s.handle,
    profileUrl: s.profileUrl,
  }));

  const serializedClips = profile.clips.map((c) => ({
    id: c.id,
    url: c.url,
    clientId: c.clientId,
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

  const serializedClients = clients.map((c) => ({ id: c.id, name: c.name, status: c.status }));

  return (
    <ClipperDashboard
      userName={session.user.name ?? "Clipper"}
      clients={serializedClients}
      defaultClientId={sessionClientId}
      subAccounts={serializedSubs}
      clips={serializedClips}
      leaderboardByClient={leaderboardByClient}
    />
  );
}
