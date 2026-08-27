import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClipperManagement from "@/components/agency/ClipperManagement";

export default async function AgencyClippersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clippers, clients] = await Promise.all([
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
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const serializedClippers = clippers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    clientId: c.clientId,
    client: c.client ? { id: c.client.id, name: c.client.name, status: c.client.status } : null,
    clipperProfile: c.clipperProfile
      ? {
          _count: c.clipperProfile._count,
          subAccounts: c.clipperProfile.subAccounts.map((s) => ({
            id: s.id, platform: s.platform, handle: s.handle, profileUrl: s.profileUrl ?? null,
          })),
        }
      : null,
  }));

  const serializedClients = clients.map((c) => ({ id: c.id, name: c.name, status: c.status }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <ClipperManagement initialClippers={serializedClippers} allClients={serializedClients} />
        </div>
      </main>
    </div>
  );
}
