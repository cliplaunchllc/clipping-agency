import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ClipLaunchLogo from "@/components/shared/ClipLaunchLogo";
import OnboardingContent from "@/components/shared/OnboardingContent";

export const dynamic = "force-dynamic";

export default async function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [client, logoSetting] = await Promise.all([
    prisma.client.findUnique({
      where: { shareToken: token },
      select: {
        name: true,
        welcomeVideoUrl: true,
        intakeFormUrl: true,
      },
    }),
    prisma.siteSetting.findUnique({ where: { key: "agency_logo" } }),
  ]);

  if (!client) notFound();

  const logoUrl = logoSetting?.value ?? null;

  return (
    <div className="min-h-screen" style={{ color: "var(--text-primary)" }}>
      {/* Sticky frosted-glass header */}
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
          <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
            ClipLaunch
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <OnboardingContent
          welcomeVideoUrl={client.welcomeVideoUrl}
          intakeFormUrl={client.intakeFormUrl}
        />
      </div>
    </div>
  );
}
