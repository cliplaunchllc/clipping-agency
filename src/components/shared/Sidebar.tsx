"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, Settings, BarChart2,
} from "lucide-react";

const NAV_ITEMS = {
  agency: [
    { label: "Overview", href: "/agency", icon: LayoutDashboard },
    { label: "Clients", href: "/agency/clients", icon: Users },
    { label: "Campaign Reporting", href: "/agency/campaign-reporting", icon: BarChart2 },
    { label: "Settings", href: "/agency/settings", icon: Settings },
  ],
  client: [
    { label: "Dashboard", href: "/client", icon: LayoutDashboard },
    { label: "Settings", href: "/client/settings", icon: Settings },
  ],
};

interface SidebarProps {
  role: "agency" | "client";
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS[role];
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

  return (
    <aside
      className="w-56 flex flex-col h-screen fixed left-0 top-0 z-40"
      style={{
        background: "var(--bg-subtle)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={
            agencyLogo
              ? { border: "1px solid var(--border-default)" }
              : {
                  background: "var(--accent-muted)",
                  border: "1px solid var(--accent-border)",
                }
          }
        >
          {agencyLogo ? (
            <img src={agencyLogo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="var(--accent)" />
              <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="var(--accent)" opacity="0.5" />
              <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.9" />
              <circle cx="12" cy="9" r="0.7" fill="var(--accent)" />
              <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="var(--accent-solid)" />
              <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="var(--accent-solid)" />
              <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="var(--accent-solid)" />
              <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="var(--warning)" opacity="0.9" />
            </svg>
          )}
        </div>
        <span
          className="font-semibold text-sm tracking-tight"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
        >
          ClipLaunch
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm relative transition-colors nav-link"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-muted)" : "transparent",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                  style={{ height: "60%", background: "var(--accent)" }}
                />
              )}
              <Icon size={15} strokeWidth={isActive ? 2 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Section divider + role label */}
      <div className="px-5 pb-1 pt-2">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--text-tertiary)", fontSize: 10, letterSpacing: "0.08em" }}
        >
          {role}
        </p>
      </div>

      {/* User */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{
              background: "var(--accent-muted)",
              color: "var(--accent)",
              fontSize: 10,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {userName}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs py-1.5 px-3 rounded-md text-left transition-colors nav-link"
          style={{ color: "var(--text-tertiary)" }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
