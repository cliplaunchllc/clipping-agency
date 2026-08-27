import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClientDetail from "@/components/agency/ClientDetail";

export default async function AgencyClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      links: { orderBy: { createdAt: "asc" } },
      onboardingSteps: { orderBy: { order: "asc" } },
      users: { where: { role: "clipper" }, select: { id: true, name: true, email: true, status: true } },
      _count: { select: { clips: true } },
    },
  });

  if (!client) redirect("/agency");

  const serialized = {
    id: client.id,
    name: client.name,
    status: client.status,
    dealLengthDays: client.dealLengthDays,
    pageCount: client.pageCount,
    clipsPerDay: client.clipsPerDay,
    archivedAt: client.archivedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    clipCount: client._count.clips,
    links: client.links.map((l) => ({ id: l.id, label: l.label, url: l.url })),
    onboardingSteps: client.onboardingSteps.map((s) => ({
      id: s.id, title: s.title, description: s.description, linkUrl: s.linkUrl ?? null, order: s.order, completed: s.completed,
    })),
    clippers: client.users.map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status })),
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClientDetail client={serialized} />
      </main>
    </div>
  );
}
