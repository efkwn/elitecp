# Changelog

## v0.4.0

- Arayüz baştan sona **Atelier UI** görsel katmanına taşındı; backend veya runtime ağırlığı artırılmadı.
- Harici font, CSS framework, chart kütüphanesi veya icon CDN'i eklenmedi.
- Dashboard için yeni kontrol merkezi hero alanı, sistem sağlık özeti ve daha kompakt bot istatistik şeridi.
- CPU/RAM/Disk/Uptime kartları daha okunaklı tipografi, mikro grafikler ve canlı durum göstergeleriyle yenilendi.
- Bot kartları, durum rozetleri ve kaynak satırları yeniden tasarlandı.
- Bot detay ekranı yeni instance hero, segment tab düzeni ve premium kaynak/pipeline kartlarına geçti.
- Console görünümü daha profesyonel terminal chrome, daha sıkı toolbar ve mobil optimizasyon aldı.
- Mobilde Dashboard / Botlar / Yeni Bot için hafif sabit bottom dock eklendi.
- Login ekranı, dialoglar, formlar, file manager, focus state ve reduced-motion erişilebilirliği görsel olarak iyileştirildi.
- Tüm yeni görseller CSS + mevcut local SVG sprite ile çalışır; yeni runtime dependency yoktur.

## v0.3.0

- Dashboard'a VPS/host kaynak izleme kartları eklendi.
- CPU kullanım yüzdesi ve 1/5/15 dakikalık load average bilgisi.
- RAM kullanılan/toplam/boş alan ve kullanım yüzdesi.
- Root disk kullanılan/toplam/boş alan ve kullanım yüzdesi.
- VPS uptime, hostname ve işletim sistemi bilgisi.
- CPU/RAM/Disk için son örnekleri gösteren hafif SVG mini grafikler (sparkline).
- Dashboard metrikleri 4 saniyede bir otomatik yenilenir.
- Sunucu metrikleri yalnızca Linux /proc ve standart Go sistem çağrılarıyla okunur; ek paket/agent gerekmez.
- Sunucu kaynak kartları tablet ve mobilde 2/1 kolon responsive düzene geçer.

## v0.2.0

- Yeni Startup Plan alanları: dependency file, main file, install command, startup command.
- Python botları için bot başına kalıcı `.elitecp/venv`.
- Console içindeki manuel `pip` / `python` komutları aynı venv ile çalışır.
- Dependency dosyası hash kontrolü; değişmediyse install adımı atlanır.
- Node.js'te `package-lock.json` / `npm-shrinkwrap.json` değişiklikleri de dependency hash'ine dahil edilir.
- `reinstall` aksiyonu ile dependency kurulumunu zorla yeniden çalıştırma.
- Eski container'ları ilk Start/Restart sırasında otomatik v0.2 runtime schema'ya taşıma.
- OOMKilled, exit code ve container state bilgisi.
- Console'da startup pipeline adımlarının detaylı loglanması.
- Tamamen yenilenmiş açık tema ve responsive mobil arayüz.
- Local SVG icon set; harici icon CDN'i yok.
- Startup, dosya yöneticisi, ENV ve console UX iyileştirmeleri.

## v0.1.0

- İlk MVP: Go + SQLite + Docker, Python/Node runtime, dosya yöneticisi, ENV, console ve CloudPanel kurulumu.
