import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buildVerdict } from "@/lib/diagnostic/verdict";
import type { LinkInfo, PhaseStats } from "@/lib/diagnostic/types";

const phaseSchema = z.object({
  avgPing: z.number().describe("Average ping in ms."),
  medianPing: z.number().describe("Median ping in ms."),
  p95Ping: z.number().describe("95th percentile ping in ms."),
  jitter: z.number().describe("Jitter (std deviation of inter-arrival) in ms."),
  loss: z.number().min(0).max(1).describe("Packet loss ratio 0..1 (e.g. 0.005 = 0.5%)."),
  samples: z.number().int().nonnegative().describe("Number of samples collected in this phase."),
});

const linkSchema = z.object({
  kind: z
    .enum(["ethernet-like", "wifi-5ghz-like", "wifi-2.4ghz-like", "cellular", "unknown"])
    .describe("Detected link kind."),
  reason: z.string().describe("Short human explanation of why this kind was inferred."),
  effectiveType: z.string().optional(),
  downlinkMbps: z.number().optional(),
  rttMs: z.number().optional(),
  saveData: z.boolean().optional(),
});

export default defineTool({
  name: "analyze_network_metrics",
  title: "Analyze network metrics",
  description:
    "Run the Nova Latency verdict engine on measured network metrics. Given baseline / download-loaded / upload-loaded ping stats plus real download/upload Mbps and link info, returns a network health grade (A+..D), a PUBG Mobile stability verdict, the root cause (bufferbloat vs Wi-Fi jitter vs loss), and concrete recommendations (QoS/SQM, 5GHz, Ethernet, DNS, etc). Pure logic, no live measurement.",
  inputSchema: {
    baseline: phaseSchema.describe("Idle-phase ping stats."),
    loadedDown: phaseSchema.describe("Ping stats measured under download stress."),
    loadedUp: phaseSchema.describe("Ping stats measured under upload stress."),
    downloadMbps: z.number().nonnegative().describe("Measured real download throughput in Mbps."),
    uploadMbps: z.number().nonnegative().describe("Measured real upload throughput in Mbps."),
    link: linkSchema.describe("Detected link/connection info."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const result = buildVerdict(
      input.baseline as PhaseStats,
      input.loadedDown as PhaseStats,
      input.loadedUp as PhaseStats,
      input.downloadMbps,
      input.uploadMbps,
      input.link as LinkInfo,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { result: result as unknown as Record<string, unknown> },
    };
  },
});
