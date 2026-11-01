interface Props {
  logoUrl: string | null;
  /** compact = small icon only (for nav bars); default = icon + wordmark */
  compact?: boolean;
}

export default function ClipLaunchLogo({ logoUrl, compact = false }: Props) {
  const iconSize = compact ? 28 : 36;

  const icon = logoUrl ? (
    <img
      src={logoUrl}
      alt="ClipLaunch"
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: 8,
        objectFit: "cover",
        border: "1px solid var(--border-default)",
        flexShrink: 0,
      }}
    />
  ) : (
    <div
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: 8,
        background: "var(--accent-muted)",
        border: "1px solid var(--accent-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={iconSize * 0.55} height={iconSize * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C9.5 4.5 8 8 8 12H16C16 8 14.5 4.5 12 2Z" fill="var(--accent)" />
        <path d="M12 2C10.8 3.5 9.8 5.5 9.2 8H12V2Z" fill="var(--accent)" opacity="0.5" />
        <circle cx="12" cy="9" r="1.5" fill="white" opacity="0.9" />
        <circle cx="12" cy="9" r="0.7" fill="var(--accent)" />
        <path d="M8 12H16V15.5C16 15.5 14 16.5 12 16.5C10 16.5 8 15.5 8 15.5V12Z" fill="var(--accent-solid)" />
        <path d="M8 12.5L5.5 15.5L8 15.5V12.5Z" fill="var(--accent-solid)" />
        <path d="M16 12.5L18.5 15.5L16 15.5V12.5Z" fill="var(--accent-solid)" />
        <path d="M10.5 16.5C10.5 16.5 11 18 12 19.5C13 18 13.5 16.5 13.5 16.5H10.5Z" fill="var(--warning)" opacity="0.9" />
      </svg>
    </div>
  );

  if (compact) return icon;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {icon}
      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
        ClipLaunch
      </span>
    </div>
  );
}
