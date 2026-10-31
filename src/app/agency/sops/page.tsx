import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SopsDashboard from "@/components/shared/SopsDashboard";

export const dynamic = "force-dynamic";

export default async function AgencySopsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const isTeamMember = (session.user as { isTeamMember?: boolean }).isTeamMember ?? false;
  const teamRole = (session.user as { teamRole?: string | null }).teamRole ?? null;

  const sops = await prisma.sop.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <SopsDashboard
      initialSops={sops.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() }))}
      canEdit={!isTeamMember}
      teamRole={isTeamMember ? teamRole : null}
    />
  );
}
