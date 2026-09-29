import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublicClientReports from "@/components/shared/PublicClientReports";

export const dynamic = "force-dynamic";

export default async function ShareReportsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await prisma.client.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      campaignReports: {
        where: { published: true },
        orderBy: { weekEndDate: "desc" },
      },
    },
  });

  if (!client) notFound();

  const reports = client.campaignReports.map((r) => ({
    id: r.id,
    weekStartDate: r.weekStartDate.toISOString(),
    weekEndDate: r.weekEndDate.toISOString(),
    totalViews: r.totalViews,
    tiktokViews: r.tiktokViews,
    instagramViews: r.instagramViews,
    youtubeViews: r.youtubeViews,
    twitterViews: r.twitterViews,
    paidOut: r.paidOut,
    effectiveCpm: r.effectiveCpm,
    budgetRemaining: r.budgetRemaining,
    clipsSubmitted: r.clipsSubmitted,
    clipsApproved: r.clipsApproved,
    weeklySummary: r.weeklySummary,
    whatsWorking: r.whatsWorking,
    whatsNotWorking: r.whatsNotWorking,
    nextWeekFocus: r.nextWeekFocus,
    campaignLink: r.campaignLink ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
  }));

  return (
    <PublicClientReports
      clientName={client.name}
      logoUrl={client.logoUrl ?? null}
      reports={reports}
    />
  );
}
