import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AgencyOnboarding from "@/components/agency/AgencyOnboarding";

export default async function AgencyOnboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  return <AgencyOnboarding />;
}
