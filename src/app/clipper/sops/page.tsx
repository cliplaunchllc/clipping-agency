import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import SopsDashboard from "@/components/shared/SopsDashboard";

export const dynamic = "force-dynamic";

export default async function ClipperSopsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if ((session.user as { status?: string }).status === "pending") redirect("/clipper/pending");

  const sops = await prisma.sop.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="clipper" userName={session.user.name ?? "Team"} />
      <main className="flex-1 overflow-y-auto ml-56">
        <SopsDashboard
          initialSops={sops.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() }))}
          canEdit={false}
        />
      </main>
    </div>
  );
}
