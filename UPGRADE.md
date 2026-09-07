# eLite CP v0.4.0 Upgrade

Bu sürüm ağırlıklı olarak UI/UX güncellemesidir. SQLite şeması, bot dosyaları, ENV değerleri ve container verileri korunur. v0.3.0 üzerine doğrudan kurulabilir.

Repository `main` branch'ine v0.4.0 dosyalarını yükledikten sonra VPS'te:

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/update.sh -o /tmp/elitecp-update.sh && sudo bash /tmp/elitecp-update.sh
```

Updater mevcut davranışıyla SQLite yedeği alır, kaynakları çeker, test/build yapar ve `elitecp` servisini yeniden başlatır.

Tarayıcı eski CSS/JS tutuyorsa güncellemeden sonra bir kez hard refresh (`Ctrl+Shift+R`) yap.

Kontrol:

```bash
elitecp version
systemctl status elitecp --no-pager
```

Beklenen sürüm:

```text
eLite CP 0.4.0
```

## Hafiflik

v0.4.0 ile React/Vue, webfont, icon paketi CDN'i veya grafik kütüphanesi eklenmedi. Web katmanı hâlâ vanilla HTML/CSS/JS ve local SVG sprite'tan oluşur.
