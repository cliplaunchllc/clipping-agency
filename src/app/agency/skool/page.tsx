import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import SkoolDashboard from "@/components/agency/SkoolDashboard";
import type { SkoolCategory, SkoolAssetItem } from "@/components/agency/SkoolResourcesDashboard";

export const dynamic = "force-dynamic";

function parseCategories(value: string | null): SkoolCategory[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    // Backward-compatible: old format was string[]
    if (typeof parsed[0] === "string") {
      return parsed.map((name: string) => ({ name, description: "" }));
    }
    return parsed as SkoolCategory[];
  } catch {
    return [];
  }
}

export default async function SkoolPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "agency") redirect("/login");

  const [freebies, nameSetting, tokenSetting, categoriesSetting, descSetting] = await Promise.all([
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_categories" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_portal_description" } }),
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

  const initialItems: SkoolAssetItem[] = freebies.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description ?? "",
    category: f.category ?? "",
    url: f.assets[0]?.url ?? "",
    assetId: f.assets[0]?.id ?? null,
    published: f.published,
  }));

  const initialCategories = parseCategories(categoriesSetting?.value ?? null);

  return (
    <SkoolDashboard
      initialItems={initialItems}
      initialCommunityName={nameSetting?.value ?? "Member Resources"}
      initialPortalToken={portalToken}
      initialCategories={initialCategories}
      initialPortalDescription={descSetting?.value ?? ""}
      baseUrl={baseUrl}
    />
  );
}
