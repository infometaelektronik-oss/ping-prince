import type { DiagnosticResult, LinkInfo, PhaseStats } from "./types";

export function buildVerdict(
  baseline: PhaseStats,
  loadedDown: PhaseStats,
  loadedUp: PhaseStats,
  downloadMbps: number,
  uploadMbps: number,
  link: LinkInfo,
): DiagnosticResult {
  const bufferbloatDown = Math.max(0, loadedDown.medianPing - baseline.medianPing);
  const bufferbloatUp = Math.max(0, loadedUp.medianPing - baseline.medianPing);

  // Scoring: start at 100, subtract for problems.
  let score = 100;
  if (baseline.medianPing > 30) score -= Math.min(20, (baseline.medianPing - 30) * 0.4);
  if (baseline.jitter > 3) score -= Math.min(20, (baseline.jitter - 3) * 3);
  if (bufferbloatDown > 30) score -= Math.min(25, (bufferbloatDown - 30) * 0.5);
  if (bufferbloatUp > 30) score -= Math.min(30, (bufferbloatUp - 30) * 0.7);
  if (loadedUp.loss > 0.01) score -= Math.min(20, loadedUp.loss * 400);
  if (downloadMbps < 10) score -= 10;
  if (uploadMbps < 3) score -= 10;
  score = Math.max(0, Math.round(score));

  const grade: DiagnosticResult["grade"] =
    score >= 92 ? "A+" : score >= 82 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";

  // PUBG verdict
  const worstLoad = Math.max(bufferbloatDown, bufferbloatUp);
  const anyLoss = Math.max(baseline.loss, loadedDown.loss, loadedUp.loss);
  let pubgVerdict: string;
  if (worstLoad < 25 && baseline.jitter < 3 && anyLoss < 0.01) {
    pubgVerdict =
      "Bu hat PUBG Mobile'da desync veya hit-registration sorunu YAŞATMAZ. Rekabetçi (ranked / TDM) oyuna uygun.";
  } else if (worstLoad < 60 && baseline.jitter < 6) {
    pubgVerdict =
      "Bu hat çoğu maçta stabil çalışır, fakat hane içinde biri video izlerken/yüklerken anlık desync ve gecikmeli vuruş yaşayabilirsin.";
  } else {
    pubgVerdict =
      "Bu hat PUBG Mobile'da CİDDİ desync, hit-registration kaybı ve ping fırlamaları yaşatır. Rekabetçi oyun için uygun değildir.";
  }

  // Root cause
  let rootCause: string;
  if (bufferbloatUp > Math.max(bufferbloatDown, 30) && bufferbloatUp > 40) {
    rootCause = `KÖK SEBEP: Modem yükleme kuyruğunda BUFFERBLOAT. Boşta ${baseline.medianPing}ms olan pingin, upload stresi altında +${bufferbloatUp.toFixed(0)}ms fırlıyor. Bu, modem/router'ın paketleri kuyrukta biriktirmesidir — oyundaki "aniden gecikme" hissinin klasik imzasıdır.`;
  } else if (bufferbloatDown > 40) {
    rootCause = `KÖK SEBEP: İndirme kuyruğunda bufferbloat. Loaded ping +${bufferbloatDown.toFixed(0)}ms. Aynı ağda video/indirme yapıldığında oyun paketlerin bekliyor.`;
  } else if (baseline.jitter > 4 || link.kind === "wifi-2.4ghz-like") {
    rootCause = `KÖK SEBEP: KABLOSUZ SİNYAL KALİTESİ / KANAL ÇAKIŞMASI. Baseline jitter ${baseline.jitter}ms — hat boşken bile ardışık paketler farklı sürelerde geliyor. ${link.reason}`;
  } else if (anyLoss > 0.01) {
    rootCause = `KÖK SEBEP: Mikro paket kaybı (%${(anyLoss * 100).toFixed(2)}). Hat teorik olarak hızlı ama paketler düşüyor — ISS tarafı veya kablosuz link kalitesi zayıf.`;
  } else {
    rootCause = `Belirgin bir kök sebep yok — hat espor kalitesinde. Baseline ${baseline.medianPing}ms, yük altında maksimum +${worstLoad.toFixed(0)}ms sapma.`;
  }

  // Recommendations
  const recs: string[] = [];
  if (bufferbloatUp > 40 || bufferbloatDown > 40) {
    recs.push(
      "Modemin yönetim panelinden QoS / SQM (Smart Queue Management, CAKE veya fq_codel) özelliğini AÇ. Bu, upload/download kuyruğunu oyun paketleri lehine yönetir ve bufferbloat'ı sıfıra yakın indirir.",
    );
    recs.push(
      "Ping fırladığında hane içinde bulut yedeklemesi (Google Photos, iCloud), torrent veya 4K video yükleme olup olmadığını kontrol et — upload kuyruğu bunlarla dolar.",
    );
  }
  if (link.kind === "wifi-2.4ghz-like" || baseline.jitter > 4) {
    recs.push(
      "Telefonunu 5GHz SSID'ye bağla (2.4GHz Bluetooth/mikrodalga/komşu Wi-Fi'lardan çok etkilenir). 5GHz yoksa router Wi-Fi kanalını 1/6/11 arasında en az kullanılana sabitle.",
    );
    recs.push(
      "En kesin çözüm: Type-C üzerinden USB-Ethernet (LAN) adaptörüyle kablolu bağlan. Jitter tipik olarak <1ms'ye düşer, PUBG deneyimi tamamen değişir.",
    );
  }
  if (baseline.medianPing > 60) {
    recs.push(
      "Baseline pingin yüksek (" +
        baseline.medianPing +
        "ms). Oyun içinden en yakın sunucu bölgesini (Asia / Europe / KRJP) manuel seç ve DNS'i 1.1.1.1 / 8.8.8.8 yap.",
    );
  }
  if (anyLoss > 0.01) {
    recs.push(
      "Kalıcı paket kaybı var. Modemi resetle, kabloları kontrol et; sorun devam ederse ISS'e 'packet loss' raporuyla başvur (bu ekranın ekran görüntüsünü paylaş).",
    );
  }
  if (recs.length === 0) {
    recs.push("Ağın espor kalitesinde. Ek ayara gerek yok — sadece oyun sırasında hane içi büyük upload'ları bekletmen yeterli.");
  }

  return {
    baseline,
    loadedDown,
    loadedUp,
    downloadMbps: +downloadMbps.toFixed(1),
    uploadMbps: +uploadMbps.toFixed(1),
    bufferbloatDownMs: +bufferbloatDown.toFixed(1),
    bufferbloatUpMs: +bufferbloatUp.toFixed(1),
    link,
    grade,
    score,
    verdict: { pubgVerdict, rootCause, recommendations: recs },
  };
}
