import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PublicClientAnalytics from "@/components/shared/PublicClientAnalytics";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await prisma.client.findUnique({
    where: { shareToken: token },
    include: {
      clips: {
        include: { subAccount: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  const serialized = {
    name: client.name,
    logoUrl: client.logoUrl ?? null,
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
      submittedAt: c.submittedAt.toISOString(),
      title: c.title ?? null,
      thumbnailUrl: c.thumbnailUrl ?? null,
    })),
  };

  return <PublicClientAnalytics client={serialized} />;
}
