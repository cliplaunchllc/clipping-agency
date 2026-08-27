import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgencyDashboard from "@/components/agency/AgencyDashboard";

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clippers, clips, pendingClientUsers] = await Promise.all([
    prisma.client.findMany({
      include: {
        users: { where: { role: "clipper" }, select: { id: true } },
        _count: { select: { clips: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "clipper" },
      include: {
        client: true,
        clipperProfile: {
          include: {
            _count: { select: { clips: true } },
            subAccounts: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    }),
    prisma.clip.findMany({
      include: {
        clipper: { include: { user: true } },
        client: true,
        subAccount: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "client", status: "pending" },
      select: { id: true, name: true, email: true, status: true, clientId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalViews = clips.reduce((acc, c) => acc + Number(c.views), 0);

  const serializedClips = clips.map((c) => ({
    id: c.id,
    url: c.url,
    platform: c.subAccount.platform,
    views: Number(c.views),
    likes: Number(c.likes),
    comments: Number(c.comments),
    shares: Number(c.shares),
    saves: Number(c.saves),
    submittedAt: c.submittedAt.toISOString(),
    clientId: c.clientId,
    client: { name: c.client.name },
    clipper: { name: c.clipper.user.name ?? c.clipper.user.email },
    subAccount: { platform: c.subAccount.platform, handle: c.subAccount.handle },
  }));

  // Full shape for ClientManagement
  const serializedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: { clips: c._count.clips },
    users: c.users,
  }));

  // Full shape for ClipperManagement
  const serializedClippers = clippers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    clientId: c.clientId ?? null,
    client: c.client
      ? { id: c.client.id, name: c.client.name, status: c.client.status }
      : null,
    clipperProfile: c.clipperProfile
      ? {
          _count: { clips: c.clipperProfile._count.clips },
          subAccounts: c.clipperProfile.subAccounts.map((s) => ({
            id: s.id, platform: s.platform, handle: s.handle, profileUrl: s.profileUrl ?? null,
          })),
        }
      : null,
  }));

  // Simplified client list for ClipperManagement's allClients prop
  const allClientsList = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
  }));

  return (
    <AgencyDashboard
      userName={session.user.name ?? "Agency"}
      clients={serializedClients}
      clippers={serializedClippers}
      allClients={allClientsList}
      clips={serializedClips}
      totalViews={totalViews}
      pendingClientUsers={pendingClientUsers}
    />
  );
}
