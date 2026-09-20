import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import AgencySettings from "@/components/agency/AgencySettings";

export default async function AgencySettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const teamMembers = await prisma.user.findMany({
    where: { role: "agency" },
    select: { id: true, name: true, email: true, mustChangePassword: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <AgencySettings
          userName={session.user.name ?? ""}
          email={session.user.email ?? ""}
          currentUserId={session.user.id}
          mustChangePassword={session.user.mustChangePassword ?? false}
          initialTeam={teamMembers.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
