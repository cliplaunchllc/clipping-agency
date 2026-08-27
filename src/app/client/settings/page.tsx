import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileSettings from "@/components/shared/ProfileSettings";

export default async function ClientSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") redirect("/login");
  if (session.user.status === "pending") redirect("/client/pending");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!user) redirect("/login");

  return (
    <ProfileSettings
      role="client"
      userName={user.name ?? "Client"}
      userEmail={user.email}
    />
  );
}
