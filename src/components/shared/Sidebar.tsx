"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  role: "agency" | "clipper" | "client";
  userName: string;
  navItems: NavItem[];
}

export default function Sidebar({ role, userName, navItems }: SidebarProps) {
  const pathname = usePathname();

  const roleColors: Record<string, string> = {
    agency: "#FF3B3B",
    clipper: "#3DFFA2",
    client: "#a78bfa",
  };

  const roleLabels: Record<string, string> = {
    agency: "Agency Admin",
    clipper: "Clipper",
    client: "Client",
  };

  return (
    <aside
      className="w-60 flex flex-col h-screen fixed left-0 top-0 z-40"
      style={{
        background: "#0B0E17",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,59,59,0.15)", border: "1px solid rgba(255,59,59,0.3)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
        <span
          className="font-semibold text-sm"
          style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}
        >
          ClipLaunch
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                color: isActive ? roleColors[role] : "#8A93A6",
                background: isActive ? `${roleColors[role]}14` : "transparent",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: `${roleColors[role]}22`, color: roleColors[role] }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "#F5F6FA" }}>
              {userName}
            </p>
            <p className="text-xs" style={{ color: "#8A93A6" }}>
              {roleLabels[role]}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs py-2 px-3 rounded-lg text-left transition-colors"
          style={{ color: "#8A93A6", background: "rgba(255,255,255,0.04)" }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
