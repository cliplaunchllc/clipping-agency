import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgencyDashboard from "@/components/agency/AgencyDashboard";

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, clips, pendingClientUsers] = await Promise.all([
    prisma.client.findMany({
      include: {
        _count: { select: { clips: true } },
        campaignReports: { orderBy: { weekEndDate: "desc" }, take: 12 },
        ongoingReports: { orderBy: { date: "desc" }, take: 90 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clip.findMany({
      include: {
        clipper: { include: { user: true } },
        client: true,
        subAccount: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "client", status: "pending" },
      select: { id: true, name: true, email: true, status: true, clientId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalViews = clips.reduce((acc, c) => acc + Number(c.views), 0);

  const serializedClips = clips.map((c) => ({
    id: c.id,
    url: c.url,
    platform: c.subAccount.platform,
    views: Number(c.views),
    likes: Number(c.likes),
    comments: Number(c.comments),
    shares: Number(c.shares),
    saves: Number(c.saves),
    submittedAt: c.submittedAt.toISOString(),
    clientId: c.clientId,
    client: { name: c.client.name },
    clipper: { name: c.clipper.user.name ?? c.clipper.user.email },
    subAccount: { platform: c.subAccount.platform, handle: c.subAccount.handle },
  }));

  const serializedClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    _count: { clips: c._count.clips },
  }));

  const allClientsList = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logoUrl: c.logoUrl ?? null,
    dealLengthDays: c.dealLengthDays ?? null,
    dealStartDate: c.dealStartDate?.toISOString() ?? null,
    dealEndDate: c.dealEndDate?.toISOString() ?? null,
    campaignTrackerUrl: c.campaignTrackerUrl ?? null,
    campaignReports: c.campaignReports.map((r) => ({
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
    ongoingReports: c.ongoingReports.map((r) => ({
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
  }));

  return (
    <AgencyDashboard
      userName={session.user.name ?? "Agency"}
      clients={serializedClients}
      allClients={allClientsList}
      clips={serializedClips}
      totalViews={totalViews}
      pendingClientUsers={pendingClientUsers}
    />
  );
}
