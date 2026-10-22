import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import CrmDashboard from "@/components/agency/CrmDashboard";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const leads = await prisma.crmLead.findMany({
    orderBy: { createdAt: "asc" },
  });

  const serialized = leads.map((l) => ({
    ...l,
    dateMessaged: l.dateMessaged?.toISOString() ?? null,
    followUp1: l.followUp1?.toISOString() ?? null,
    followUp2: l.followUp2?.toISOString() ?? null,
    followUp3: l.followUp3?.toISOString() ?? null,
    lastFollowUpDate: l.lastFollowUpDate?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar role="agency" userName={session.user.name ?? session.user.email ?? "Agency"} isTeamMember={(session.user as { isTeamMember?: boolean }).isTeamMember ?? false} />
      <main className="ml-56 flex-1 min-h-screen" style={{ background: "var(--bg-base)" }}>
        <CrmDashboard initialLeads={serialized} />
      </main>
    </div>
  );
}
