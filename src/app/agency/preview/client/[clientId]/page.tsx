import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientDashboard from "@/components/client/ClientDashboard";

export default async function PreviewClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const { clientId } = await params;

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
      users: {
        where: { role: "clipper" },
        include: { clipperProfile: { include: { subAccounts: { orderBy: { createdAt: "asc" } } } } },
      },
      links: { orderBy: { createdAt: "asc" } },
      onboardingSteps: { orderBy: { order: "asc" } },
    },
  });

  if (!client) redirect("/agency");

  const serialized = {
    id: client.id,
    name: client.name,
    status: client.status,
    logoUrl: client.logoUrl ?? null,
    dealLengthDays: client.dealLengthDays ?? null,
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
    clippers: client.users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      clipCount: client.clips.filter((c) => c.clipper.userId === u.id).length,
      totalViews: client.clips
        .filter((c) => c.clipper.userId === u.id)
        .reduce((sum, c) => sum + Number(c.views), 0),
      subAccounts: (u.clipperProfile?.subAccounts ?? []).map((s) => ({
        id: s.id,
        platform: s.platform,
        handle: s.handle,
        profileUrl: s.profileUrl ?? null,
      })),
    })),
  };

  return (
    <ClientDashboard
      client={serialized}
      userName={client.name}
      previewMode
    />
  );
}
