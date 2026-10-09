import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import CampaignReporting from "@/components/agency/CampaignReporting";

export const dynamic = "force-dynamic";

export default async function CampaignReportingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, reports, ongoingReports] = await Promise.all([
    prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, name: true, logoUrl: true, campaigns: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.campaignReport.findMany({
      include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
      orderBy: [{ clientId: "asc" }, { weekEndDate: "desc" }],
    }),
    prisma.ongoingReport.findMany({
      include: { client: { select: { id: true, name: true, logoUrl: true } }, campaign: { select: { id: true, name: true, totalBudget: true } } },
      orderBy: [{ clientId: "asc" }, { date: "desc" }],
    }),
  ]);

  const serializedReports = reports.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    client: r.client,
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
    campaignId: r.campaignId ?? null,
    amountSpent: r.amountSpent ?? null,
    campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name, totalBudget: r.campaign.totalBudget } : null,
    published: r.published,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const serializedOngoing = ongoingReports.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    client: r.client,
    date: r.date.toISOString(),
    campaignName: r.campaignName,
    totalSubmissions: r.totalSubmissions,
    pending: r.pending,
    approved: r.approved,
    rejected: r.rejected,
    mainTrend: r.mainTrend,
    clipperFeedback: r.clipperFeedback,
    mainOptimization: r.mainOptimization,
    status: r.status as "Strong" | "Normal" | "NeedsAttention",
    viewsTotal: r.viewsTotal,
    viewsToday: r.viewsToday,
    campaignId: r.campaignId ?? null,
    amountSpent: r.amountSpent ?? null,
    campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name, totalBudget: r.campaign.totalBudget } : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-56">
        <CampaignReporting
          clients={clients.map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl ?? null, campaigns: c.campaigns.map((cp) => ({ id: cp.id, name: cp.name, totalBudget: cp.totalBudget })) }))}
          initialReports={serializedReports}
          initialOngoingReports={serializedOngoing}
        />
      </main>
    </div>
  );
}
