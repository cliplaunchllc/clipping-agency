interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  accentColor?: string;
}

export default function StatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  accentColor = "var(--accent)",
}: StatCardProps) {
  const changeColors = {
    positive: "var(--success)",
    negative: "var(--danger)",
    neutral: "var(--text-tertiary)",
  };

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-inset-top)",
      }}
    >
      <div className="flex items-start justify-between">
        <p className="label-mono">
          {label}
        </p>
        {icon && (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
      </div>
      <p
        className="text-2xl metric-value leading-none"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      {change && (
        <p className="text-xs font-medium" style={{ color: changeColors[changeType] }}>
          {change}
        </p>
      )}
    </div>
  );
}
