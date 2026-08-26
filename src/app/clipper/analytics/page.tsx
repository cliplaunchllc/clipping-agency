import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClipperAnalytics from "@/components/clipper/ClipperAnalytics";

export default async function ClipperAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");

  const clipper = await prisma.clipper.findUnique({
    where: { userId: session.user.id },
    include: {
      submissions: {
        include: {
          subAccount: { include: { client: true } },
          snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!clipper) redirect("/login");

  const serialized = clipper.submissions.map((s) => ({
    id: s.id,
    platform: s.platform,
    clipUrl: s.clipUrl,
    submittedAt: s.submittedAt.toISOString(),
    subAccount: { client: { name: s.subAccount.client.name } },
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
      <Sidebar role="clipper" userName={session.user.name ?? "Clipper"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClipperAnalytics submissions={serialized} />
      </main>
    </div>
  );
}
