import { defineTool } from "@lovable.dev/mcp-js";

const METHODOLOGY = `Nova Latency — Esport Network Diagnostic methodology

Transport for game-tick simulation:
  1) WebTransport (QUIC/HTTP3) datagrams to an echo endpoint — closest browser proxy for raw UDP.
  2) Fallback: 64-byte fetch HEAD requests to Cloudflare, one every 60ms (PUBG Mobile's real network tickrate).

Three-phase test:
  Phase 1 — Idle: baseline ping, jitter (std dev of inter-arrival), micro packet loss on an unloaded line.
  Phase 2 — Download stress: 6 parallel streaming fetches from speed.cloudflare.com/__down. Real Mbps is
           measured over a 200ms sliding window while the 60ms game-tick loop keeps running. Ping delta
           under load = download-side bufferbloat.
  Phase 3 — Upload stress: 4 parallel XHR POSTs to speed.cloudflare.com/__up (XHR is used so upload.onprogress
           gives real-time bytes-sent). The game-tick loop keeps running. Ping delta under load = upload-side
           bufferbloat — the classic "PUBG ping suddenly jumps" signature.

Scoring: starts at 100, subtracts for high baseline ping, jitter > 3ms, download bufferbloat > 30ms,
upload bufferbloat > 30ms (weighted higher), loss > 1%, and low throughput. A+ >= 92, A >= 82, B >= 70,
C >= 55, else D.

Verdict engine outputs a PUBG-specific stability call, identifies the root cause (upload bufferbloat vs
download bufferbloat vs Wi-Fi jitter / channel congestion vs micro packet loss vs clean), and returns
targeted recommendations (enable QoS/SQM CAKE/fq_codel, move to 5GHz, use USB-C Ethernet, change region/DNS).`;

export default defineTool({
  name: "get_diagnostic_methodology",
  title: "Get diagnostic methodology",
  description:
    "Return a plain-text description of the Nova Latency diagnostic: transport (WebTransport → HEAD-fetch fallback), the three-phase test (idle / download stress / upload stress), how bufferbloat is measured, and how the verdict / grade is derived.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: METHODOLOGY }],
  }),
});
