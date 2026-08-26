import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClientAnalytics from "@/components/client/ClientAnalytics";

export default async function ClientAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") redirect("/login");

  const clientId = (session.user as { clientId?: string | null }).clientId;
  if (!clientId) redirect("/login");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      clips: {
        include: { subAccount: true, clipper: { include: { user: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!client) redirect("/login");

  // Reshape to match ClientAnalytics component format
  const submissions = client.clips.map((c) => ({
    id: c.id,
    platform: c.subAccount.platform,
    clipUrl: c.url,
    submittedAt: c.submittedAt.toISOString(),
    subAccount: { platform: c.subAccount.platform, handle: c.subAccount.handle },
    clipper: {
      displayName: c.clipper.displayName ?? null,
      user: { name: c.clipper.user.name ?? null },
    },
    snapshots: [{
      views: Number(c.views),
      likes: Number(c.likes),
      comments: Number(c.comments),
      shares: Number(c.shares),
      saves: Number(c.saves),
    }],
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="client" userName={session.user.name ?? "Client"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClientAnalytics submissions={submissions} clientName={client.name} />
      </main>
    </div>
  );
}
