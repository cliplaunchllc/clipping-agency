import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import AgencyAnalytics from "@/components/agency/AgencyAnalytics";

export default async function AgencyAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const submissions = await prisma.submission.findMany({
    include: {
      subAccount: { include: { client: true } },
      clipper: { include: { user: true } },
      snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { submittedAt: "desc" },
  });

  const serialized = submissions.map((s) => ({
    id: s.id,
    platform: s.platform,
    clipUrl: s.clipUrl,
    submittedAt: s.submittedAt.toISOString(),
    subAccount: { client: { name: s.subAccount.client.name } },
    clipper: { displayName: s.clipper?.displayName ?? null, user: { name: s.clipper?.user?.name ?? null } },
    snapshots: s.snapshots.map((snap) => ({
      views: Number(snap.views),
      likes: Number(snap.likes),
      comments: Number(snap.comments),
      shares: Number(snap.shares),
      saves: Number(snap.saves),
    })),
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <AgencyAnalytics submissions={serialized} />
      </main>
    </div>
  );
}
