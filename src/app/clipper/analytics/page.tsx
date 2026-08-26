import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClipperAnalytics from "@/components/clipper/ClipperAnalytics";

export default async function ClipperAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");

  const profile = await prisma.clipperProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      clips: {
        include: { subAccount: true, client: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!profile) redirect("/login");

  // Reshape clips to the format ClipperAnalytics expects
  const serialized = profile.clips.map((c) => ({
    id: c.id,
    platform: c.subAccount.platform,
    clipUrl: c.url,
    submittedAt: c.submittedAt.toISOString(),
    subAccount: { client: { name: c.client.name } },
    snapshots: [{
      views: Number(c.views),
      likes: Number(c.likes),
      comments: Number(c.comments),
      shares: Number(c.shares),
      saves: Number(c.saves),
    }],
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="clipper" userName={session.user.name ?? "Clipper"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClipperAnalytics submissions={serialized} />
      </main>
    </div>
  );
}
