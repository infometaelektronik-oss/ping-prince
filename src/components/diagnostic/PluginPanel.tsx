import { useMemo, useState } from "react";
import type { DiagnosticResult } from "@/lib/diagnostic/types";

type Tab = "insights" | "qos" | "routing";

export function PluginPanel({ result }: { result: DiagnosticResult }) {
  const [tab, setTab] = useState<Tab>("insights");

  const insights = useMemo(() => buildInsights(result), [result]);
  const qosConfig = useMemo(() => buildQosConfig(result), [result]);
  const routing = useMemo(() => buildRoutingPlan(result), [result]);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Nova Plugins · Post-Diagnostic Toolkit
          </div>
          <div className="mt-1 font-display text-lg">AI Insights · Router QoS · Routing Optimizer</div>
        </div>
        <div className="flex gap-1 rounded-md border border-hairline p-1 text-[10px] uppercase tracking-widest">
          <TabBtn active={tab === "insights"} onClick={() => setTab("insights")}>AI Insights</TabBtn>
          <TabBtn active={tab === "qos"} onClick={() => setTab("qos")}>QoS Config</TabBtn>
          <TabBtn active={tab === "routing"} onClick={() => setTab("routing")}>Routing</TabBtn>
        </div>
      </div>

      {tab === "insights" && (
        <ul className="space-y-3 text-sm">
          {insights.map((it, i) => (
            <li key={i} className="flex gap-3 rounded-md border border-hairline/60 p-3">
              <span
                className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-display text-[10px] uppercase tracking-widest"
                style={{ color: it.color, borderColor: it.color, border: `1px solid ${it.color}` }}
              >
                {it.tag}
              </span>
              <span className="text-foreground/90">{it.text}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "qos" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Auto-generated Smart Queue Management rules. Adjust <code>DOWN</code>/<code>UP</code> to
            ~90% of your ISP plan's advertised speed for maximum bufferbloat reduction.
          </div>
          <CodeBlock title="OpenWrt / LEDE — /etc/config/sqm (CAKE)" code={qosConfig.openwrt} />
          <CodeBlock title="Linux tc — fq_codel egress shaping" code={qosConfig.linuxTc} />
          <CodeBlock title="MikroTik RouterOS — queue tree" code={qosConfig.mikrotik} />
        </div>
      )}

      {tab === "routing" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Gaming Routing Optimizer — suggested edge regions and DNS profile derived from your
            baseline latency and detected link type.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard title="Recommended PUBG Region" value={routing.region} note={routing.regionNote} />
            <InfoCard title="DNS Profile" value={routing.dns} note={routing.dnsNote} />
            <InfoCard title="Route Hardening" value={routing.route} note={routing.routeNote} />
            <InfoCard title="MTU Suggestion" value={routing.mtu} note={routing.mtuNote} />
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-3 py-1 transition"
      style={{
        background: active ? "color-mix(in oklab, var(--neon-cyan) 15%, transparent)" : "transparent",
        color: active ? "var(--neon-cyan)" : "var(--muted-foreground)",
      }}
    >
      {children}
    </button>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-hairline">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-neon-cyan hover:underline"
          style={{ color: "var(--neon-cyan)" }}
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
        {code}
      </pre>
    </div>
  );
}

function InfoCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-hairline p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{title}</div>
      <div className="mt-1 font-display text-lg" style={{ color: "var(--neon-cyan)" }}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// AI-style insight rules (deterministic heuristic model over metrics)
// ————————————————————————————————————————————————————————————————

interface Insight { tag: string; color: string; text: string }

function buildInsights(r: DiagnosticResult): Insight[] {
  const out: Insight[] = [];
  const jitter = r.baseline.jitter;
  const bbUp = r.bufferbloatUpMs;
  const bbDown = r.bufferbloatDownMs;
  const loss = Math.max(r.baseline.loss, r.loadedDown.loss, r.loadedUp.loss);

  if (bbUp >= 100) {
    out.push({
      tag: "CRIT", color: "var(--neon-red)",
      text: `Upload stress altında ping +${bbUp.toFixed(0)}ms fırladı. Bu klasik "yerel kuyruk taşması" (local queue flooding) imzası — router'ın upstream QoS/SQM ayarını doğrula, aksi halde PUBG içi rubberband ve gecikmeli vuruşlar kaçınılmaz.`,
    });
  } else if (bbUp >= 40) {
    out.push({
      tag: "WARN", color: "var(--neon-amber)",
      text: `Upload bufferbloat +${bbUp.toFixed(0)}ms — sınırda. Bir arka plan bulut yedeklemesi bile TDM'de senkron kaybı yaratabilir. SQM önerilir.`,
    });
  }

  if (bbDown >= 60) {
    out.push({
      tag: "WARN", color: "var(--neon-amber)",
      text: `Download bufferbloat +${bbDown.toFixed(0)}ms. Hane içinde 4K stream/indirme yapılırken oyun paketlerin sıraya giriyor.`,
    });
  }

  if (jitter > 5) {
    out.push({
      tag: "JIT", color: "var(--neon-magenta)",
      text: `Baseline jitter ${jitter.toFixed(2)}ms (RFC 3550 sürekli tahmin). Hat yüksüz iken bile ardışık paketler dalgalanıyor — bu yönlendiricinin değil, kablosuz linkin problemidir.`,
    });
  } else if (jitter > 3) {
    out.push({
      tag: "JIT", color: "var(--neon-amber)",
      text: `Jitter ${jitter.toFixed(2)}ms — espor sınırının hemen üzerinde. 5GHz'e geç veya kablolu bağlan.`,
    });
  }

  if (loss > 0.02) {
    out.push({
      tag: "LOSS", color: "var(--neon-red)",
      text: `Mikro paket kaybı %${(loss * 100).toFixed(2)} — sequence-number takibiyle onaylandı. PUBG'de "mermi gitmedi" hissi bunun doğrudan sonucudur.`,
    });
  } else if (loss > 0.005) {
    out.push({
      tag: "LOSS", color: "var(--neon-amber)",
      text: `Küçük paket kaybı %${(loss * 100).toFixed(2)}. Nadir hit-registration kayıpları görebilirsin.`,
    });
  }

  if (r.link.kind === "wifi-2.4ghz-like") {
    out.push({
      tag: "LINK", color: "var(--neon-magenta)",
      text: `Bağlantı imzası 2.4GHz Wi-Fi. Bluetooth/mikrodalga/komşu ağ paraziti bu banddan sızıyor. 5GHz veya Type-C Ethernet en büyük kazancı sağlar.`,
    });
  } else if (r.link.kind === "ethernet-like") {
    out.push({
      tag: "LINK", color: "var(--neon-lime)",
      text: `Ethernet-benzeri ultra stabil zamanlama tespit edildi. Cihaz tarafı kusursuz — kalan iyileştirme ISS ve router konfigüne bağlı.`,
    });
  }

  if (out.length === 0) {
    out.push({
      tag: "OK", color: "var(--neon-lime)",
      text: `Tüm metrikler espor toleransında. Ek plugin eylemi gerekmez — bu konfigü koru.`,
    });
  }

  return out;
}

// ————————————————————————————————————————————————————————————————
// QoS / SQM config generator — real, ready-to-paste snippets
// ————————————————————————————————————————————————————————————————

function buildQosConfig(r: DiagnosticResult) {
  const down = Math.max(5, Math.round(r.downloadMbps * 0.9));
  const up = Math.max(2, Math.round(r.uploadMbps * 0.9));

  const openwrt = `# /etc/config/sqm  — CAKE @ ~90% of measured link
config queue 'eth1'
    option enabled '1'
    option interface 'wan'
    option download '${Math.round(down * 1000)}'   # kbit/s
    option upload   '${Math.round(up * 1000)}'   # kbit/s
    option qdisc 'cake'
    option script 'piece_of_cake.qos'
    option qdisc_advanced '1'
    option squash_dscp '1'
    option squash_ingress '1'
    option qdisc_really_really_advanced '1'
    option iqdisc_opts 'nat dual-dsthost'
    option eqdisc_opts 'nat dual-srchost ack-filter'
    option linklayer 'ethernet'
    option overhead '44'`;

  const linuxTc = `# Linux fq_codel egress shaping on wan iface (replace eth0)
IFACE=eth0
DOWN=${Math.round(down * 1000)}kbit
UP=${Math.round(up * 1000)}kbit

tc qdisc del dev $IFACE root 2>/dev/null
tc qdisc add dev $IFACE root handle 1: htb default 10
tc class add dev $IFACE parent 1: classid 1:10 htb rate $UP ceil $UP
tc qdisc add dev $IFACE parent 1:10 handle 10: fq_codel target 5ms interval 100ms

# Ingress policing via IFB
modprobe ifb
ip link set ifb0 up
tc qdisc add dev $IFACE handle ffff: ingress
tc filter add dev $IFACE parent ffff: matchall action mirred egress redirect dev ifb0
tc qdisc add dev ifb0 root handle 1: htb default 10
tc class add dev ifb0 parent 1: classid 1:10 htb rate $DOWN ceil $DOWN
tc qdisc add dev ifb0 parent 1:10 handle 10: fq_codel target 5ms interval 100ms`;

  const mikrotik = `# MikroTik RouterOS — queue tree with FQ_CODEL leaves
/queue type
add name=fq-codel-down kind=fq-codel fq-codel-target=5ms fq-codel-interval=100ms
add name=fq-codel-up   kind=fq-codel fq-codel-target=5ms fq-codel-interval=100ms

/queue tree
add name=WAN-DOWN parent=global max-limit=${down}M queue=fq-codel-down
add name=WAN-UP   parent=global max-limit=${up}M   queue=fq-codel-up packet-mark=up-mark

/ip firewall mangle
add chain=forward out-interface=ether1-wan action=mark-packet new-packet-mark=up-mark passthrough=no`;

  return { openwrt, linuxTc, mikrotik };
}

// ————————————————————————————————————————————————————————————————
// Gaming Routing Optimizer — deterministic suggestions from metrics
// ————————————————————————————————————————————————————————————————

function buildRoutingPlan(r: DiagnosticResult) {
  const p = r.baseline.medianPing;
  let region: string; let regionNote: string;
  if (p < 40) { region = "Local / Nearest"; regionNote = "Baseline <40ms — herhangi bir yakın bölge sunucusu ideal."; }
  else if (p < 90) { region = "Europe / KRJP tercih"; regionNote = `Baseline ${p}ms — orta mesafe. Oyun içi region seçimini manuel yap.`; }
  else { region = "Asia / KRJP zorunlu"; regionNote = `Baseline ${p}ms yüksek — sunucu bölgesi ping'in ana kaynağı, seçimi kilitle.`; }

  const dns = r.baseline.jitter > 3 ? "1.1.1.1 + 1.0.0.1 (Cloudflare)" : "1.1.1.1 + 8.8.8.8 (mixed)";
  const dnsNote = "Handshake/lobby süresini kısaltır, oyun içi ping'e etkisi yok ama matchmaking'i hızlandırır.";

  const route =
    r.link.kind === "wifi-2.4ghz-like"
      ? "USB-C → Ethernet (LAN)"
      : r.link.kind === "wifi-5ghz-like"
        ? "5GHz sabitle · router'a 1 duvar mesafede"
        : "Mevcut kablolu bağlantıyı koru";
  const routeNote = "Fiziksel katman bufferbloat sonrası en yüksek getirili tek adımdır.";

  const mtu = r.bufferbloatUpMs > 60 ? "1420 (PPPoE) / 1450 test" : "1500 (varsayılan)";
  const mtuNote = "Yüksek upload bufferbloat + fragmentasyon şüphesi varsa MTU düşürmek fragmentation retry'ı azaltır.";

  return { region, regionNote, dns, dnsNote, route, routeNote, mtu, mtuNote };
}
