import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const isTeamMember = (session.user as { isTeamMember?: boolean }).isTeamMember ?? false;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar
        role="agency"
        userName={session.user.name ?? session.user.email ?? "Agency"}
        isTeamMember={isTeamMember}
      />
      <main className="flex-1 overflow-y-auto ml-56">
        {children}
      </main>
    </div>
  );
}
