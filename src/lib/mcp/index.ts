import { defineMcp } from "@lovable.dev/mcp-js";
import analyzeNetworkMetrics from "./tools/analyze-network-metrics";
import getDiagnosticMethodology from "./tools/get-diagnostic-methodology";

export default defineMcp({
  name: "nova-latency-mcp",
  title: "Nova Latency — Esport Network Diagnostic",
  version: "0.1.0",
  instructions:
    "Tools for the Nova Latency esport network diagnostic. Use `get_diagnostic_methodology` to learn what the app measures and how, and `analyze_network_metrics` to score already-measured baseline / loaded-download / loaded-upload ping stats plus Mbps into a PUBG Mobile stability verdict, root cause, and recommendations. Live in-browser measurement (WebTransport / stress tests) runs in the app UI, not through MCP.",
  tools: [analyzeNetworkMetrics, getDiagnosticMethodology],
});
