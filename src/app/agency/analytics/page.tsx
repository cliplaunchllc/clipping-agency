import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import AgencyAnalytics from "@/components/agency/AgencyAnalytics";

export default async function AgencyAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const clips = await prisma.clip.findMany({
    include: {
      clipper: { include: { user: true } },
      client: true,
      subAccount: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  // Reshape into the format AgencyAnalytics expects
  const serialized = clips.map((c) => ({
    id: c.id,
    platform: c.subAccount.platform,
    clipUrl: c.url,
    submittedAt: c.submittedAt.toISOString(),
    subAccount: { client: { name: c.client.name } },
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
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <AgencyAnalytics submissions={serialized} />
      </main>
    </div>
  );
}
