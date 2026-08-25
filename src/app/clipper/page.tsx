import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClipperDashboard from "@/components/clipper/ClipperDashboard";

export default async function ClipperPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");

  const clipper = await prisma.clipper.findUnique({
    where: { userId: session.user.id },
    include: {
      assignments: {
        include: {
          client: {
            include: { subAccounts: true },
          },
        },
      },
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

  const serializedSubmissions = clipper.submissions.map((s) => ({
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

  return (
    <ClipperDashboard
      clipper={{ ...clipper, submissions: serializedSubmissions }}
      userName={session.user.name ?? "Clipper"}
    />
  );
}
