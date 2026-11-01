import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import FreebiesDashboard from "@/components/agency/FreebiesDashboard";

export const dynamic = "force-dynamic";

export default async function FreebiesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const freebies = await prisma.freebie.findMany({
    where: { type: "freebie" },
    include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const serialized = freebies.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  return <FreebiesDashboard initialFreebies={serialized} type="freebie" baseUrl={baseUrl} />;
}
