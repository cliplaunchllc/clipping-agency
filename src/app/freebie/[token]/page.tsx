import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExternalLink, FileBox } from "lucide-react";
import ClipLaunchLogo from "@/components/shared/ClipLaunchLogo";

export const dynamic = "force-dynamic";

export default async function PublicFreebiePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [freebie, logoSetting] = await Promise.all([
    prisma.freebie.findUnique({
      where: { shareToken: token },
      include: { links: { orderBy: { order: "asc" } }, assets: { orderBy: { order: "asc" } } },
    }),
    prisma.siteSetting.findUnique({ where: { key: "agency_logo" } }),
  ]);

  if (!freebie) notFound();
  const logoUrl = logoSetting?.value ?? null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header image */}
      {freebie.headerImageUrl && (
        <div className="w-full" style={{ maxHeight: 320, overflow: "hidden" }}>
          <img src={freebie.headerImageUrl} alt={freebie.name} className="w-full object-cover" style={{ maxHeight: 320 }} />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          {!freebie.headerImageUrl && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
              Free Resource
            </div>
          )}
          <h1 className="text-3xl font-bold mb-4" style={{ letterSpacing: "-0.02em" }}>{freebie.name}</h1>
          {freebie.description && (
            <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {freebie.description}
            </p>
          )}
        </div>

        {/* Links */}
        {freebie.links.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>Links</h2>
            <div className="space-y-2">
              {freebie.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl transition-colors group"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
                >
                  <span className="font-medium text-sm">{link.label}</span>
                  <ExternalLink size={14} style={{ color: "var(--text-tertiary)" }} className="group-hover:text-accent transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Assets */}
        {freebie.assets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>Assets</h2>
            <div className="space-y-2">
              {freebie.assets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-colors"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                    <FileBox size={13} />
                  </div>
                  <span className="font-medium text-sm">{asset.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center mt-12">
          <ClipLaunchLogo logoUrl={logoUrl} />
        </div>
      </div>
    </div>
  );
}
