import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  return <CrmDashboard initialLeads={serialized} />;
}
