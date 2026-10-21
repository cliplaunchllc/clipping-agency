import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";
import ReportingGuide from "@/components/agency/ReportingGuide";

export default async function ReportingGuidePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} isTeamMember={(session.user as { isTeamMember?: boolean }).isTeamMember ?? false} />
      <main className="flex-1 overflow-y-auto ml-56">
        <ReportingGuide />
      </main>
    </div>
  );
}
