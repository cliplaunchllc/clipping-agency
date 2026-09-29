import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import CampaignReporting from "@/components/agency/CampaignReporting";

export default async function CampaignReportingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [clients, reports] = await Promise.all([
    prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaignReport.findMany({
      include: { client: { select: { id: true, name: true, logoUrl: true } } },
      orderBy: [{ clientId: "asc" }, { weekEndDate: "desc" }],
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
    published: r.published,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <CampaignReporting
          clients={clients.map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl ?? null }))}
          initialReports={serializedReports}
        />
      </main>
    </div>
  );
}
