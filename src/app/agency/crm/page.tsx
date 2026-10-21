import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import CrmDashboard from "@/components/agency/CrmDashboard";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  // Load oldest-first so the keep-first dedup retains the original entry
  const allLeads = await prisma.crmLead.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Auto-delete DB duplicates (keep oldest per name, case-insensitive)
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const l of allLeads) {
    const key = l.leadName.trim().toLowerCase();
    if (seen.has(key)) toDelete.push(l.id);
    else seen.add(key);
  }
  if (toDelete.length > 0) {
    await prisma.crmLead.deleteMany({ where: { id: { in: toDelete } } });
  }
  const leads = allLeads.filter((l) => !toDelete.includes(l.id));

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
