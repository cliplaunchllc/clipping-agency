import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/shared/Sidebar";
import AgencySettings from "@/components/agency/AgencySettings";

export default async function AgencySettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  // Ensure the current user (the admin visiting settings) is never a team member
  await prisma.user.update({
    where: { id: session.user.id },
    data: { isTeamMember: false },
  });

  // Auto-migrate: all other agency users should be team members
  await prisma.user.updateMany({
    where: { role: "agency", id: { not: session.user.id }, isTeamMember: false },
    data: { isTeamMember: true },
  });

  const [currentUser, teamMembers, inviteCodeSetting] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, isTeamMember: true } }),
    prisma.user.findMany({
      where: { role: "agency" },
      select: { id: true, name: true, email: true, mustChangePassword: true, isTeamMember: true, teamRole: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.siteSetting.findUnique({ where: { key: "admin_invite_code" } }),
  ]);

  // Use the fresh DB value — the JWT may be stale
  const dbIsTeamMember = currentUser?.isTeamMember ?? false;
  const sessionIsTeamMember = (session.user as { isTeamMember?: boolean }).isTeamMember ?? false;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} isTeamMember={dbIsTeamMember} />
      <main className="flex-1 overflow-y-auto ml-56">
        <AgencySettings
          userName={currentUser?.name ?? session.user.name ?? ""}
          email={currentUser?.email ?? session.user.email ?? ""}
          currentUserId={session.user.id}
          mustChangePassword={session.user.mustChangePassword ?? false}
          isTeamMember={dbIsTeamMember}
          needsSessionRefresh={sessionIsTeamMember !== dbIsTeamMember}
          initialInviteCode={inviteCodeSetting?.value ?? null}
          initialTeam={teamMembers.map((m) => ({
            ...m,
            teamRole: m.teamRole ?? null,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </main>
    </div>
  );
}
