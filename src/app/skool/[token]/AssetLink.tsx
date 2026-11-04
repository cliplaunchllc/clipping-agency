"use client";

import { FileBox } from "lucide-react";

export default function AssetLink({ name, url, description }: {
  name: string;
  url: string;
  description: string | null;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        transition: "border-color 120ms ease",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent-border)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-default)"; }}
    >
      <FileBox size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{name}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>
        )}
      </div>
    </a>
  );
}
