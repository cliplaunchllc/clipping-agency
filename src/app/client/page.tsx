import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientDashboard from "@/components/client/ClientDashboard";

export default async function ClientPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") redirect("/login");
  if (session.user.status === "pending") redirect("/client/pending");

  const clientId = (session.user as { clientId?: string | null }).clientId;
  if (!clientId) redirect("/client/pending");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      clips: {
        include: {
          clipper: { include: { user: true } },
          subAccount: true,
        },
        orderBy: { submittedAt: "desc" },
      },
      links: { orderBy: { createdAt: "asc" } },
      onboardingSteps: { orderBy: { order: "asc" } },
      ongoingReports: { orderBy: { date: "desc" } },
      campaignReports: { where: { published: true }, orderBy: { weekEndDate: "desc" } },
    },
  });

  if (!client) redirect("/login");

  const serialized = {
    id: client.id,
    name: client.name,
    status: client.status,
    campaignType: "cpm" as const,
    contractUrl: client.contractUrl ?? null,
    campaignTrackerUrl: client.campaignTrackerUrl ?? null,
    logoUrl: client.logoUrl ?? null,
    dealLengthDays: client.dealLengthDays ?? null,
    dealStartDate: client.dealStartDate?.toISOString() ?? null,
    dealEndDate: client.dealEndDate?.toISOString() ?? null,
    pageCount: client.pageCount ?? null,
    clipsPerDay: client.clipsPerDay ?? null,
    createdAt: client.createdAt.toISOString(),
    links: client.links.map((l) => ({ id: l.id, label: l.label, url: l.url })),
    onboardingSteps: client.onboardingSteps.map((s) => ({
      id: s.id, title: s.title, description: s.description, linkUrl: s.linkUrl ?? null, order: s.order, completed: s.completed,
    })),
    clips: client.clips.map((c) => ({
      id: c.id,
      url: c.url,
      platform: c.subAccount.platform,
      handle: c.subAccount.handle,
      views: Number(c.views),
      likes: Number(c.likes),
      comments: Number(c.comments),
      shares: Number(c.shares),
      saves: Number(c.saves),
      earnings: c.earnings,
      submittedAt: c.submittedAt.toISOString(),
      clipperName: c.clipper.user.name ?? c.clipper.user.email,
      title: c.title ?? null,
      thumbnailUrl: c.thumbnailUrl ?? null,
    })),
    campaignReports: client.campaignReports.map((r) => ({
      id: r.id,
      weekStartDate: r.weekStartDate.toISOString().slice(0, 10),
      weekEndDate: r.weekEndDate.toISOString().slice(0, 10),
      totalViews: r.totalViews,
      tiktokViews: r.tiktokViews,
      instagramViews: r.instagramViews,
      youtubeViews: r.youtubeViews,
      twitterViews: r.twitterViews,
      paidOut: r.paidOut,
      effectiveCpm: r.effectiveCpm ?? null,
      budgetRemaining: r.budgetRemaining ?? null,
      clipsSubmitted: r.clipsSubmitted,
      clipsApproved: r.clipsApproved,
      weeklySummary: r.weeklySummary ?? null,
      whatsWorking: r.whatsWorking ?? null,
      whatsNotWorking: r.whatsNotWorking ?? null,
      nextWeekFocus: r.nextWeekFocus ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    })),
    ongoingReports: client.ongoingReports.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      totalSubmissions: r.totalSubmissions,
      pending: r.pending,
      approved: r.approved,
      rejected: r.rejected,
      mainTrend: r.mainTrend ?? null,
      clipperFeedback: r.clipperFeedback ?? null,
      mainOptimization: r.mainOptimization ?? null,
      status: r.status as string,
      viewsTotal: r.viewsTotal,
      viewsToday: r.viewsToday,
    })),
    clippers: [],
  };

  return (
    <ClientDashboard
      client={serialized as Parameters<typeof ClientDashboard>[0]["client"]}
      userName={session.user.name ?? "Client"}
    />
  );
}
