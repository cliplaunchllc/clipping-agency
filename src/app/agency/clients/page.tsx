import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientManagement from "@/components/agency/ClientManagement";
import Sidebar from "@/components/shared/Sidebar";
import { LayoutDashboard, Users, Scissors, BarChart2, Settings } from "lucide-react";

const navItems = [
  { label: "Overview", href: "/agency", icon: LayoutDashboard },
  { label: "Clients", href: "/agency/clients", icon: Users },
  { label: "Clippers", href: "/agency/clippers", icon: Scissors },
  { label: "Analytics", href: "/agency/analytics", icon: BarChart2 },
  { label: "Settings", href: "/agency/settings", icon: Settings },
];

export default async function AgencyClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clippers] = await Promise.all([
    prisma.clientAccount.findMany({
      include: {
        user: true,
        assignments: { include: { clipper: { include: { user: true } } } },
        subAccounts: true,
        _count: { select: { subAccounts: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clipper.findMany({
      include: {
        user: true,
        assignments: { include: { client: true } },
        _count: { select: { submissions: true } },
      },
    }),
  ]);

  // Serialize dates
  const serializedClients = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: undefined,
    subAccounts: c.subAccounts.map((sa) => ({
      ...sa,
      createdAt: undefined,
    })),
    assignments: c.assignments.map((a) => ({
      ...a,
      createdAt: undefined,
      clipper: {
        ...a.clipper,
        createdAt: undefined,
        user: {
          email: a.clipper.user.email,
          name: a.clipper.user.name,
        },
      },
    })),
  }));

  const serializedClippers = clippers.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    createdAt: c.createdAt.toISOString(),
    user: { name: c.user.name, email: c.user.email },
    assignments: c.assignments.map((a) => ({ client: { id: a.client.id, name: a.client.name } })),
    _count: c._count,
  }));

  const allClients = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} navItems={navItems} />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <ClientManagement
            initialClients={serializedClients as Parameters<typeof ClientManagement>[0]["initialClients"]}
            allClippers={serializedClippers}
          />
        </div>
      </main>
    </div>
  );
}
