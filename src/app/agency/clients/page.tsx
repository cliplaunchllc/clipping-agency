import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClientManagement from "@/components/agency/ClientManagement";

export default async function AgencyClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const clients = await prisma.client.findMany({
    include: {
      users: { where: { role: "clipper" }, select: { id: true } },
      _count: { select: { clips: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: c._count,
    users: c.users,
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <ClientManagement initialClients={serialized} />
        </div>
      </main>
    </div>
  );
}
