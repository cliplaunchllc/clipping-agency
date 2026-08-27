"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "agency" | "clipper" | "client";

const roles: { id: Role; label: string; desc: string }[] = [
  { id: "agency", label: "Agency", desc: "Manage clients, clippers & all analytics" },
  { id: "clipper", label: "Clipper", desc: "Submit clips and track your performance" },
  { id: "client", label: "Client", desc: "View your campaign results and reports" },
];

function RocketLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="#FF3B3B" />
      <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="#FF6B6B" opacity="0.6" />
      <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.95" />
      <circle cx="12" cy="9" r="0.7" fill="#FF3B3B" />
      <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="#CC2020" />
      <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="#AA1A1A" />
      <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="#AA1A1A" />
      <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#FF8C00" opacity="0.9" />
      <path d="M11.2 16.5C11.2 16.5 11.6 17.5 12 18.5C12.4 17.5 12.8 16.5 12.8 16.5H11.2Z" fill="#FFD700" opacity="0.8" />
    </svg>
  );
}

const ROLE_REDIRECT: Record<string, string> = { agency: "/agency", clipper: "/clipper", client: "/client" };

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<"role" | "login">("role");
  const [agencyLogo, setAgencyLogo] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("agency_logo") : null
  );

  useEffect(() => {
    fetch("/api/settings/logo").then((r) => r.json()).then((d) => {
      const logo = d.logoUrl ?? null;
      setAgencyLogo(logo);
      if (logo) localStorage.setItem("agency_logo", logo);
      else localStorage.removeItem("agency_logo");
    });
  }, []);

  const [selectedRole, setSelectedRole] = useState<Role | null>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lastRole") as Role | null) ?? null;
    }
    return null;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleRoleSelect(role: Role) {
    setSelectedRole(role);
    setStep("login");
    setError("");
    if (typeof window !== "undefined") localStorage.setItem("lastRole", role);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    // If "remember me" is unchecked, mark session as temporary in localStorage
    if (!rememberMe) {
      localStorage.setItem("sessionExpireOnClose", "1");
    } else {
      localStorage.removeItem("sessionExpireOnClose");
    }

    const res = await fetch("/api/auth/session");
    const sessionData = await res.json();
    const role = sessionData?.user?.role;

    const redirectMap: Record<string, string> = {
      agency: "/agency",
      clipper: "/clipper",
      client: "/client",
    };

    router.push(redirectMap[role] || "/");
  }

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      router.replace(ROLE_REDIRECT[session.user.role as string] ?? "/");
    }
  }, [status, session, router]);

  const roleInfo = roles.find((r) => r.id === selectedRole);

  if (status === "loading" || status === "authenticated") {
    return <div className="min-h-screen" style={{ background: "#05070D" }} />;
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#05070D" }}>
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,59,59,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,255,162,0.04) 0%, transparent 70%)" }} />
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: Math.random() > 0.7 ? 2 : 1,
              height: Math.random() > 0.7 ? 2 : 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: "white",
              opacity: Math.random() * 0.4 + 0.1,
            }} />
        ))}
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 overflow-hidden"
            style={agencyLogo ? { border: "1px solid rgba(255,255,255,0.1)" } : { background: "rgba(255,59,59,0.12)", border: "1px solid rgba(255,59,59,0.25)" }}>
            {agencyLogo ? (
              <img src={agencyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <RocketLogo size={28} />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            ClipLaunch
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
            {step === "role" ? "Select your account type to continue" : `Signing in as ${roleInfo?.label}`}
          </p>
        </div>

        {/* Step 1 — Role selector */}
        {step === "role" && (
          <div className="space-y-3">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className="w-full text-left rounded-2xl p-5 transition-all group"
                style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,59,59,0.4)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(255,59,59,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
                      {role.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#8A93A6" }}>{role.desc}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Login form */}
        {step === "login" && (
          <div className="rounded-2xl p-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            {/* Back button */}
            <button
              onClick={() => { setStep("role"); setError(""); setEmail(""); setPassword(""); }}
              className="flex items-center gap-1.5 text-xs mb-6 transition-colors"
              style={{ color: "#8A93A6" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#F5F6FA")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#8A93A6")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            {/* Role badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-6"
              style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF3B3B" }} />
              <span className="text-xs font-medium" style={{ color: "#FF3B3B" }}>{roleInfo?.label}</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,59,59,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,59,59,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="••••••••"
                />
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe((v) => !v)}
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: rememberMe ? "rgba(255,59,59,0.85)" : "rgba(255,255,255,0.04)",
                    border: rememberMe ? "1px solid rgba(255,59,59,0.6)" : "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                  }}
                >
                  {rememberMe && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{ color: "#8A93A6" }}
                  onClick={() => setRememberMe((v) => !v)}
                >
                  Remember me for 30 days
                </span>
              </label>

              {error && (
                <div className="text-xs px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757", border: "1px solid rgba(255,71,87,0.2)" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2"
                style={{
                  background: loading ? "rgba(255,59,59,0.1)" : "rgba(255,59,59,0.85)",
                  color: "#FFFFFF",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: loading ? "none" : "0 0 24px rgba(255,59,59,0.3)",
                }}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {(selectedRole === "clipper" || selectedRole === "client") && (
              <p className="text-center text-xs mt-5" style={{ color: "#8A93A6" }}>
                New {roleInfo?.label.toLowerCase()}?{" "}
                <Link
                  href={selectedRole === "client" ? "/signup?role=client" : "/signup"}
                  style={{ color: "#3DFFA2" }}
                >
                  Create an account
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
