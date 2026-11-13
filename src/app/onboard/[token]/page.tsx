import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OnboardingContent from "@/components/shared/OnboardingContent";

export default async function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await prisma.client.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      logoUrl: true,
      welcomeVideoUrl: true,
      intakeFormUrl: true,
    },
  });

  if (!client) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid var(--border-subtle)",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        {client.logoUrl ? (
          <img src={client.logoUrl} alt={client.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "var(--accent-solid)",
            boxShadow: "var(--shadow-glow)",
            display: "grid", placeItems: "center",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="white" />
              <circle cx="12" cy="9" r="1.5" fill="var(--accent-solid)" opacity="0.9" />
              <circle cx="12" cy="9" r="0.7" fill="white" />
              <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="white" />
              <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#F5B544" opacity="0.95" />
            </svg>
          </div>
        )}
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>ClipLaunch</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <OnboardingContent
          welcomeVideoUrl={client.welcomeVideoUrl}
          intakeFormUrl={client.intakeFormUrl}
        />
      </div>
    </div>
  );
}
