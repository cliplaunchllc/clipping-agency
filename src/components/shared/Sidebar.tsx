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
    agency: "#5AC8FA",
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
          style={{ background: "rgba(90,200,250,0.15)", border: "1px solid rgba(90,200,250,0.3)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="#5AC8FA"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          className="font-semibold text-sm"
          style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}
        >
          ClipFlow
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
