import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgencyOnboarding from "@/components/agency/AgencyOnboarding";

export default async function AgencyOnboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true,
      shareToken: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = clients.map((c) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl ?? null,
    shareToken: c.shareToken ?? null,
    status: c.status,
  }));

  return <AgencyOnboarding clients={serialized} />;
}
