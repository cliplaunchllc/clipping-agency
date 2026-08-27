import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import ClipperSubmissions from "@/components/clipper/ClipperSubmissions";

export default async function ClipperSubmissionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");

  const profile = await prisma.clipperProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      clips: {
        include: { subAccount: true, client: true },
        orderBy: { submittedAt: "desc" },
      },
      subAccounts: true,
    },
  });

  if (!profile) redirect("/login");

  const serialized = profile.clips.map((c) => ({
    id: c.id,
    platform: c.subAccount.platform,
    url: c.url,
    submittedAt: c.submittedAt.toISOString(),
    clientName: c.client.name,
    handle: c.subAccount.handle,
    views: Number(c.views),
    likes: Number(c.likes),
    comments: Number(c.comments),
    shares: Number(c.shares),
    saves: Number(c.saves),
    title: c.title ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
  }));

  const subAccounts = profile.subAccounts.map((sa) => ({
    id: sa.id,
    platform: sa.platform,
    handle: sa.handle,
  }));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="clipper" userName={session.user.name ?? "Clipper"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <ClipperSubmissions clips={serialized} subAccounts={subAccounts} />
      </main>
    </div>
  );
}
