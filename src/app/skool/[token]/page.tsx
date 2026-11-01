import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExternalLink, FileBox, ChevronDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SkoolPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const tokenSetting = await prisma.siteSetting.findUnique({ where: { key: "skool_portal_token" } });
  if (!tokenSetting || tokenSetting.value !== token) notFound();

  const [nameSetting, freebies] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "skool_community_name" } }),
    prisma.freebie.findMany({
      where: { type: "skool" },
      include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  const communityName = nameSetting?.value ?? "Member Resources";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="var(--accent)" />
              <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="var(--accent-solid)" />
            </svg>
          </div>
          <h1 className="font-semibold text-base">{communityName}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {freebies.length === 0 ? (
          <div className="py-20 text-center">
            <p style={{ color: "var(--text-secondary)" }}>No resources available yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {freebies.map((f) => (
              <SkoolCard key={f.id} freebie={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkoolCard({ freebie }: {
  freebie: {
    id: string; name: string; description: string | null;
    links: { id: string; label: string; url: string }[];
    assets: { id: string; label: string; url: string }[];
  };
}) {
  const hasContent = freebie.links.length > 0 || freebie.assets.length > 0;

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
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {freebie.description && (
            <p className="text-sm pt-4" style={{ color: "var(--text-secondary)" }}>{freebie.description}</p>
          )}
          {freebie.links.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Links</p>
              <div className="space-y-1.5">
                {freebie.links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                    {l.label}
                    <ExternalLink size={12} style={{ color: "var(--text-tertiary)" }} />
                  </a>
                ))}
              </div>
            </div>
          )}
          {freebie.assets.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Assets</p>
              <div className="space-y-1.5">
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
        </div>
      )}
    </details>
  );
}
