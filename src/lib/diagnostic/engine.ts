import type { LinkInfo, Phase, PhaseStats, PingSample, SpeedSample } from "./types";

// Cloudflare's public speed endpoints — CORS-open, anycast worldwide.
const DOWN_URL = (bytes: number) => `https://speed.cloudflare.com/__down?bytes=${bytes}`;
const UP_URL = "https://speed.cloudflare.com/__up";
const PING_URL = "https://speed.cloudflare.com/__down?bytes=0";

// Optional WebTransport datagram echo endpoint (QUIC / HTTP/3).
// Can be overridden at runtime via window.__NOVA_WT_URL for private deployments.
// A public echo host is not universally available; if the handshake or first
// datagram round-trip fails, the engine transparently falls back to HEAD fetch.
const DEFAULT_WT_URL = "https://echo.webtransport.day/";

export interface EngineEvents {
  onPing: (s: PingSample) => void;
  onSpeed: (s: SpeedSample) => void;
  onPhase: (p: Phase, label: string) => void;
  onLog: (msg: string) => void;
}

const now = () => performance.now();

// ————————————————————————————————————————————————————————————————
// Transport layer: WebTransport datagrams (preferred) → fetch HEAD fallback
// ————————————————————————————————————————————————————————————————

type Transport =
  | { kind: "webtransport"; sendPing: () => Promise<number>; close: () => void; label: string }
  | { kind: "fetch-head"; sendPing: () => Promise<number>; close: () => void; label: string };

interface WTGlobal {
  WebTransport?: new (url: string) => {
    ready: Promise<void>;
    closed: Promise<unknown>;
    datagrams: {
      readable: ReadableStream<Uint8Array>;
      writable: WritableStream<Uint8Array>;
    };
    close(): void;
  };
  __NOVA_WT_URL?: string;
}

async function tryWebTransport(signal: AbortSignal): Promise<Transport | null> {
  const g = globalThis as unknown as WTGlobal;
  if (typeof g.WebTransport !== "function") return null;
  const url = g.__NOVA_WT_URL || DEFAULT_WT_URL;
  try {
    const wt = new g.WebTransport(url);
    // Race handshake against a short timeout so we don't stall the whole test.
    await Promise.race([
      wt.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error("wt-handshake-timeout")), 1500)),
    ]);

    const writer = wt.datagrams.writable.getWriter();
    const reader = wt.datagrams.readable.getReader();

    // Sequence-tagged payloads so out-of-order echoes still resolve correctly.
    let seq = 0;
    const pending = new Map<number, (rtt: number) => void>();
    const sentAt = new Map<number, number>();

    // Background reader loop — resolves pending promises as datagrams echo back.
    (async () => {
      try {
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done || !value || value.byteLength < 4) continue;
          const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
          const echoSeq = view.getUint32(0, true);
          const resolve = pending.get(echoSeq);
          const t0 = sentAt.get(echoSeq);
          if (resolve && t0 != null) {
            pending.delete(echoSeq);
            sentAt.delete(echoSeq);
            resolve(now() - t0);
          }
        }
      } catch {
        /* connection closed */
      }
    })();

    // Verify the echo actually works before committing to this transport.
    const verify = new Promise<number>((resolve, reject) => {
      const s = seq++;
      const payload = new Uint8Array(64);
      new DataView(payload.buffer).setUint32(0, s, true);
      sentAt.set(s, now());
      pending.set(s, resolve);
      writer.write(payload).catch(reject);
      setTimeout(() => {
        if (pending.delete(s)) reject(new Error("wt-verify-timeout"));
      }, 1200);
    });
    await verify;

    const sendPing = () =>
      new Promise<number>((resolve) => {
        const s = seq++;
        // PUBG Mobile netcode: 64-byte UDP payload per 60ms tick.
        const payload = new Uint8Array(64);
        const dv = new DataView(payload.buffer);
        dv.setUint32(0, s, true);
        dv.setFloat64(4, now(), true);
        sentAt.set(s, now());
        pending.set(s, resolve);
        writer.write(payload).catch(() => {
          pending.delete(s);
          sentAt.delete(s);
          resolve(999);
        });
        // 500ms timeout = considered lost (esport-tier tolerance).
        setTimeout(() => {
          if (pending.delete(s)) {
            sentAt.delete(s);
            resolve(999);
          }
        }, 500);
      });

    return {
      kind: "webtransport",
      label: `WebTransport datagrams (QUIC/HTTP3) → ${new URL(url).host}`,
      sendPing,
      close: () => {
        try { writer.releaseLock(); } catch { /* noop */ }
        try { reader.releaseLock(); } catch { /* noop */ }
        try { wt.close(); } catch { /* noop */ }
      },
    };
  } catch {
    return null;
  }
}

function makeFetchHeadTransport(): Transport {
  // 64-byte HEAD probes emulate a PUBG-style UDP tick over TCP/QUIC HTTP.
  return {
    kind: "fetch-head",
    label: "Fetch HEAD 64B → speed.cloudflare.com",
    sendPing: async () => {
      const t0 = now();
      try {
        await fetch(PING_URL + "&r=" + Math.random().toString(36).slice(2), {
          method: "HEAD",
          cache: "no-store",
          keepalive: false,
        });
        return now() - t0;
      } catch {
        return 999;
      }
    },
    close: () => {},
  };
}

export async function initTransport(
  ev: EngineEvents,
  signal: AbortSignal,
): Promise<Transport> {
  const wt = await tryWebTransport(signal);
  if (wt) {
    ev.onLog(`Transport: ${wt.label}`);
    return wt;
  }
  const fb = makeFetchHeadTransport();
  ev.onLog(`Transport: ${fb.label} (WebTransport unavailable — using HEAD fallback)`);
  return fb;
}

// 60ms tick game simulation loop. Runs until signal aborts.
export async function runGameTicks(
  startedAt: number,
  getPhase: () => Phase,
  ev: EngineEvents,
  signal: AbortSignal,
  transport: Transport,
  intervalMs = 60,
): Promise<PingSample[]> {
  const out: PingSample[] = [];
  let next = now();
  while (!signal.aborted) {
    const t0 = now();
    const rtt = await transport.sendPing();
    if (signal.aborted) break;
    const lost = rtt >= 500;
    const sample: PingSample = {
      t: t0 - startedAt,
      rtt: lost ? 999 : rtt,
      phase: getPhase(),
      lost: lost || undefined,
    };
    out.push(sample);
    ev.onPing(sample);
    next += intervalMs;
    const wait = next - now();
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    } else {
      next = now();
    }
  }
  return out;
}


// ————————————————————————————————————————————————————————————————
// DOWNLOAD: 6 parallel streaming fetches, live byte accounting every 200ms.
// ————————————————————————————————————————————————————————————————

async function downloadStream(
  bytes: number,
  signal: AbortSignal,
  onBytes: (n: number) => void,
) {
  const url = DOWN_URL(bytes) + "&r=" + Math.random().toString(36).slice(2);
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok || !res.body) throw new Error("download stream failed: " + res.status);
  const reader = res.body.getReader();
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) onBytes(value.byteLength);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

export async function runDownloadStress(
  durationMs: number,
  ev: EngineEvents,
  signal: AbortSignal,
  startedAt: number,
): Promise<number> {
  const streams = 6;
  // Request 250MB per stream — Cloudflare returns it fully; we abort by signal.
  const chunk = 250 * 1024 * 1024;

  let totalBytes = 0;
  let windowBytes = 0;
  let windowStart = now();
  let peak = 0;

  const onBytes = (n: number) => {
    totalBytes += n;
    windowBytes += n;
    const t = now();
    const dt = t - windowStart;
    if (dt >= 200) {
      const mbps = (windowBytes * 8) / (dt / 1000) / 1_000_000;
      if (mbps > peak) peak = mbps;
      ev.onSpeed({ t: t - startedAt, mbps });
      windowBytes = 0;
      windowStart = t;
    }
  };

  // Local abort fires at end of window, cancelling in-flight fetches immediately.
  const localAc = new AbortController();
  const onParentAbort = () => localAc.abort();
  signal.addEventListener("abort", onParentAbort);
  const timer = setTimeout(() => localAc.abort(), durationMs);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) {
    workers.push(
      (async () => {
        while (!localAc.signal.aborted) {
          try {
            await downloadStream(chunk, localAc.signal, onBytes);
          } catch {
            if (localAc.signal.aborted) break;
            // brief backoff on transient failure, then retry
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      })(),
    );
  }

  await Promise.allSettled(workers);
  clearTimeout(timer);
  signal.removeEventListener("abort", onParentAbort);

  const totalMs = now() - windowStart + (now() - startedAt - (now() - windowStart));
  void totalMs; // unused; kept for potential future averaging
  ev.onLog(
    `Download complete: ${(totalBytes / 1_000_000).toFixed(1)} MB total · peak ${peak.toFixed(1)} Mbps`,
  );
  return peak;
}

// ————————————————————————————————————————————————————————————————
// UPLOAD: XHR with upload.onprogress for real live byte counters.
// fetch() cannot report upload progress in browsers without streams+duplex
// (Chromium-only + HTTP/2 required). XHR works everywhere.
// ————————————————————————————————————————————————————————————————

function xhrUpload(
  url: string,
  body: Uint8Array,
  signal: AbortSignal,
  onProgress: (delta: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      const delta = e.loaded - lastLoaded;
      lastLoaded = e.loaded;
      if (delta > 0) onProgress(delta);
    };
    xhr.onload = () => resolve();
    xhr.onerror = () => reject(new Error("upload xhr error"));
    xhr.onabort = () => reject(new Error("upload aborted"));
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", onAbort);
    try {
      xhr.send(body.buffer as ArrayBuffer);
    } catch (e) {
      reject(e as Error);
    }
  });
}

export async function runUploadStress(
  durationMs: number,
  ev: EngineEvents,
  signal: AbortSignal,
  startedAt: number,
): Promise<number> {
  const streams = 4;
  // 8MB per request — long enough for onprogress to tick many times.
  const chunkSize = 8 * 1024 * 1024;
  const payload = new Uint8Array(chunkSize);
  // getRandomValues caps at 65536 bytes; fill the head, rest can stay zero
  // (Cloudflare __up doesn't compress the body — bytes on wire == payload size).
  crypto.getRandomValues(payload.subarray(0, 65536));

  let totalBytes = 0;
  let windowBytes = 0;
  let windowStart = now();
  let peak = 0;

  const onProgress = (delta: number) => {
    totalBytes += delta;
    windowBytes += delta;
    const t = now();
    const dt = t - windowStart;
    if (dt >= 200) {
      const mbps = (windowBytes * 8) / (dt / 1000) / 1_000_000;
      if (mbps > peak) peak = mbps;
      ev.onSpeed({ t: t - startedAt, mbps });
      windowBytes = 0;
      windowStart = t;
    }
  };

  const localAc = new AbortController();
  const onParentAbort = () => localAc.abort();
  signal.addEventListener("abort", onParentAbort);
  const timer = setTimeout(() => localAc.abort(), durationMs);

  const workers: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) {
    workers.push(
      (async () => {
        while (!localAc.signal.aborted) {
          try {
            await xhrUpload(UP_URL, payload, localAc.signal, onProgress);
          } catch {
            if (localAc.signal.aborted) break;
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      })(),
    );
  }

  await Promise.allSettled(workers);
  clearTimeout(timer);
  signal.removeEventListener("abort", onParentAbort);

  ev.onLog(
    `Upload complete: ${(totalBytes / 1_000_000).toFixed(1)} MB total · peak ${peak.toFixed(1)} Mbps`,
  );
  return peak;
}

export function computeStats(samples: PingSample[]): PhaseStats {
  if (samples.length === 0) {
    return { avgPing: 0, medianPing: 0, p95Ping: 0, jitter: 0, loss: 0, samples: 0 };
  }
  const kept = samples.filter((s) => !s.lost).map((s) => s.rtt);
  const lost = samples.filter((s) => s.lost).length;
  const loss = lost / samples.length;
  if (kept.length === 0) {
    return { avgPing: 999, medianPing: 999, p95Ping: 999, jitter: 0, loss, samples: samples.length };
  }
  const sorted = [...kept].sort((a, b) => a - b);
  const avg = kept.reduce((a, b) => a + b, 0) / kept.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  // Jitter = mean absolute successive difference
  let jSum = 0;
  for (let i = 1; i < kept.length; i++) jSum += Math.abs(kept[i] - kept[i - 1]);
  const jitter = kept.length > 1 ? jSum / (kept.length - 1) : 0;
  return {
    avgPing: +avg.toFixed(2),
    medianPing: +median.toFixed(2),
    p95Ping: +p95.toFixed(2),
    jitter: +jitter.toFixed(2),
    loss: +loss.toFixed(4),
    samples: samples.length,
  };
}

export function detectLink(baselineJitter: number, baselineLoss: number): LinkInfo {
  const nav = (typeof navigator !== "undefined" ? (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection : undefined);
  const eff = nav?.effectiveType;
  const dl = nav?.downlink;
  const rtt = nav?.rtt;

  let kind: LinkInfo["kind"] = "unknown";
  let reason = "";

  if (eff === "slow-2g" || eff === "2g" || eff === "3g") {
    kind = "cellular";
    reason = `Cellular link detected (effectiveType=${eff}). Wireless variance dominates.`;
  } else if (baselineJitter < 1.5 && baselineLoss < 0.005) {
    kind = "ethernet-like";
    reason = `Ultra-stable timing (jitter ${baselineJitter.toFixed(2)}ms, loss ${(baselineLoss * 100).toFixed(2)}%). Wired / Type-C Ethernet signature.`;
  } else if (baselineJitter < 4) {
    kind = "wifi-5ghz-like";
    reason = `Low-moderate jitter (${baselineJitter.toFixed(2)}ms). Consistent with clean 5GHz Wi-Fi.`;
  } else {
    kind = "wifi-2.4ghz-like";
    reason = `Elevated jitter (${baselineJitter.toFixed(2)}ms) — likely 2.4GHz Wi-Fi or channel interference.`;
  }

  return {
    effectiveType: eff,
    downlinkMbps: dl,
    rttMs: rtt,
    saveData: nav?.saveData,
    kind,
    reason,
  };
}
