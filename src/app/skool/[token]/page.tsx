import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FileBox } from "lucide-react";
import ClipLaunchLogo from "@/components/shared/ClipLaunchLogo";

export const dynamic = "force-dynamic";

interface PortalCategory { name: string; description: string; }

function parseCategories(value: string | null): PortalCategory[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === "string") {
      return parsed.map((name: string) => ({ name, description: "" }));
    }
    return parsed as PortalCategory[];
  } catch {
    return [];
  }
}

export default async function SkoolPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const tokenSetting = await prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } });
  if (!tokenSetting || tokenSetting.value !== token) notFound();

  const [nameSetting, logoSetting, categoriesSetting, descSetting, freebies] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.siteSetting.findUnique({ where: { key: "agency_logo" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_categories" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_portal_description" } }),
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  const communityName = nameSetting?.value ?? "Member Resources";
  const logoUrl = logoSetting?.value ?? null;
  const portalDescription = descSetting?.value ?? "";
  const categories = parseCategories(categoriesSetting?.value ?? null);
  const categoryNames = categories.map((c) => c.name);

  // Flatten into asset entries grouped by category
  interface FlatAsset { id: string; name: string; description: string | null; url: string; }
  const grouped: Record<string, FlatAsset[]> = {};
  for (const cat of categoryNames) grouped[cat] = [];
  grouped[""] = [];

  for (const f of freebies) {
    const url = f.assets[0]?.url ?? "";
    if (!url) continue; // skip items with no URL set
    const key = f.category && categoryNames.includes(f.category) ? f.category : "";
    grouped[key].push({ id: f.id, name: f.name, description: f.description, url });
  }

  const hasUncategorized = grouped[""].length > 0;

  return (
    <div className="min-h-screen" style={{ color: "var(--text-primary)" }}>
      {/* Sticky header */}
      <div style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(14,16,19,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <ClipLaunchLogo logoUrl={logoUrl} compact />
          <h1 className="font-semibold text-base">{communityName}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Portal description */}
        {portalDescription && (
          <p className="text-sm mb-10 leading-relaxed" style={{ color: "var(--text-secondary)", maxWidth: "56ch" }}>
            {portalDescription}
          </p>
        )}

        {freebies.length === 0 ? (
          <div className="py-20 text-center">
            <p style={{ color: "var(--text-secondary)" }}>No resources available yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map((cat) => {
              const items = grouped[cat.name] ?? [];
              if (items.length === 0 && !cat.description) return null;
              return (
                <div key={cat.name}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{cat.description}</p>
                  )}
                  {!cat.description && <div className="mb-4" />}
                  <div className="space-y-2">
                    {items.map((asset) => (
                      <AssetLink key={asset.id} asset={asset} />
                    ))}
                  </div>
                </div>
              );
            })}

            {hasUncategorized && (
              <div>
                {categoryNames.length > 0 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>Other</h2>
                )}
                <div className="space-y-2">
                  {grouped[""].map((asset) => (
                    <AssetLink key={asset.id} asset={asset} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetLink({ asset }: { asset: { id: string; name: string; description: string | null; url: string } }) {
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-4 py-3 rounded-xl group"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        transition: "border-color 120ms ease",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent-border)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-default)"; }}
    >
      <FileBox size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{asset.name}</p>
        {asset.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{asset.description}</p>
        )}
      </div>
    </a>
  );
}
