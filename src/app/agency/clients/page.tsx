import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientManagement from "@/components/agency/ClientManagement";

export default async function AgencyClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clipCounts] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        logoUrl: true,
        archivedAt: true,
        createdAt: true,
        users: { where: { role: "clipper" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clip.groupBy({ by: ["clientId"], _count: { id: true } }),
  ]);

  const clipCountMap = new Map(clipCounts.map((r) => [r.clientId, r._count.id]));

  const serialized = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: { clips: clipCountMap.get(c.id) ?? 0 },
    users: c.users,
  }));

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <ClientManagement initialClients={serialized} isTeamMember={(session.user as { isTeamMember?: boolean }).isTeamMember ?? false} />
    </div>
  );
}
