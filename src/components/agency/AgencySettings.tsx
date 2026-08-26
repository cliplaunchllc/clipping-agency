"use client";

import { useState } from "react";
import { User, Lock, Bell, Shield } from "lucide-react";

interface Props {
  userName: string;
  email: string;
}

export default function AgencySettings({ userName, email }: Props) {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");
  const [name, setName] = useState(userName);
  const [saved, setSaved] = useState(false);

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

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
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
                <input type="email" value={email} disabled style={{ ...inputStyle, opacity: 0.5 }} />
                <p className="text-xs mt-1" style={{ color: "#8A93A6" }}>Email cannot be changed here</p>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "#8A93A6" }}>Role</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.2)" }}>
                  <Shield size={14} color="#FF3B3B" />
                  <span className="text-sm" style={{ color: "#FF3B3B" }}>Agency Admin</span>
                </div>
              </div>
              <button onClick={handleSave}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)", color: "#FF3B3B" }}>
                {saved ? "Saved!" : "Save Changes"}
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
