import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileSettings from "@/components/shared/ProfileSettings";

export default async function ClipperSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if (session.user.status === "pending") redirect("/clipper/pending");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) redirect("/login");

  return (
    <ProfileSettings
      role="clipper"
      userName={user.name ?? "Clipper"}
      userEmail={user.email}
    />
  );
}
