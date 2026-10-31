import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadFactory from "@/components/agency/LeadFactory";

export default async function LeadFactoryPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const isTeamMember = (session.user as { isTeamMember?: boolean }).isTeamMember ?? false;
  if (isTeamMember) redirect("/agency");

  const runs = await prisma.leadRun.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <LeadFactory initialRuns={runs.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      offer: r.offer ?? null,
      criteria: r.criteria ?? null,
      count: r.count,
      mode: r.mode,
      status: r.status,
      stage: r.stage ?? null,
      totalCost: r.totalCost,
      testMode: r.testMode,
      stats: r.stats as Record<string, number> | null,
      leadCount: r._count.leads,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))} />
  );
}
