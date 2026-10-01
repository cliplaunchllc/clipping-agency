import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgencyDashboard from "@/components/agency/AgencyDashboard";

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clips, pendingClientUsers] = await Promise.all([
    prisma.client.findMany({
      include: {
        _count: { select: { clips: true } },
      },
      orderBy: { createdAt: "desc" },
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

  const serializedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: { clips: c._count.clips },
  }));

  const allClientsList = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    dealLengthDays: c.dealLengthDays ?? null,
    dealStartDate: c.dealStartDate?.toISOString() ?? null,
    dealEndDate: c.dealEndDate?.toISOString() ?? null,
  }));

  return (
    <AgencyDashboard
      userName={session.user.name ?? "Agency"}
      clients={serializedClients}
      allClients={allClientsList}
      clips={serializedClips}
      totalViews={totalViews}
      pendingClientUsers={pendingClientUsers}
    />
  );
}
