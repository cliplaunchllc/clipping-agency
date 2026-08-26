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
        include: { clipperProfile: true },
      },
    },
  });

  if (!client) redirect("/agency");

  const serialized = {
    id: client.id,
    name: client.name,
    status: client.status,
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
    })),
    clippers: client.users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      clipCount: client.clips.filter((c) => c.clipper.userId === u.id).length,
      totalViews: client.clips
        .filter((c) => c.clipper.userId === u.id)
        .reduce((sum, c) => sum + Number(c.views), 0),
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
