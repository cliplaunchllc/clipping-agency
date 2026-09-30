import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ClipperPendingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "clipper") redirect("/login");
  if (session.user.status !== "pending") redirect("/clipper");

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#FF3B3B" strokeWidth="1.5"/>
            <path d="M12 7v5l3 3" stroke="#FF3B3B" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
          Waiting for Assignment
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
          Your account has been created. The agency will assign you to a client campaign shortly.
          Check back soon — you&apos;ll be redirected automatically once you&apos;re assigned.
        </p>
        <div className="rounded-2xl px-6 py-4 mb-6 text-left"
          style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Signed in as</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{session.user.name}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{session.user.email}</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action={async () => {
      "use server";
      const { signOut: nextSignOut } = await import("@/auth");
      await nextSignOut({ redirectTo: "/login" });
    }}>
      <button type="submit" className="text-xs py-2 px-4 rounded-lg"
        style={{ color: "var(--text-secondary)", background: "var(--border-subtle)", border: "1px solid rgba(255,255,255,0.06)" }}>
        Sign out
      </button>
    </form>
  );
}
