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
  accentColor = "#5AC8FA",
}: StatCardProps) {
  const changeColors = {
    positive: "#3DFFA2",
    negative: "#FF4757",
    neutral: "#8A93A6",
  };

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        background: "#0B0E17",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#8A93A6" }}>
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}18` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold" style={{ color: "#F5F6FA", fontFamily: "Space Grotesk, sans-serif" }}>
        {value}
      </p>
      {change && (
        <p className="text-xs" style={{ color: changeColors[changeType] }}>
          {change}
        </p>
      )}
    </div>
  );
}
