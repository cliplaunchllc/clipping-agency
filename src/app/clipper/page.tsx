import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClipperPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  redirect("/clipper/sops");
}
