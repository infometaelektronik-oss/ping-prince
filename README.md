# Ping Perfect Pro

Sen dünyaca ünlü espor organizasyonlarına ve profesyonel mobil oyunculara altyapı hazırlayan kıdemli bir Ağ Mimarı (Network Architect) ve Full-Stack Yazılım Geliştiricisisin. Senden, piyasadaki tüm standart hız testi araçlarını (Speedtest, Fast.com vb.) tamamen işlevsiz ve yetersiz bırakacak, dünyada eşi benzeri olmayan, tek sayfalık (Single-page App) bir "Ultra-Luxury Esport Network Diagnostic & Bufferbloat Analyzer" uygulaması geliştirmeni istiyorum. 



ÖNEMLİ KURAL: Kesinlikle hiçbir kodu özet geçme, placeholder (// buraya kod gelecek gibi işaretler) bırakma, fonksiyonları yarıda kesme. HTML, CSS ve JavaScript mimarisinin tamamını üretim kalitesinde (production-ready) tek seferde ve eksiksiz yaz.



Bu uygulama, normal hız testlerinde pingi düşük çıkan ama PUBG Mobile gibi rekabetçi oyunlara girdiğinde "pingi aniden çat diye fırlayan" oyuncuların yaşadığı gizli ağ çökmelerini tespit etmek için tasarlanacaktır. Sistem şu 4 ana sütun üzerine kurulmalıdır:



1. GELİŞMİŞ HIZ VE GERÇEK ZAMANLI UDP OYUN SİMÜLASYONU:

- Saf İndirme (Download) ve Yükleme (Upload) Hızı: Çoklu thread (bağlantı kanalı) kullanarak hattın anlık Mbps limitlerini zorlayan dinamik veri motoru.

- PUBG Mobile Netcode Simülasyonu: Oyun sunucularıyla yapılan iletişimi taklit eden, her 60ms'lik döngüde bir (PUBG'nin gerçek ağ tickrate frekansı) 64-byte boyutunda küçük UDP oyun paketleri gönderen motor. Bu motor "Mikro Paket Kaybını" (Micro Packet Loss) %0.01 hassasiyetle hesaplamalıdır.

- Boşta Gecikme (Idle Ping) ve Anlık Jitter: Hattın tamamen boş olduğu andaki taban milisaniye (ms) gecikmesi ve ardışık paketlerin varış süreleri arasındaki standart sapma (Jitter). Eğer Jitter 3ms değerinin üzerine çıkarsa arayüzde anında görsel kırmızı uyarılar yanmalıdır.



2. 3 AŞAMALI BUFFERBLOAT (HAT ŞİŞME) STRES TESTİ MİMARİSİ:

Test başlatıldığında sistem sırasıyla şu 3 faza ayrılmalı ve her fazda oyundaki anlık ping değişimlerini saniyelik izlemelidir:

- Faz 1 (Idle Phase): Hat tamamen boşken oyun paketlerinin taban pingi ve jitter'ı ölçülür.

- Faz 2 (Download Stress): Arka planda agresif bir indirme stresi başlatılır ve hat tam yük altındayken oyun pinginin kaça fırladığı (Loaded Ping) milisaniye milisaniye kaydedilir.

- Faz 3 (Upload Stress): Arka planda en kritik aşama olan yükleme stresi başlatılır ve oyun paketlerinin modemin yükleme kuyruğunda ne kadar şiştiği (Bufferbloat) tespit edilir.

- Donanım ve Bağlantı Algılama: Cihazın Wi-Fi parazitlerinden mi (2.4GHz / 5GHz dalgalanmaları) yoksa Type-C üzerinden bağlı bir Ethernet (LAN) adaptörünün mü aktif olduğunu bağlantı stabilitesi algoritması üzerinden analiz edebilmelidir.



3. SİBER-PUNK PREMIUM UI/UX (KULLANICI ARAYÜZÜ):

- Koyu siber-punk / premium dark temalı, minimalist ama son derece lüks duran, neon (mavi, pembe, yeşil) göstergelerle donatılmış espor odaklı bir arayüz.

- Test esnasında anlık hız verilerini, jitter'ı ve özellikle oyundaki o anlık ping sıçramalarını (Ping Spikes) anında dikey kırmızı şimşek çizgileriyle ya da sert grafik kırılmalarıyla vurgulayan pürüzsüz, canlı ve dinamik bir çizgi grafik paneli (Line Chart).



4. AKILLI YAPAY TEŞHİS RAPORU EKRANI:

Test bittiğinde kullanıcıya sadece sayısal veriler sunulmamalı, arka plandaki lojik karar mekanizması çalışarak net bir "Ağ Sağlık Skoru" (A+, B, C, D) vermelidir. Raporda şu soruların cevabı net olmalıdır:

- "Bu internet PUBG Mobile'da desync (senkronizasyon kaybı) veya hit registration (mermilerin gitmeme) sorunu yaşatır mı?"

- "Oyundaki anlık ping fırlamasının kök sebebi modem kaynaklı kuyruk şişmesi mi (Bufferbloat), yoksa kablosuz sinyal kalitesizliği/kanal çakışması mı (Jitter)?"

- Kullanıcıya sorununa göre doğrudan çözüm önerisi sunan (QoS/SQM ayarı yap, kabloluya geç, Wi-Fi kanalını değiştir gibi) akıllı bir analiz metni üretilmelidir.



Bana bu uygulamanın mimari işleyişini açıkla ve ardından doğrudan çalıştırabileceğim eksiksiz HTML, CSS ve saf JavaScript kod bloklarını hiçbir fonksiyonu atlamadan tek parça halinde yaz.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ping-prince.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1cf96d69-ddcd-4511-ab33-2a4399130bcd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
