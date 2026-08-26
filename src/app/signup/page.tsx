"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create account");
      setLoading(false);
      return;
    }

    // Auto-login
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Account created but login failed — try logging in manually");
      setLoading(false);
      return;
    }

    window.location.href = "/clipper/pending";
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
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(61,255,162,0.05) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "rgba(61,255,162,0.1)", border: "1px solid rgba(61,255,162,0.2)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="#FF3B3B"/>
              <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="#FF6B6B" opacity="0.6"/>
              <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.95"/>
              <circle cx="12" cy="9" r="0.7" fill="#FF3B3B"/>
              <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="#CC2020"/>
              <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="#AA1A1A"/>
              <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="#AA1A1A"/>
              <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#FF8C00" opacity="0.9"/>
              <path d="M11.2 16.5C11.2 16.5 11.6 17.5 12 18.5C12.4 17.5 12.8 16.5 12.8 16.5H11.2Z" fill="#FFD700" opacity="0.8"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            Join as a Clipper
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8A93A6" }}>
            Create your account — the agency will assign you to a client
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Your Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                autoFocus placeholder="Alex Rivera" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(61,255,162,0.4)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="you@example.com" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(61,255,162,0.4)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(61,255,162,0.4)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
            </div>
            {error && (
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,71,87,0.1)", color: "#FF4757", border: "1px solid rgba(255,71,87,0.2)" }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold mt-2"
              style={{
                background: loading ? "rgba(61,255,162,0.05)" : "rgba(61,255,162,0.15)",
                border: "1px solid rgba(61,255,162,0.3)",
                color: "#3DFFA2",
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "#8A93A6" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#3DFFA2" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
