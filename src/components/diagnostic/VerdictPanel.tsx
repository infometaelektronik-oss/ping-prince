import type { DiagnosticResult } from "@/lib/diagnostic/types";

const gradeColor: Record<DiagnosticResult["grade"], string> = {
  "A+": "var(--neon-lime)",
  A: "var(--neon-lime)",
  B: "var(--neon-cyan)",
  C: "var(--neon-amber)",
  D: "var(--neon-red)",
};

export function VerdictPanel({ result }: { result: DiagnosticResult }) {
  const c = gradeColor[result.grade];
  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Nova AI · Network Health Verdict
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <span
              className="font-display text-7xl leading-none"
              style={{ color: c, textShadow: `0 0 24px color-mix(in oklab, ${c} 60%, transparent)` }}
            >
              {result.grade}
            </span>
            <span className="font-display text-2xl text-foreground/80 tabular-nums">
              {result.score}
              <span className="text-sm text-muted-foreground"> /100</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Row k="Baseline ping" v={`${result.baseline.medianPing} ms`} />
          <Row k="Baseline jitter" v={`${result.baseline.jitter} ms`} />
          <Row k="Loaded ping (down)" v={`${result.loadedDown.medianPing} ms`} />
          <Row k="Loaded ping (up)" v={`${result.loadedUp.medianPing} ms`} />
          <Row k="Bufferbloat ↓" v={`+${result.bufferbloatDownMs} ms`} />
          <Row k="Bufferbloat ↑" v={`+${result.bufferbloatUpMs} ms`} />
          <Row k="Micro packet loss" v={`${(Math.max(result.baseline.loss, result.loadedDown.loss, result.loadedUp.loss) * 100).toFixed(2)}%`} />
          <Row k="Link" v={result.link.kind} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="PUBG Mobile Verdict" accent="var(--neon-magenta)" body={result.verdict.pubgVerdict} />
        <Card title="Root Cause Analysis" accent="var(--neon-cyan)" body={result.verdict.rootCause} />
        <div className="panel p-4" style={{ borderColor: "color-mix(in oklab, var(--neon-lime) 40%, var(--hairline))" }}>
          <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--neon-lime)" }}>
            Recommended Actions
          </div>
          <ol className="mt-2 space-y-2 text-sm">
            {result.verdict.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-display" style={{ color: "var(--neon-lime)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-foreground/90">{r}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground">{result.link.reason}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-mono tabular-nums text-foreground">{v}</span>
    </>
  );
}

function Card({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div className="panel p-4" style={{ borderColor: `color-mix(in oklab, ${accent} 40%, var(--hairline))` }}>
      <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}
