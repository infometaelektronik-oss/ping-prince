import type { Phase } from "@/lib/diagnostic/types";

const steps: { key: Phase; label: string; sub: string }[] = [
  { key: "idle", label: "Phase 01", sub: "Idle Baseline" },
  { key: "download", label: "Phase 02", sub: "Download Stress" },
  { key: "upload", label: "Phase 03", sub: "Upload Stress" },
];

export function PhaseRail({ current }: { current: Phase }) {
  const order: Phase[] = ["idle", "download", "upload", "done"];
  const idx = order.indexOf(current);
  return (
    <div className="panel p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        3-Phase Bufferbloat Protocol
      </div>
      <div className="flex items-stretch gap-2">
        {steps.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "active" : "pending";
          const c =
            state === "active"
              ? "var(--neon-magenta)"
              : state === "done"
              ? "var(--neon-lime)"
              : "var(--hairline)";
          return (
            <div key={s.key} className="flex-1">
              <div className="h-1 w-full rounded-full" style={{ background: c, boxShadow: state === "active" ? `0 0 12px ${c}` : "none" }} />
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-xs" style={{ color: c }}>{s.label}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{state}</span>
              </div>
              <div className="text-sm text-foreground/90">{s.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
