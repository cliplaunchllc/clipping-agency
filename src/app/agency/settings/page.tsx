import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";
import AgencySettings from "@/components/agency/AgencySettings";

export default async function AgencySettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070D" }}>
      <Sidebar role="agency" userName={session.user.name ?? "Agency"} />
      <main className="flex-1 overflow-y-auto ml-60">
        <AgencySettings userName={session.user.name ?? ""} email={session.user.email ?? ""} />
      </main>
    </div>
  );
}
