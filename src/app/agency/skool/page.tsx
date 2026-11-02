import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import SkoolDashboard from "@/components/agency/SkoolDashboard";

export const dynamic = "force-dynamic";

export default async function SkoolPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [freebies, nameSetting, tokenSetting] = await Promise.all([
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } }),
  ]);

  // Auto-create portal token if missing
  let portalToken = tokenSetting?.value;
  if (!portalToken) {
    portalToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await prisma.siteSetting.upsert({
      where: { key: "skool_portal_token" },
      update: { value: portalToken },
      create: { key: "skool_portal_token", value: portalToken },
    });
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const serialized = freebies.map((f) => ({
    ...f,
    category: f.category ?? null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }));

  return (
    <SkoolDashboard
      initialFreebies={serialized}
      initialCommunityName={nameSetting?.value ?? "Member Resources"}
      initialPortalToken={portalToken}
      baseUrl={baseUrl}
    />
  );
}
