import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClipperPendingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if (session.user.status !== "pending") redirect("/clipper");

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="1.5"/>
            <path d="M12 7v5l3 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Account Pending
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
          Your account is being reviewed. You'll have access once you're approved by the agency.
        </p>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Signed in as {session.user.email}
        </p>
      </div>
    </div>
  );
}
