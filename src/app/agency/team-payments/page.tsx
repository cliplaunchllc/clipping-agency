import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TeamPayments from "@/components/agency/TeamPayments";

export const dynamic = "force-dynamic";

export default async function TeamPaymentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const members = await prisma.teamPaymentMember.findMany({
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  return (
    <TeamPayments
      initialMembers={members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        category: m.category,
        payRate: m.payRate,
        payFrequency: m.payFrequency,
        lastPaidAt: m.lastPaidAt?.toISOString() ?? null,
        nextPaymentDue: m.nextPaymentDue?.toISOString() ?? null,
        notes: m.notes,
        basePay: m.basePay ?? null,
        commissions: Array.isArray(m.commissions) ? m.commissions as unknown as import("@/components/agency/TeamPayments").CommissionEntry[] : null,
      }))}
    />
  );
}
