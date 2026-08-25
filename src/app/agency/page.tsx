import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgencyDashboard from "@/components/agency/AgencyDashboard";

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clippers, submissions] = await Promise.all([
    prisma.clientAccount.findMany({
      include: {
        assignments: { include: { clipper: { include: { user: true } } } },
        subAccounts: true,
        onboarding: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clipper.findMany({
      include: {
        user: true,
        assignments: { include: { client: true } },
        submissions: {
          include: { snapshots: { orderBy: { timestamp: "desc" }, take: 1 } },
        },
      },
    }),
    prisma.submission.findMany({
      include: {
        subAccount: { include: { client: true } },
        clipper: { include: { user: true } },
        snapshots: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { submittedAt: "desc" },
      take: 20,
    }),
  ]);

  // Serialize BigInt fields
  const serializedSubmissions = submissions.map((s) => ({
    ...s,
    snapshots: s.snapshots.map((snap) => ({
      ...snap,
      views: Number(snap.views),
      likes: Number(snap.likes),
      comments: Number(snap.comments),
      shares: Number(snap.shares),
      saves: Number(snap.saves),
    })),
  }));

  const totalViews = serializedSubmissions.reduce(
    (acc, s) => acc + (s.snapshots[0]?.views ?? 0),
    0
  );

  return (
    <AgencyDashboard
      clients={clients}
      clippers={clippers}
      submissions={serializedSubmissions}
      totalViews={totalViews}
      userName={session.user.name ?? "Agency Admin"}
    />
  );
}
