import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");
  redirect("/agency/onboarding");
}
