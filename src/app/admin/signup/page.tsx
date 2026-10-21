"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* Deterministic star positions */
const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: ((i * 97 + 13) % 100),
  y: ((i * 67 + 31) % 100),
  large: i % 7 === 0,
  opacity: 0.1 + (i % 5) * 0.06,
}));

function saveAccount(account: { name: string; email: string; role: string; deviceToken: string }) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(localStorage.getItem("saved_accounts") || "[]").filter(
      (a: { email: string }) => a.email !== account.email
    );
    localStorage.setItem("saved_accounts", JSON.stringify([account, ...existing].slice(0, 6)));
  } catch { /* ignore */ }
}

export default function AdminSignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);

  const TEAM_ROLES = [
    { id: "head_campaign",    label: "Head of Campaign Management" },
    { id: "campaign_manager", label: "Campaign Manager" },
    { id: "va",               label: "VA" },
    { id: "discord_mod",      label: "Discord Moderator" },
    { id: "freelance",        label: "Freelance" },
  ];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings/logo")
      .then((r) => r.json())
      .then((d) => setAgencyLogo(d.logoUrl ?? null));
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "agency") {
      router.replace("/agency");
    }
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password || !inviteCode.trim()) {
      setError("All fields are required");
      return;
    }
    if (!teamRole) {
      setError("Please select your role");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    // Create the account
    const res = await fetch("/api/admin/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password, inviteCode: inviteCode.trim(), teamRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create account");
      setLoading(false);
      return;
    }

    // Auto sign-in
    const signInResult = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });
    if (signInResult?.error) {
      setError("Account created but sign-in failed. Please go to the login page.");
      setLoading(false);
      return;
    }

    // Save device token for "remember me"
    const tokenRes = await fetch("/api/auth/device-token", { method: "POST" });
    if (tokenRes.ok) {
      const { token } = await tokenRes.json();
      saveAccount({ name: name.trim(), email: email.trim().toLowerCase(), role: "agency", deviceToken: token });
    }

    router.push("/agency");
  }

  if (status === "authenticated") {
    return <div className="min-h-screen" style={{ background: "var(--bg-base)" }} />;
  }

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="absolute rounded-full"
          style={{
            width: 480, height: 480,
            top: "20%", left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, rgba(120,10,20,0.04) 50%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {STARS.map((s, i) => (
          <div key={i} className="absolute rounded-full"
            style={{ width: s.large ? 2 : 1, height: s.large ? 2 : 1, left: `${s.x}%`, top: `${s.y}%`, background: "white", opacity: s.opacity }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Logo / header */}
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
              : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="#FF5A5F" />
                  <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.9" />
                  <circle cx="12" cy="9" r="0.7" fill="#FF5A5F" />
                  <path d="M8 12H16V15.5C16 16 14 16.5 12 16.5C10 16.5 8 16 8 15.5V12Z" fill="#DC2626" />
                  <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="#DC2626" />
                  <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="#DC2626" />
                  <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#F5B94A" opacity="0.9" />
                </svg>
              )
            }
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            Team Sign Up
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create your agency team account
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl p-6 space-y-3"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-inset-top)" }}>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                required autoFocus placeholder="Jane Smith" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required placeholder="you@example.com" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required placeholder="Min. 6 characters" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required placeholder="••••••••" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Your Role</label>
              <select value={teamRole} onChange={(e) => setTeamRole(e.target.value)} required
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}>
                <option value="">— Select your role —</option>
                {TEAM_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="pt-1 pb-1">
              <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Invite Code
              </label>
              <input
                type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                required placeholder="Enter the code from your admin"
                style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                Get this from your agency admin in Settings → Team
              </p>
            </div>

            {error && (
              <div className="text-xs px-3 py-2 rounded-md"
                style={{ background: "rgba(255,59,59,0.08)", color: "var(--danger)", border: "1px solid rgba(255,59,59,0.2)" }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2 rounded-md text-sm font-medium transition-colors mt-1"
              style={{
                background: loading ? "var(--bg-active)" : "var(--accent-solid)",
                color: "var(--text-on-accent)",
                boxShadow: loading ? "none" : "var(--shadow-inset-top)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid-hover)")}
              onMouseLeave={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = "var(--accent-solid)")}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
          Already have an account?{" "}
          <Link href="/login" className="underline" style={{ color: "var(--text-secondary)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
