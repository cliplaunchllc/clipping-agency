import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ClientPendingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") redirect("/login");
  if (session.user.status !== "pending") redirect("/client");

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#05070D" }}>
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="1.5"/>
            <path d="M12 7v5l3 3" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
          Account Pending
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "#8A93A6" }}>
          Your account has been created. The agency will connect you to your campaign shortly.
          Check back soon — you&apos;ll have access once you&apos;re assigned.
        </p>
        <div className="rounded-2xl px-6 py-4 mb-6 text-left"
          style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs mb-1" style={{ color: "#8A93A6" }}>Signed in as</p>
          <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{session.user.name}</p>
          <p className="text-xs" style={{ color: "#8A93A6" }}>{session.user.email}</p>
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
        style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        Sign out
      </button>
    </form>
  );
}
