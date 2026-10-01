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
  { id: "agency",  label: "Agency",  desc: "Manage clients & all analytics" },
  { id: "client",  label: "Client",  desc: "View your campaign results and reports" },
];

const ROLE_REDIRECT: Record<string, string> = {
  agency: "/agency",
  clipper: "/clipper",
  client: "/client",
};

function RocketLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="#FF5A5F" />
      <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="#FF5A5F" opacity="0.5" />
      <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.9" />
      <circle cx="12" cy="9" r="0.7" fill="#FF5A5F" />
      <path d="M8 12H16V15.5C16 16 14 16.5 12 16.5C10 16.5 8 16 8 15.5V12Z" fill="#DC2626" />
      <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="#DC2626" />
      <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="#DC2626" />
      <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#F5B94A" opacity="0.9" />
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

/* Deterministic star positions — seeded so they don't change on re-render */
const STARS = Array.from({ length: 36 }, (_, i) => {
  const x = ((i * 97 + 13) % 100);
  const y = ((i * 67 + 31) % 100);
  const large = i % 7 === 0;
  const opacity = 0.1 + (i % 5) * 0.06;
  return { x, y, large, opacity };
});

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

  async function handleTapAccount(account: SavedAccount) {
    setTappingEmail(account.email);
    setError("");
    const result = await signIn("device-token", { token: account.deviceToken, redirect: false });
    if (result?.error) {
      setTappingEmail(null);
      setSelectedRole(account.role);
      setEmail(account.email);
      setStep("login");
      setError("Session expired — please enter your password");
      return;
    }
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
    const res = await fetch("/api/auth/session");
    const sessionData = await res.json();
    const role = sessionData?.user?.role as Role;
    const name = sessionData?.user?.name ?? email;
    const tokenRes = await fetch("/api/auth/device-token", { method: "POST" });
    if (tokenRes.ok) {
      const { token } = await tokenRes.json();
      saveAccount({ name, email, role, deviceToken: token });
    }
    router.push(ROLE_REDIRECT[role] || "/");
  }

  const roleInfo = roles.find((r) => r.id === selectedRole);

  // Don't blank out while session loads — keep the form visible
  if (status === "authenticated") {
    return <div className="min-h-screen" style={{ background: "var(--bg-base)" }} />;
  }

  /* ── shared input style ──────────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    background: "var(--bg-hover)",
    border: "1px solid var(--border-default)",
    color: "var(--text-primary)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    height: 36,
    fontFamily: "Inter, system-ui, sans-serif",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Background: sparse stars + single red nebula haze ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {/* Red nebula — one, off-center, low opacity */}
        <div
          className="absolute rounded-full"
          style={{
            width: 480,
            height: 480,
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, rgba(120,10,20,0.04) 50%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Stars */}
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: s.large ? 2 : 1,
              height: s.large ? 2 : 1,
              left: `${s.x}%`,
              top: `${s.y}%`,
              background: "white",
              opacity: s.opacity,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 overflow-hidden"
            style={
              agencyLogo
                ? { border: "1px solid var(--border-default)", background: "var(--bg-surface)" }
                : { background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }
            }
          >
            {agencyLogo
              ? <img src={agencyLogo} alt="Logo" className="w-full h-full object-cover" />
              : <RocketLogo size={26} />}
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
          >
            ClipLaunch
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {step === "accounts" ? "Select an account to continue" :
             step === "role"     ? "Choose your account type" :
             `Sign in as ${roleInfo?.label}`}
          </p>
        </div>

        {/* ── Saved Accounts ───────────────────────────────────────── */}
        {step === "accounts" && (
          <div className="space-y-1.5">
            {savedAccounts.map((account) => {
              const isTapping = tappingEmail === account.email;
              return (
                <button
                  key={account.email}
                  onClick={() => !tappingEmail && handleTapAccount(account)}
                  disabled={!!tappingEmail}
                  className="w-full text-left rounded-lg p-3 transition-colors relative group"
                  style={{
                    background: isTapping ? "var(--bg-hover)" : "var(--bg-surface)",
                    border: `1px solid ${isTapping ? "var(--accent-border)" : "var(--border-default)"}`,
                    boxShadow: "var(--shadow-inset-top)",
                    opacity: tappingEmail && !isTapping ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (tappingEmail) return;
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                  }}
                  onMouseLeave={(e) => {
                    if (tappingEmail) return;
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                    >
                      {isTapping ? (
                        <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (account.name || account.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {isTapping ? "Signing in…" : account.name}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{account.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded capitalize"
                        style={{ background: "var(--bg-active)", color: "var(--text-secondary)", fontSize: 11 }}
                      >
                        {account.role}
                      </span>
                      {!tappingEmail && (
                        <button
                          onClick={(e) => handleRemoveSavedAccount(e, account.email)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
                          style={{ color: "var(--text-tertiary)" }}
                          aria-label="Remove account"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {error && (
              <div
                className="text-xs px-3 py-2 rounded-md flex items-center gap-2"
                style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--accent-border)" }}
              >
                {error}
              </div>
            )}

            <button
              onClick={() => setStep("role")}
              disabled={!!tappingEmail}
              className="w-full text-left rounded-lg p-3 transition-colors mt-0.5"
              style={{
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                opacity: tappingEmail ? 0.4 : 1,
              }}
              onMouseEnter={(e) => !tappingEmail && ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: "var(--bg-active)", border: "1px solid var(--border-subtle)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Use a different account</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Role selector ─────────────────────────────────────────── */}
        {step === "role" && (
          <div className="space-y-1.5">
            {savedAccounts.length > 0 && (
              <button
                onClick={() => setStep("accounts")}
                className="flex items-center gap-1.5 text-xs mb-4 transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back
              </button>
            )}
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className="w-full text-left rounded-lg p-4 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-inset-top)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{role.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{role.desc}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Password login ─────────────────────────────────────────── */}
        {step === "login" && (
          <div
            className="rounded-xl p-6"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-inset-top)",
            }}
          >
            <button
              onClick={() => { setStep(savedAccounts.length > 0 ? "accounts" : "role"); setError(""); setPassword(""); }}
              className="flex items-center gap-1.5 text-xs mb-5 transition-colors"
              style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            {selectedRole && (
              <div
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md mb-5"
                style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                <span className="text-xs font-medium capitalize" style={{ color: "var(--accent)" }}>{selectedRole}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={!email}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={!!email}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-md flex items-center gap-2"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--accent-border)" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-md text-sm font-medium transition-colors mt-1"
                style={{
                  background: loading ? "var(--bg-active)" : "var(--accent-solid)",
                  color: "var(--text-on-accent)",
                  boxShadow: loading ? "none" : "var(--shadow-inset-top)",
                }}
                onMouseEnter={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid-hover)")}
                onMouseLeave={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid)")}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

          </div>
        )}
      </div>
    </div>
  );
}
