import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ReportingGuide from "@/components/agency/ReportingGuide";

export default async function ReportingGuidePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  return <ReportingGuide />;
}
