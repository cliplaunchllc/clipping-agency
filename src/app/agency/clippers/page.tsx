import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClipperManagement from "@/components/agency/ClipperManagement";
import Sidebar from "@/components/shared/Sidebar";
import { LayoutDashboard, Users, Scissors, BarChart2, Settings } from "lucide-react";

const navItems = [
  { label: "Overview", href: "/agency", icon: LayoutDashboard },
  { label: "Clients", href: "/agency/clients", icon: Users },
  { label: "Clippers", href: "/agency/clippers", icon: Scissors },
  { label: "Analytics", href: "/agency/analytics", icon: BarChart2 },
  { label: "Settings", href: "/agency/settings", icon: Settings },
];

export default async function AgencyClippersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clippers, clients] = await Promise.all([
    prisma.clipper.findMany({
      include: {
        user: true,
        assignments: { include: { client: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientAccount.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedClippers = clippers.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    createdAt: c.createdAt.toISOString(),
    user: { name: c.user.name, email: c.user.email },
    assignments: c.assignments.map((a) => ({ client: { id: a.client.id, name: a.client.name } })),
    _count: c._count,
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <ClipperManagement
            initialClippers={serializedClippers}
            allClients={clients}
          />
        </div>
      </main>
    </div>
  );
}
