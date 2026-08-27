"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { User, Lock, Bell, Shield, ImageIcon, Camera, X } from "lucide-react";

interface Props {
  userName: string;
  email: string;
}

export default function AgencySettings({ userName, email }: Props) {
  const { update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications" | "branding">("profile");
  const [name, setName] = useState(userName);
  const [currentEmail, setCurrentEmail] = useState(email);
  const [newEmail, setNewEmail] = useState(email);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/logo").then((r) => r.json()).then((d) => setAgencyLogo(d.logoUrl ?? null));
  }, []);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL("image/webp", 0.9);
        await saveLogo(resized);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function saveLogo(logoUrl: string | null) {
    setLogoSaving(true);
    const res = await fetch("/api/settings/logo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl }),
    });
    if (res.ok) {
      setAgencyLogo(logoUrl);
      if (logoUrl) localStorage.setItem("agency_logo", logoUrl);
      else localStorage.removeItem("agency_logo");
    }
    setLogoSaving(false);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F5F6FA",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  async function handleSave() {
    setNameError("");
    setNameSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error || "Failed to save name");
      } else {
        setSaved(true);
        await updateSession(); // refresh JWT so sidebar name updates immediately
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setNameError("Failed to save name");
    }
    setNameSaving(false);
  }

  async function handleSaveEmail() {
    setEmailError("");
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError("This is already your email address");
      return;
    }
    setEmailSaving(true);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setEmailError(data.error || "Failed to update email");
    } else {
      setCurrentEmail(data.email);
      setNewEmail(data.email);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    }
    setEmailSaving(false);
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "branding", label: "Branding", icon: ImageIcon },
  ];

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>Settings</h1>
      <p className="text-sm mb-8" style={{ color: "#8A93A6" }}>Manage your account and preferences</p>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left"
                style={{
                  color: activeTab === tab.id ? "#FF3B3B" : "#8A93A6",
                  background: activeTab === tab.id ? "rgba(255,59,59,0.1)" : "transparent",
                }}>
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-2xl p-6" style={{ background: "#0B0E17", border: "1px solid rgba(255,255,255,0.08)" }}>
          {activeTab === "profile" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA" }}>Profile Information</h2>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Email Address</label>
                <div className="flex gap-2">
                  <input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); setEmailSaved(false); }}
                    style={inputStyle} placeholder="you@example.com" />
                  <button onClick={handleSaveEmail} disabled={emailSaving || newEmail === currentEmail}
                    className="px-4 rounded-xl text-sm font-medium flex-shrink-0"
                    style={{
                      background: emailSaved ? "rgba(61,255,162,0.15)" : "rgba(255,59,59,0.12)",
                      border: `1px solid ${emailSaved ? "rgba(61,255,162,0.3)" : "rgba(255,59,59,0.25)"}`,
                      color: emailSaved ? "#3DFFA2" : "#FF3B3B",
                      opacity: emailSaving || newEmail === currentEmail ? 0.5 : 1,
                      cursor: emailSaving || newEmail === currentEmail ? "not-allowed" : "pointer",
                    }}>
                    {emailSaving ? "Saving…" : emailSaved ? "Saved!" : "Update"}
                  </button>
                </div>
                {emailError && <p className="text-xs mt-1.5" style={{ color: "#FF4757" }}>{emailError}</p>}
                <p className="text-xs mt-1" style={{ color: "#8A93A6" }}>You'll need to log in again after changing your email</p>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Role</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)" }}>
                  <Shield size={14} color="#FF3B3B" />
                  <span className="text-sm" style={{ color: "#FF3B3B" }}>Agency Admin</span>
                </div>
              </div>
              {nameError && <p className="text-xs" style={{ color: "#FF4757" }}>{nameError}</p>}
              <button onClick={handleSave} disabled={nameSaving}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: saved ? "rgba(61,255,162,0.15)" : "rgba(255,59,59,0.15)",
                  border: `1px solid ${saved ? "rgba(61,255,162,0.3)" : "rgba(255,59,59,0.3)"}`,
                  color: saved ? "#3DFFA2" : "#FF3B3B",
                  opacity: nameSaving ? 0.6 : 1,
                  cursor: nameSaving ? "not-allowed" : "pointer",
                }}>
                {nameSaving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA" }}>Security</h2>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Current Password</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>New Password</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Confirm New Password</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              <button onClick={handleSave}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "#FF3B3B" }}>
                {saved ? "Updated!" : "Update Password"}
              </button>
            </div>
          )}

          {activeTab === "branding" && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA" }}>Branding</h2>
              <div>
                <label className="block text-xs mb-3" style={{ color: "#8A93A6" }}>Agency Logo</label>
                <div className="flex items-center gap-5">
                  {/* Preview */}
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center"
                      style={{ background: agencyLogo ? "transparent" : "rgba(255,59,59,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {agencyLogo ? (
                        <img src={agencyLogo} alt="Agency logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={28} color="#8A93A6" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button onClick={() => logoInputRef.current?.click()} disabled={logoSaving}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "rgba(255,59,59,0.1)", border: "1px solid rgba(255,59,59,0.2)", color: "#FF3B3B", opacity: logoSaving ? 0.6 : 1 }}>
                      <Camera size={14} />
                      {logoSaving ? "Saving..." : agencyLogo ? "Change Logo" : "Upload Logo"}
                    </button>
                    {agencyLogo && (
                      <button onClick={() => saveLogo(null)} disabled={logoSaving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#8A93A6" }}>
                        <X size={14} />
                        Remove Logo
                      </button>
                    )}
                    <p className="text-xs" style={{ color: "#8A93A6" }}>
                      Appears on the login page and in all sidebars. PNG, JPG, or WebP recommended.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold mb-4" style={{ color: "#F5F6FA" }}>Notification Preferences</h2>
              {[
                { label: "New clip submitted", desc: "When a clipper submits a new clip" },
                { label: "Client activity", desc: "When a client logs in or updates their account" },
                { label: "Weekly performance report", desc: "Summary of views and engagement" },
                { label: "Clipper milestone", desc: "When a clip hits 100K, 1M views, etc." },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#F5F6FA" }}>{item.label}</p>
                    <p className="text-xs" style={{ color: "#8A93A6" }}>{item.desc}</p>
                  </div>
                  <div className="w-10 h-5 rounded-full flex items-center cursor-pointer relative"
                    style={{ background: "rgba(255,59,59,0.3)" }}>
                    <div className="w-4 h-4 rounded-full absolute right-0.5"
                      style={{ background: "#FF3B3B" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
