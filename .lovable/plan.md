# Ultra-Luxury Esport Network Diagnostic & Bufferbloat Analyzer

Tek sayfalık, koyu siber-punk temalı bir teşhis uygulaması. TanStack Start üzerinde `/` route'unda çalışacak, tarayıcı-yalnız (no backend) ölçüm motoruyla.

## Mimari İşleyiş

### Ölçüm Motoru (tarayıcı sınırları içinde dürüst)
Tarayıcılar ham UDP soketi açamaz — bu yüzden "PUBG UDP simülasyonu" `WebTransport` (destekleyen tarayıcılarda datagram) + `fetch` HEAD/Range istekleri karışımı ile taklit edilir. Fallback: Cloudflare public speed endpoint'lerine küçük 64-byte `fetch` istekleri 60ms tick ile gönderilir, RTT ölçülür, kaybolan/timeout olan istekler "micro packet loss" sayılır. Bu sınır kullanıcıya UI'da küçük bir "browser-emulated UDP" rozetiyle dürüstçe belirtilir.

### 4 Sütun
1. **Speed + UDP-sim motoru** (`src/lib/diagnostic/engine.ts`):
   - `runDownload()` — 6 paralel `fetch` stream (Cloudflare `/__down?bytes=`) 10s, anlık Mbps.
   - `runUpload()` — 4 paralel `POST` random `Uint8Array` (`/__up`), anlık Mbps.
   - `runGameTick()` — 60ms `setInterval`, her tick 64-byte HEAD ping, RTT + loss + jitter (std dev).
2. **3-fazlı Bufferbloat** (`runBufferbloat()`):
   - Faz 1 Idle 5s — baseline ping/jitter.
   - Faz 2 Download stress 10s — paralel game-tick koşarken loaded ping.
   - Faz 3 Upload stress 10s — en kritik, upload kuyruğu şişmesi.
   - Bağlantı tipi algısı: `navigator.connection` (effectiveType, downlink, rtt) + jitter varyansı → "Wi-Fi 2.4/5GHz tahmini" / "Ethernet benzeri stabil" sınıflandırma.
3. **UI** (`src/routes/index.tsx` + bileşenler):
   - Koyu cyberpunk: neon cyan/magenta/lime, grid arka plan, glow shadow'lar, monospace + display font.
   - Canlı çizgi grafiği: kendi yazılan SVG chart (`LivePingChart.tsx`) — ping spike >2x baseline'da dikey kırmızı şimşek çizgisi, jitter>3ms'de border neon-red pulse.
   - Gauge'lar: Download / Upload / Ping / Jitter / Loss.
   - Faz göstergesi (3 aşama progress rail).
4. **AI Teşhis Raporu** (`src/lib/diagnostic/verdict.ts`):
   - Saf kural motoru: skor hesabı (A+ … D) baseline ping, loaded ping delta, upload bufferbloat delta, jitter, loss ağırlıklı.
   - Şablonlu ama koşullu metin üretici: "PUBG'de desync riski", "kök sebep bufferbloat mı jitter mı", "QoS/SQM / kabloya geç / kanal değiştir" önerileri.

## Dosya Değişiklikleri
- `src/routes/index.tsx` — placeholder yerine tek sayfa uygulama.
- `src/routes/__root.tsx` — title/description/OG meta güncelle (Esport Network Diagnostic), Orbitron + JetBrains Mono `<link>`.
- `src/styles.css` — neon renk tokenları (`--neon-cyan`, `--neon-magenta`, `--neon-lime`, `--neon-red`), cyberpunk grid utility, glow shadow tokenları, font-family tokens.
- `src/lib/diagnostic/engine.ts` — ölçüm motoru (download/upload/game-tick/bufferbloat/link-detect).
- `src/lib/diagnostic/verdict.ts` — skor + teşhis metni üretici.
- `src/lib/diagnostic/types.ts` — paylaşılan tipler.
- `src/components/diagnostic/LivePingChart.tsx` — SVG canlı grafik + spike overlay.
- `src/components/diagnostic/MetricGauge.tsx` — neon gauge.
- `src/components/diagnostic/PhaseRail.tsx` — 3 faz progress.
- `src/components/diagnostic/VerdictPanel.tsx` — skor + akıllı analiz raporu.
- `src/components/diagnostic/StartConsole.tsx` — başlat butonu + canlı sayaç.

## Teknik Notlar (kısa)
- Endpoint: Cloudflare `speed.cloudflare.com/__down` / `/__up` (CORS açık, ücretsiz, worldwide anycast). Fallback URL listesi + timeout.
- Ölçümler tamamen `performance.now()` bazlı, `AbortController` ile temiz kapatma.
- State: React `useReducer` — tick sıklığında `flushSync` yerine `requestAnimationFrame` throttled UI update, ölçüm ana thread'ini bloklamaz.
- Erişim: yalnızca `/` — home route placeholder'ı geçersiz kılınır; ek route yok.
- Meta: title "Nova Latency — Esport Network Diagnostic", açıklama PUBG/bufferbloat odaklı.

## Kapsam Dışı
- Backend / server function yok (saf tarayıcı ölçümü).
- Gerçek UDP yok (tarayıcı izin vermiyor); UI'da açıkça belirtilir.
- Kullanıcı hesabı, kayıt geçmişi, DB yok.

Onayla, kodu tek parça halinde eksiksiz yazayım.
