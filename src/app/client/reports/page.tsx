import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClientReports from "@/components/client/ClientReports";

export default async function ClientReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") redirect("/login");

  const clientAccount = await prisma.clientAccount.findUnique({
    where: { userId: session.user.id },
    include: {
      subAccounts: {
        include: {
          submissions: {
            include: {
              snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
              clipper: { include: { user: true } },
            },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
      assignments: { include: { clipper: { include: { user: true } } } },
    },
  });

  if (!clientAccount) redirect("/login");

  const submissions = clientAccount.subAccounts.flatMap((sa) =>
    sa.submissions.map((s) => ({
      id: s.id,
      platform: s.platform,
      clipUrl: s.clipUrl,
      submittedAt: s.submittedAt.toISOString(),
      subAccount: { platform: sa.platform, handle: sa.handle },
      clipper: { displayName: s.clipper?.displayName ?? null, user: { name: s.clipper?.user?.name ?? null } },
      snapshots: s.snapshots.map((snap) => ({
        views: Number(snap.views),
        likes: Number(snap.likes),
        comments: Number(snap.comments),
        shares: Number(snap.shares),
        saves: Number(snap.saves),
      })),
    }))
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="client" userName={session.user.name ?? "Client"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClientReports submissions={submissions} clientName={clientAccount.name} />
      </main>
    </div>
  );
}
