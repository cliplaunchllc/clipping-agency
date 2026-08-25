import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientDashboard from "@/components/client/ClientDashboard";

export default async function ClientPage() {
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
          clipper: { include: { user: true } },
        },
      },
      onboarding: { orderBy: { order: "asc" } },
      assignments: {
        include: { clipper: { include: { user: true } } },
      },
    },
  });

  if (!clientAccount) redirect("/login");

  const allSubmissions = clientAccount.subAccounts.flatMap((sa) => sa.submissions);

  const serialized = {
    ...clientAccount,
    subAccounts: clientAccount.subAccounts.map((sa) => ({
      ...sa,
      submissions: sa.submissions.map((s) => ({
        ...s,
        snapshots: s.snapshots.map((snap) => ({
          ...snap,
          views: Number(snap.views),
          likes: Number(snap.likes),
          comments: Number(snap.comments),
          shares: Number(snap.shares),
          saves: Number(snap.saves),
        })),
      })),
    })),
  };

  return (
    <ClientDashboard
      client={serialized}
      userName={session.user.name ?? "Client"}
    />
  );
}
