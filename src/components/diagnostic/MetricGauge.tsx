interface Props {
  label: string;
  value: string | number;
  unit?: string;
  color?: "cyan" | "magenta" | "lime" | "red" | "amber";
  hint?: string;
  alert?: boolean;
}

const colorMap = {
  cyan: "var(--neon-cyan)",
  magenta: "var(--neon-magenta)",
  lime: "var(--neon-lime)",
  red: "var(--neon-red)",
  amber: "var(--neon-amber)",
};

export function MetricGauge({ label, value, unit, color = "cyan", hint, alert }: Props) {
  const c = colorMap[color];
  return (
    <div className={"panel p-4 " + (alert ? "alert-pulse" : "")}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="font-display text-3xl md:text-4xl tabular-nums"
          style={{ color: c, textShadow: `0 0 14px color-mix(in oklab, ${c} 55%, transparent)` }}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
