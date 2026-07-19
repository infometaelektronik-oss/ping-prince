export type Phase = "idle" | "warmup" | "download" | "upload" | "done";

export interface PingSample {
  t: number; // ms since start
  rtt: number; // ms
  phase: Phase;
  lost?: boolean;
}

export interface SpeedSample {
  t: number;
  mbps: number;
}

export interface LinkInfo {
  effectiveType?: string;
  downlinkMbps?: number;
  rttMs?: number;
  saveData?: boolean;
  kind: "ethernet-like" | "wifi-5ghz-like" | "wifi-2.4ghz-like" | "cellular" | "unknown";
  reason: string;
}

export interface PhaseStats {
  avgPing: number;
  medianPing: number;
  p95Ping: number;
  jitter: number;
  loss: number; // 0..1
  samples: number;
}

export interface DiagnosticResult {
  baseline: PhaseStats;
  loadedDown: PhaseStats;
  loadedUp: PhaseStats;
  downloadMbps: number;
  uploadMbps: number;
  bufferbloatDownMs: number;
  bufferbloatUpMs: number;
  link: LinkInfo;
  grade: "A+" | "A" | "B" | "C" | "D";
  score: number;
  verdict: {
    pubgVerdict: string;
    rootCause: string;
    recommendations: string[];
  };
}
