import { useMemo } from "react";
import type { PingSample } from "@/lib/diagnostic/types";

interface Props {
  samples: PingSample[];
  baselineMedian: number;
  height?: number;
  windowMs?: number;
}

export function LivePingChart({ samples, baselineMedian, height = 220, windowMs = 30000 }: Props) {
  const width = 900;

  const { path, spikes, maxY, minT, maxT, phaseBands } = useMemo(() => {
    if (samples.length === 0) {
      return { path: "", spikes: [] as PingSample[], maxY: 100, minT: 0, maxT: windowMs, phaseBands: [] as { x1: number; x2: number; phase: string }[] };
    }
    const last = samples[samples.length - 1].t;
    const minT = Math.max(0, last - windowMs);
    const visible = samples.filter((s) => s.t >= minT);
    const maxY = Math.max(80, ...visible.map((s) => Math.min(600, s.rtt)) , baselineMedian * 3);
    const maxT = minT + windowMs;

    const x = (t: number) => ((t - minT) / (maxT - minT)) * width;
    const y = (rtt: number) => height - (Math.min(rtt, maxY) / maxY) * (height - 20) - 10;

    let path = "";
    visible.forEach((s, i) => {
      const px = x(s.t);
      const py = y(s.rtt);
      path += (i === 0 ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1) + " ";
    });

    const threshold = Math.max(baselineMedian * 2, baselineMedian + 30);
    const spikes = visible.filter((s) => s.rtt >= threshold || s.lost);

    // phase bands
    const bands: { x1: number; x2: number; phase: string }[] = [];
    let cur: { x1: number; phase: string } | null = null;
    for (const s of visible) {
      if (!cur || cur.phase !== s.phase) {
        if (cur) bands.push({ x1: cur.x1, x2: x(s.t), phase: cur.phase });
        cur = { x1: x(s.t), phase: s.phase };
      }
    }
    if (cur) bands.push({ x1: cur.x1, x2: width, phase: cur.phase });

    return { path, spikes: spikes.map((s) => ({ ...s, _x: x(s.t) } as PingSample & { _x: number })), maxY, minT, maxT, phaseBands: bands };
  }, [samples, baselineMedian, windowMs, height]);

  const phaseColor: Record<string, string> = {
    idle: "var(--neon-cyan)",
    warmup: "var(--neon-cyan)",
    download: "var(--neon-magenta)",
    upload: "var(--neon-lime)",
    done: "var(--muted-foreground)",
  };

  return (
    <div className="scanline panel p-4">
      <div className="scanline-bar" />
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>Live Ping — 60ms Tick (PUBG Netcode Sim)</span>
        <span>window {(windowMs / 1000).toFixed(0)}s · max {Math.round(maxY)}ms</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {/* grid */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={0}
            x2={width}
            y1={height * r}
            y2={height * r}
            stroke="var(--hairline)"
            strokeDasharray="2 4"
          />
        ))}
        {/* phase bands */}
        {phaseBands.map((b, i) => (
          <rect
            key={i}
            x={b.x1}
            y={0}
            width={Math.max(0, b.x2 - b.x1)}
            height={height}
            fill={phaseColor[b.phase] || "transparent"}
            opacity={0.05}
          />
        ))}
        {/* baseline reference line */}
        {baselineMedian > 0 && (
          <line
            x1={0}
            x2={width}
            y1={height - (baselineMedian / (Math.max(80, baselineMedian * 3))) * (height - 20) - 10}
            y2={height - (baselineMedian / (Math.max(80, baselineMedian * 3))) * (height - 20) - 10}
            stroke="var(--neon-cyan)"
            strokeDasharray="4 4"
            opacity={0.4}
          />
        )}
        {/* spike lines */}
        {spikes.map((s, i) => {
          const sx = (s as PingSample & { _x: number })._x;
          return (
            <line
              key={i}
              x1={sx}
              x2={sx}
              y1={0}
              y2={height}
              stroke="var(--neon-red)"
              strokeWidth={1}
              opacity={0.55}
            />
          );
        })}
        {/* main path */}
        <path
          d={path}
          fill="none"
          stroke="var(--neon-cyan)"
          strokeWidth={1.6}
          style={{ filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--neon-cyan) 60%, transparent))" }}
        />
      </svg>
      <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Legend color="var(--neon-cyan)" label="Idle" />
        <Legend color="var(--neon-magenta)" label="Download Stress" />
        <Legend color="var(--neon-lime)" label="Upload Stress" />
        <Legend color="var(--neon-red)" label="Spike / Loss" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}
