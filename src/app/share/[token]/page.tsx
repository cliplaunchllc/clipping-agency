import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublicClientAnalytics from "@/components/shared/PublicClientAnalytics";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await prisma.client.findUnique({
    where: { shareToken: token },
    include: {
      campaigns: {
        orderBy: { order: "asc" },
        include: {
          stats: true,
          snapshots: {
            orderBy: { date: "asc" },
            take: 365,
          },
        },
      },
    },
  });

  if (!client) notFound();

  type TopClip = { url?: string; creator?: string; platform?: string; views?: number; analysis?: string; [k: string]: unknown };

  const serialized = {
    name: client.name,
    logoUrl: client.logoUrl ?? null,
    campaigns: client.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      stats: c.stats ? {
        viewsTotal: c.stats.viewsTotal,
        viewsToday: c.stats.viewsToday,
        totalSubmissions: c.stats.totalSubmissions,
        approved: c.stats.approved,
        rejected: c.stats.rejected,
        amountSpent: c.stats.amountSpent ?? null,
        effectiveCpm: c.stats.effectiveCpm ?? null,
        totalBudget: c.stats.totalBudget ?? null,
        budgetRemaining: c.stats.budgetRemaining ?? null,
        tiktokViews: c.stats.tiktokViews,
        instagramViews: c.stats.instagramViews,
        youtubeViews: c.stats.youtubeViews,
        topClips: (c.stats.topClips as TopClip[] | null) ?? null,
        updatedAt: c.stats.updatedAt.toISOString(),
      } : null,
      snapshots: c.snapshots.map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        viewsTotal: s.viewsTotal,
        viewsToday: s.viewsToday,
        totalSubmissions: s.totalSubmissions,
        approved: s.approved,
        amountSpent: s.amountSpent ?? null,
        effectiveCpm: s.effectiveCpm ?? null,
        tiktokViews: s.tiktokViews,
        instagramViews: s.instagramViews,
        youtubeViews: s.youtubeViews,
      })),
    })),
  };

  return <PublicClientAnalytics client={serialized} />;
}
