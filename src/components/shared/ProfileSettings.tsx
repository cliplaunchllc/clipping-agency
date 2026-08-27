"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/shared/Sidebar";

interface Props {
  role: "clipper" | "client";
  userName: string;
  userEmail: string;
}

export default function ProfileSettings({ role, userName: initialName, userEmail: initialEmail }: Props) {
  const { update: updateSession } = useSession();

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      setProfileMsg({ type: "err", text: data.error || "Failed to save" });
    } else {
      setProfileMsg({ type: "ok", text: "Profile updated successfully" });
      // Refresh session so the name updates in the sidebar
      await updateSession({ name: data.name, email: data.email });
    }
    setProfileSaving(false);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: "Passwords do not match" });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);

    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPasswordMsg({ type: "err", text: data.error || "Failed to update password" });
    } else {
      setPasswordMsg({ type: "ok", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordSaving(false);
  }

  const accentColor = role === "client" ? "#a78bfa" : "#3DFFA2";
  const accentBg = role === "client" ? "rgba(167,139,250,0.12)" : "rgba(61,255,162,0.12)";
  const accentBorder = role === "client" ? "rgba(167,139,250,0.25)" : "rgba(61,255,162,0.25)";

  return (
    <div className="flex min-h-screen" style={{ background: "#05070D" }}>
      <Sidebar role={role} userName={name} />
      <main className="flex-1 ml-60">
        <div className="max-w-2xl mx-auto px-8 py-10">
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
            Settings
          </h1>
          <p className="text-sm mb-8" style={{ color: "#8A93A6" }}>Manage your account information</p>

          {/* Profile section */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-semibold mb-5" style={{ color: "#F5F6FA" }}>Profile</h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = `${accentColor}66`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = `${accentColor}66`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="you@example.com"
                />
              </div>

              {profileMsg && (
                <div className="text-xs px-4 py-3 rounded-xl"
                  style={{
                    background: profileMsg.type === "ok" ? "rgba(61,255,162,0.08)" : "rgba(255,71,87,0.1)",
                    color: profileMsg.type === "ok" ? "#3DFFA2" : "#FF4757",
                    border: `1px solid ${profileMsg.type === "ok" ? "rgba(61,255,162,0.2)" : "rgba(255,71,87,0.2)"}`,
                  }}>
                  {profileMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: accentBg,
                  border: `1px solid ${accentBorder}`,
                  color: accentColor,
                  opacity: profileSaving ? 0.6 : 1,
                  cursor: profileSaving ? "not-allowed" : "pointer",
                }}
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>

          {/* Password section */}
          <div className="rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 className="text-base font-semibold mb-5" style={{ color: "#F5F6FA" }}>Change Password</h2>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = `${accentColor}66`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = `${accentColor}66`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A93A6" }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = `${accentColor}66`)}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder="••••••••"
                />
              </div>

              {passwordMsg && (
                <div className="text-xs px-4 py-3 rounded-xl"
                  style={{
                    background: passwordMsg.type === "ok" ? "rgba(61,255,162,0.08)" : "rgba(255,71,87,0.1)",
                    color: passwordMsg.type === "ok" ? "#3DFFA2" : "#FF4757",
                    border: `1px solid ${passwordMsg.type === "ok" ? "rgba(61,255,162,0.2)" : "rgba(255,71,87,0.2)"}`,
                  }}>
                  {passwordMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: accentBg,
                  border: `1px solid ${accentBorder}`,
                  color: accentColor,
                  opacity: (passwordSaving || !currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1,
                  cursor: (passwordSaving || !currentPassword || !newPassword || !confirmPassword) ? "not-allowed" : "pointer",
                }}
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
