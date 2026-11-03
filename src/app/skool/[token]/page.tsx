import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FileBox, ChevronDown } from "lucide-react";
import ClipLaunchLogo from "@/components/shared/ClipLaunchLogo";

export const dynamic = "force-dynamic";

export default async function SkoolPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const tokenSetting = await prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } });
  if (!tokenSetting || tokenSetting.value !== token) notFound();

  const [nameSetting, logoSetting, categoriesSetting, freebies] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.siteSetting.findUnique({ where: { key: "agency_logo" } }),
    prisma.siteSetting.findUnique({ where: { key: "skool_categories" } }),
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  const communityName = nameSetting?.value ?? "Member Resources";
  const logoUrl = logoSetting?.value ?? null;
  const managedCategories: string[] = categoriesSetting?.value
    ? JSON.parse(categoriesSetting.value)
    : [];

  // Group by category; uncategorised resources go last under empty string key
  const grouped = freebies.reduce<Record<string, typeof freebies>>((acc, f) => {
    const key = f.category?.trim() || "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  // Sort by managed category order; categories not in the list come after; uncategorised last
  const allKeys = Object.keys(grouped);
  const categoryKeys = allKeys.sort((a, b) => {
    if (a === "" && b !== "") return 1;
    if (a !== "" && b === "") return -1;
    const ai = managedCategories.indexOf(a);
    const bi = managedCategories.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const hasCategories = categoryKeys.some((k) => k !== "");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <ClipLaunchLogo logoUrl={logoUrl} compact />
          <h1 className="font-semibold text-base">{communityName}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {freebies.length === 0 ? (
          <div className="py-20 text-center">
            <p style={{ color: "var(--text-secondary)" }}>No resources available yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categoryKeys.map((catKey) => (
              <div key={catKey}>
                {hasCategories && catKey !== "" && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
                    {catKey}
                  </h2>
                )}
                {hasCategories && catKey === "" && categoryKeys.length > 1 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
                    Other
                  </h2>
                )}
                <div className="space-y-4">
                  {grouped[catKey].map((f) => (
                    <SkoolCard key={f.id} freebie={f} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkoolCard({ freebie }: {
  freebie: {
    id: string; name: string; description: string | null; category: string | null;
    assets: { id: string; label: string; url: string }[];
  };
}) {
  const hasContent = freebie.assets.length > 0;

  return (
    <details className="group" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{freebie.name}</p>
          {freebie.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{freebie.description}</p>
          )}
        </div>
        {hasContent && (
          <ChevronDown size={15} className="flex-shrink-0 ml-3 transition-transform group-open:rotate-180" style={{ color: "var(--text-tertiary)" }} />
        )}
      </summary>

      {hasContent && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {freebie.description && (
            <p className="text-sm pt-4 mb-3" style={{ color: "var(--text-secondary)" }}>{freebie.description}</p>
          )}
          <div className="space-y-1.5 pt-4">
            {freebie.assets.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                <FileBox size={13} style={{ color: "var(--accent)" }} />
                {a.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}
