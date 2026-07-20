import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeStats,
  detectLink,
  initTransport,
  runDownloadStress,
  runGameTicks,
  runUploadStress,
} from "@/lib/diagnostic/engine";
import { buildVerdict } from "@/lib/diagnostic/verdict";
import type { DiagnosticResult, Phase, PingSample, SpeedSample } from "@/lib/diagnostic/types";
import { LivePingChart } from "@/components/diagnostic/LivePingChart";
import { MetricGauge } from "@/components/diagnostic/MetricGauge";
import { PhaseRail } from "@/components/diagnostic/PhaseRail";
import { VerdictPanel } from "@/components/diagnostic/VerdictPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova Latency — Esport Network & Bufferbloat Analyzer" },
      {
        name: "description",
        content:
          "Cyberpunk-grade PUBG Mobile netcode simulator: 60ms UDP-style ticks, 3-phase bufferbloat stress test, jitter & packet-loss detection with AI health verdict.",
      },
      { property: "og:title", content: "Nova Latency — Esport Network Diagnostic" },
      {
        property: "og:description",
        content:
          "See why your ping spikes in PUBG Mobile even when speed tests look fine. Real bufferbloat, jitter and micro-loss analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface LiveState {
  phase: Phase;
  phaseLabel: string;
  downMbps: number;
  upMbps: number;
  currentPing: number;
  currentJitter: number;
  loss: number;
  baselineMedian: number;
}

function Index() {
  const [samples, setSamples] = useState<PingSample[]>([]);
  const [live, setLive] = useState<LiveState>({
    phase: "idle",
    phaseLabel: "Standby",
    downMbps: 0,
    upMbps: 0,
    currentPing: 0,
    currentJitter: 0,
    loss: 0,
    baselineMedian: 0,
  });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const samplesRef = useRef<PingSample[]>([]);
  const rafRef = useRef<number | null>(null);
  const pendingLive = useRef<Partial<LiveState>>({});

  const pushLog = useCallback((msg: string) => {
    setLog((l) => [...l.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setSamples([...samplesRef.current]);
      if (Object.keys(pendingLive.current).length) {
        setLive((s) => ({ ...s, ...pendingLive.current }));
        pendingLive.current = {};
      }
    });
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setSamples([]);
    samplesRef.current = [];
    setLog([]);
    const ac = new AbortController();
    abortRef.current = ac;
    const startedAt = performance.now();
    let currentPhase: Phase = "idle";

    const ev = {
      onPing: (s: PingSample) => {
        samplesRef.current.push(s);
        // rolling jitter over last 20
        const tail = samplesRef.current.slice(-20).filter((x) => !x.lost);
        let jSum = 0;
        for (let i = 1; i < tail.length; i++) jSum += Math.abs(tail[i].rtt - tail[i - 1].rtt);
        const jitter = tail.length > 1 ? jSum / (tail.length - 1) : 0;
        const lostCount = samplesRef.current.slice(-100).filter((x) => x.lost).length;
        pendingLive.current = {
          ...pendingLive.current,
          currentPing: +s.rtt.toFixed(1),
          currentJitter: +jitter.toFixed(2),
          loss: +(lostCount / Math.min(100, samplesRef.current.length)).toFixed(4),
        };
        scheduleFlush();
      },
      onSpeed: (s: SpeedSample) => {
        if (currentPhase === "download") pendingLive.current.downMbps = +s.mbps.toFixed(1);
        if (currentPhase === "upload") pendingLive.current.upMbps = +s.mbps.toFixed(1);
        scheduleFlush();
      },
      onPhase: (p: Phase, label: string) => {
        currentPhase = p;
        pendingLive.current.phase = p;
        pendingLive.current.phaseLabel = label;
        scheduleFlush();
        pushLog(label);
      },
      onLog: pushLog,
    };

    try {
      // Init transport: WebTransport datagrams if available, otherwise HEAD fallback.
      const transport = await initTransport(ev, ac.signal);
      // Continuous game-tick loop through all phases
      const tickPromise = runGameTicks(startedAt, () => currentPhase, ev, ac.signal, transport, 60);

      // Phase 1: Idle 6s
      ev.onPhase("idle", "PHASE 01 · Idle baseline (6s)");
      await new Promise((r) => setTimeout(r, 6000));
      const idleSamples = samplesRef.current.slice();
      const baselineStats = computeStats(idleSamples);
      pendingLive.current.baselineMedian = baselineStats.medianPing;
      scheduleFlush();
      pushLog(`Baseline: ${baselineStats.medianPing}ms · jitter ${baselineStats.jitter}ms · loss ${(baselineStats.loss * 100).toFixed(2)}%`);

      // Phase 2: Download stress 10s
      ev.onPhase("download", "PHASE 02 · Download stress (10s) — 6 parallel streams");
      const downCountStart = samplesRef.current.length;
      const peakDown = await runDownloadStress(10000, ev, ac.signal, startedAt);
      const downSamples = samplesRef.current.slice(downCountStart);
      const loadedDownStats = computeStats(downSamples);
      pushLog(`Loaded ↓ ping: ${loadedDownStats.medianPing}ms · peak ${peakDown.toFixed(1)} Mbps`);

      // brief cooldown 1.5s
      ev.onPhase("idle", "Cooldown between phases");
      await new Promise((r) => setTimeout(r, 1500));

      // Phase 3: Upload stress 10s
      ev.onPhase("upload", "PHASE 03 · Upload stress (10s) — the critical one");
      const upCountStart = samplesRef.current.length;
      const peakUp = await runUploadStress(10000, ev, ac.signal, startedAt);
      const upSamples = samplesRef.current.slice(upCountStart);
      const loadedUpStats = computeStats(upSamples);
      pushLog(`Loaded ↑ ping: ${loadedUpStats.medianPing}ms · peak ${peakUp.toFixed(1)} Mbps`);

      ev.onPhase("done", "Diagnostic complete — building verdict");
      ac.abort();
      await tickPromise.catch(() => {});
      transport.close();

      const link = detectLink(baselineStats.jitter, baselineStats.loss);
      const verdict = buildVerdict(
        baselineStats,
        loadedDownStats,
        loadedUpStats,
        peakDown,
        peakUp,
        link,
      );
      setResult(verdict);
      pushLog(`Grade ${verdict.grade} (${verdict.score}/100)`);
    } catch (e) {
      pushLog("Aborted: " + (e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [running, pushLog, scheduleFlush]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    pushLog("Manually aborted.");
  }, [pushLog]);

  const jitterAlert = live.currentJitter > 3;

  return (
    <div className="grid-bg min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              Nova Latency // Esports Ops
            </div>
            <h1 className="mt-1 font-display text-3xl md:text-5xl">
              <span className="neon-cyan">Bufferbloat</span> &{" "}
              <span className="neon-magenta">Netcode</span> Analyzer
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Gerçek ölçüm motoru: WebTransport / QUIC üzerinden 60ms tick RTT probe'ları,
              Cloudflare'e çoklu-thread gerçek indirme &amp; yükleme (Mbps), 3 fazlı bufferbloat
              stres testi ve mikro paket-kaybı tespiti — hız testinin yalan söylediği oyuncular için.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-hairline px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              Live Measurement
            </span>
            {!running ? (
              <button
                onClick={start}
                className="glow-cyan rounded-md border border-neon-cyan/60 bg-transparent px-6 py-3 font-display text-sm uppercase tracking-[0.25em] text-neon-cyan transition hover:bg-neon-cyan/10"
                style={{ color: "var(--neon-cyan)", borderColor: "color-mix(in oklab, var(--neon-cyan) 60%, transparent)" }}
              >
                ▶ Initiate Diagnostic
              </button>
            ) : (
              <button
                onClick={stop}
                className="rounded-md border px-6 py-3 font-display text-sm uppercase tracking-[0.25em]"
                style={{ color: "var(--neon-red)", borderColor: "color-mix(in oklab, var(--neon-red) 60%, transparent)" }}
              >
                ■ Abort
              </button>
            )}
          </div>
        </header>

        {/* Phase rail */}
        <div className="mb-4">
          <PhaseRail current={live.phase} />
        </div>

        {/* Metric gauges */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricGauge label="Download" value={live.downMbps.toFixed(1)} unit="Mbps" color="magenta" />
          <MetricGauge label="Upload" value={live.upMbps.toFixed(1)} unit="Mbps" color="lime" />
          <MetricGauge
            label="Game Ping"
            value={live.currentPing.toFixed(0)}
            unit="ms"
            color="cyan"
            hint={`baseline ${live.baselineMedian || "—"}ms`}
          />
          <MetricGauge
            label="Jitter (20-tick)"
            value={live.currentJitter.toFixed(2)}
            unit="ms"
            color={jitterAlert ? "red" : "cyan"}
            alert={jitterAlert}
            hint={jitterAlert ? "⚠ > 3ms threshold" : "within esport tolerance"}
          />
          <MetricGauge
            label="Micro Loss"
            value={(live.loss * 100).toFixed(2)}
            unit="%"
            color={live.loss > 0.01 ? "red" : "amber"}
            alert={live.loss > 0.01}
          />
        </div>

        {/* Chart */}
        <div className="mb-4">
          <LivePingChart samples={samples} baselineMedian={live.baselineMedian} />
        </div>

        {/* Verdict or log */}
        {result ? (
          <div className="mb-4">
            <VerdictPanel result={result} />
          </div>
        ) : (
          <div className="panel mb-4 p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <span>System Log</span>
              <span>{live.phaseLabel}</span>
            </div>
            <div className="max-h-48 overflow-auto font-mono text-xs leading-relaxed text-foreground/80">
              {log.length === 0 ? (
                <div className="text-muted-foreground">
                  Standing by. Press <span className="neon-cyan">Initiate Diagnostic</span> to
                  begin the 3-phase protocol. Test takes ~30 seconds.
                </div>
              ) : (
                log.map((l, i) => <div key={i}>&gt; {l}</div>)
              )}
            </div>
          </div>
        )}

        <footer className="pt-4 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Nova Latency · Built for competitive mobile · Endpoints via speed.cloudflare.com
        </footer>
      </div>
    </div>
  );
}
