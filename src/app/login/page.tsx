"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";

type Role = "agency" | "clipper" | "client";

interface SavedAccount {
  name: string;
  email: string;
  role: Role;
  deviceToken: string;
}

const roles: { id: Role; label: string; desc: string }[] = [
  { id: "agency", label: "Agency", desc: "Manage clients, clippers & all analytics" },
  { id: "clipper", label: "Clipper", desc: "Submit clips and track your performance" },
  { id: "client", label: "Client", desc: "View your campaign results and reports" },
];

const ROLE_COLORS: Record<Role, string> = {
  agency: "#FF3B3B",
  clipper: "#3DFFA2",
  client: "#a78bfa",
};

const ROLE_REDIRECT: Record<string, string> = { agency: "/agency", clipper: "/clipper", client: "/client" };

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

function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("saved_accounts") || "[]"); }
  catch { return []; }
}

function saveAccount(account: SavedAccount) {
  const existing = getSavedAccounts().filter((a) => a.email !== account.email);
  localStorage.setItem("saved_accounts", JSON.stringify([account, ...existing].slice(0, 6)));
}

function removeAccount(email: string) {
  const updated = getSavedAccounts().filter((a) => a.email !== email);
  localStorage.setItem("saved_accounts", JSON.stringify(updated));
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<"accounts" | "role" | "login">("accounts");
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tappingEmail, setTappingEmail] = useState<string | null>(null);

  useEffect(() => {
    const accounts = getSavedAccounts();
    setSavedAccounts(accounts);
    if (accounts.length === 0) setStep("role");
  }, []);

  useEffect(() => {
    fetch("/api/settings/logo").then((r) => r.json()).then((d) => {
      const logo = d.logoUrl ?? null;
      setAgencyLogo(logo);
      if (logo) localStorage.setItem("agency_logo", logo);
      else localStorage.removeItem("agency_logo");
    });
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      router.replace(ROLE_REDIRECT[session.user.role as string] ?? "/");
    }
  }, [status, session, router]);

  // One-tap login using stored device token
  async function handleTapAccount(account: SavedAccount) {
    setTappingEmail(account.email);
    setError("");

    const result = await signIn("device-token", {
      token: account.deviceToken,
      redirect: false,
    });

    if (result?.error) {
      // Device token expired or invalid — fall back to password login
      setTappingEmail(null);
      setSelectedRole(account.role);
      setEmail(account.email);
      setStep("login");
      setError("Session expired — please enter your password");
      return;
    }

    // Refresh device token so it stays valid for another 30 days
    const tokenRes = await fetch("/api/auth/device-token", { method: "POST" });
    if (tokenRes.ok) {
      const { token } = await tokenRes.json();
      const res = await fetch("/api/auth/session");
      const sessionData = await res.json();
      saveAccount({
        name: sessionData?.user?.name ?? account.name,
        email: account.email,
        role: account.role,
        deviceToken: token,
      });
    }

    router.push(ROLE_REDIRECT[account.role] || "/");
  }

  function handleRemoveSavedAccount(e: React.MouseEvent, email: string) {
    e.stopPropagation();
    removeAccount(email);
    const updated = getSavedAccounts();
    setSavedAccounts(updated);
    if (updated.length === 0) setStep("role");
  }

  function handleRoleSelect(role: Role) {
    setSelectedRole(role);
    setEmail("");
    setStep("login");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    // Get session info
    const res = await fetch("/api/auth/session");
    const sessionData = await res.json();
    const role = sessionData?.user?.role as Role;
    const name = sessionData?.user?.name ?? email;

    // Generate a device token so future logins are one-tap
    const tokenRes = await fetch("/api/auth/device-token", { method: "POST" });
    if (tokenRes.ok) {
      const { token } = await tokenRes.json();
      saveAccount({ name, email, role, deviceToken: token });
    }

    router.push(ROLE_REDIRECT[role] || "/");
  }

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
            {agencyLogo ? <img src={agencyLogo} alt="Logo" className="w-full h-full object-cover" /> : <RocketLogo size={28} />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            ClipLaunch
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
            {step === "accounts" ? "Select your account to continue" :
             step === "role" ? "Select your account type to continue" :
             `Signing in as ${roleInfo?.label}`}
          </p>
        </div>

        {/* Saved Accounts */}
        {step === "accounts" && (
          <div className="space-y-2.5">
            {savedAccounts.map((account) => {
              const color = ROLE_COLORS[account.role];
              const isTapping = tappingEmail === account.email;
              return (
                <button
                  key={account.email}
                  onClick={() => !tappingEmail && handleTapAccount(account)}
                  disabled={!!tappingEmail}
                  className="w-full text-left rounded-2xl p-4 transition-all relative group"
                  style={{
                    background: "#0B0E17",
                    border: `1px solid ${isTapping ? color + "55" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: isTapping ? `0 0 20px ${color}20` : "none",
                    cursor: tappingEmail ? "default" : "pointer",
                    opacity: tappingEmail && !isTapping ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (tappingEmail) return;
                    (e.currentTarget as HTMLElement).style.border = `1px solid ${color}55`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}18`;
                  }}
                  onMouseLeave={(e) => {
                    if (tappingEmail) return;
                    (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: `${color}18`, color }}>
                      {isTapping ? (
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (account.name || account.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold truncate" style={{ color: "#F5F6FA" }}>
                        {isTapping ? "Signing in..." : account.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: "#8A93A6" }}>{account.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: `${color}18`, color }}>
                        {account.role}
                      </span>
                      {!tappingEmail && (
                        <button
                          onClick={(e) => handleRemoveSavedAccount(e, account.email)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/5"
                          style={{ color: "#8A93A6" }}
                          title="Remove">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {error && (
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757", border: "1px solid rgba(255,71,87,0.2)" }}>
                {error}
              </div>
            )}

            <button
              onClick={() => setStep("role")}
              disabled={!!tappingEmail}
              className="w-full text-left rounded-2xl p-4 transition-all mt-1"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", opacity: tappingEmail ? 0.4 : 1 }}
              onMouseEnter={(e) => !tappingEmail && ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)")}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A93A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "#8A93A6" }}>Use a different account</p>
              </div>
            </button>
          </div>
        )}

        {/* Role selector */}
        {step === "role" && (
          <div className="space-y-3">
            {savedAccounts.length > 0 && (
              <button onClick={() => setStep("accounts")}
                className="flex items-center gap-1.5 text-xs mb-2 transition-colors"
                style={{ color: "#8A93A6" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#F5F6FA")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#8A93A6")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back
              </button>
            )}
            {roles.map((role) => (
              <button key={role.id} onClick={() => handleRoleSelect(role.id)}
                className="w-full text-left rounded-2xl p-5 transition-all"
                style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,59,59,0.4)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(255,59,59,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>{role.label}</p>
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

        {/* Password login (first time or after token expiry) */}
        {step === "login" && (
          <div className="rounded-2xl p-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => { setStep(savedAccounts.length > 0 ? "accounts" : "role"); setError(""); setPassword(""); }}
              className="flex items-center gap-1.5 text-xs mb-6 transition-colors"
              style={{ color: "#8A93A6" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#F5F6FA")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#8A93A6")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-6"
              style={{ background: `${ROLE_COLORS[selectedRole!]}18`, border: `1px solid ${ROLE_COLORS[selectedRole!]}33` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: ROLE_COLORS[selectedRole!] }} />
              <span className="text-xs font-medium" style={{ color: ROLE_COLORS[selectedRole!] }}>{roleInfo?.label}</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  autoFocus={!email} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,59,59,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  autoFocus={!!email} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(255,59,59,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="••••••••" />
              </div>

              {error && (
                <div className="text-xs px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757", border: "1px solid rgba(255,71,87,0.2)" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all mt-2"
                style={{
                  background: loading ? "rgba(255,59,59,0.1)" : "rgba(255,59,59,0.85)",
                  color: "#FFFFFF",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: loading ? "none" : "0 0 24px rgba(255,59,59,0.3)",
                }}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {(selectedRole === "clipper" || selectedRole === "client") && (
              <p className="text-center text-xs mt-5" style={{ color: "#8A93A6" }}>
                New {roleInfo?.label.toLowerCase()}?{" "}
                <Link href={selectedRole === "client" ? "/signup?role=client" : "/signup"} style={{ color: "#3DFFA2" }}>
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
