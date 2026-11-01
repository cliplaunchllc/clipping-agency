"use client";

export const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#FF3B3B",
  instagram: "#FF8800",
  youtube: "#CC1A1A",
  twitter: "#5B9BD5",
  other: "#6B7280",
};

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X / Twitter",
  other: "Other",
};

export function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const r = Math.round(size * 0.25);

  if (platform === "tiktok") return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#000000" />
      <path fill="white" d="M22.5 8.5c0 2.5 1.8 4.5 4.5 4.8v3.5c-1.6 0-3.1-.5-4.5-1.4v6.4c0 3.6-2.9 6.5-6.5 6.5S9.5 25.4 9.5 21.8s2.9-6.5 6.5-6.5c.4 0 .7 0 1 .1v3.6c-.3-.1-.7-.1-1-.1-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3V5h3.5c0 1.9 1.5 3.4 3.5 3.5z" />
    </svg>
  );

  if (platform === "instagram") return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="20%" stopColor="#fd5949" />
          <stop offset="55%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#ig-grad)" />
      <rect x="8" y="8" width="16" height="16" rx="4.5" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="21.5" cy="10.5" r="1.3" fill="white" />
    </svg>
  );

  if (platform === "youtube") return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#FF0000" />
      <path fill="white" d="M22.8 11.6a2.2 2.2 0 00-1.5-1.5C20 9.7 16 9.7 16 9.7s-4 0-5.3.4a2.2 2.2 0 00-1.5 1.5C8.8 12.9 8.8 16 8.8 16s0 3.1.4 4.4a2.2 2.2 0 001.5 1.5c1.3.4 5.3.4 5.3.4s4 0 5.3-.4a2.2 2.2 0 001.5-1.5c.4-1.3.4-4.4.4-4.4s0-3.1-.4-4.4zM14.2 18.5v-5l4.6 2.5-4.6 2.5z" />
    </svg>
  );

  if (platform === "twitter") return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#1A1A2E" />
      <path fill="#E2E8F0" d="M22 9h-2.8l-3.6 4.1L12.2 9H7l5.8 7.7L7.2 23H10l3.9-4.4 3.5 4.4H23l-6-8 4.9-6z" />
    </svg>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx={r} fill="#1E2030" />
      <text x="16" y="21" textAnchor="middle" fill="#6B7280" fontSize="14" fontWeight="bold">?</text>
    </svg>
  );
}
