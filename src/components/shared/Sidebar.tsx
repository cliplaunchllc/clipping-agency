"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Settings, BarChart2, ContactRound, BookOpen, Wallet, Gift, School,
} from "lucide-react";

const NAV_ITEMS = {
  agency: [
    { label: "Overview", href: "/agency", icon: LayoutDashboard },
    { label: "Clients", href: "/agency/clients", icon: Users },
    { label: "Campaign Reporting", href: "/agency/campaign-reporting", icon: BarChart2 },
    { label: "CRM", href: "/agency/crm", icon: ContactRound },
    { label: "Freebies", href: "/agency/freebies", icon: Gift },
    { label: "Skool", href: "/agency/skool", icon: School },
    { label: "SOPs", href: "/agency/sops", icon: BookOpen },
    { label: "Team Payments", href: "/agency/team-payments", icon: Wallet },
    { label: "Settings", href: "/agency/settings", icon: Settings },
  ],
  agency_team: [
    { label: "Overview", href: "/agency", icon: LayoutDashboard },
    { label: "Clients", href: "/agency/clients", icon: Users },
    { label: "Campaign Reporting", href: "/agency/campaign-reporting", icon: BarChart2 },
    { label: "SOPs", href: "/agency/sops", icon: BookOpen },
    { label: "Settings", href: "/agency/settings", icon: Settings },
  ],
  client: [
    { label: "Dashboard", href: "/client", icon: LayoutDashboard },
    { label: "Settings", href: "/client/settings", icon: Settings },
  ],
  clipper: [
    { label: "SOPs", href: "/clipper/sops", icon: BookOpen },
  ],
};

interface SidebarProps {
  role: "agency" | "client" | "clipper";
  userName: string;
  isTeamMember?: boolean;
}

export default function Sidebar({ role, userName: userNameProp, isTeamMember }: SidebarProps) {
  const pathname = usePathname();
  const [userName, setUserName] = useState(userNameProp);
  const navKey = role === "agency" && isTeamMember ? "agency_team" : role;
  const navItems = NAV_ITEMS[navKey];
  const [agencyLogo, setAgencyLogo] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("agency_logo") : null
  );

  useEffect(() => {
    if (role !== "agency") return;
    fetch("/api/settings/logo").then((r) => r.json()).then((d) => {
      const logo = d.logoUrl ?? null;
      setAgencyLogo(logo);
      if (logo) localStorage.setItem("agency_logo", logo);
      else localStorage.removeItem("agency_logo");
    });
  }, [role]);

  useEffect(() => {
    fetch("/api/user/profile").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.name) setUserName(d.name);
    }).catch(() => {});
  }, []);

  const initials = userName.charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: 232,
        minWidth: 232,
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-subtle)",
        borderRight: "1px solid var(--border-subtle)",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px 24px", paddingTop: 24 }}>
        {/* Brand mark — glows with shadow-glow like the primary button */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: agencyLogo ? "transparent" : "var(--accent-solid)",
            boxShadow: agencyLogo ? undefined : "var(--shadow-glow)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {agencyLogo ? (
            <img src={agencyLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="white" />
              <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="white" opacity="0.55" />
              <circle cx="12" cy="9" r="1.5" fill="var(--accent-solid)" opacity="0.9" />
              <circle cx="12" cy="9" r="0.7" fill="white" />
              <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="white" />
              <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="white" opacity="0.8" />
              <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="white" opacity="0.8" />
              <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="#F5B544" opacity="0.95" />
            </svg>
          )}
        </div>
        <span style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          lineHeight: 1,
        }}>
          ClipLaunch
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                height: 40,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-muted)" : "transparent",
                textDecoration: "none",
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer — matches side-foot card from dashboard-example */}
      <div style={{ padding: "12px 8px 16px" }}>
        <div style={{
          padding: "12px",
          borderRadius: 14,
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent-muted)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userName}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.3 }}>
                {role === "agency" ? (isTeamMember ? "Team Member" : "Agency Admin") : role}
              </p>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              textDecoration: "none",
              transition: "color 120ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >
            Sign out
          </a>
        </div>
      </div>
    </aside>
  );
}
