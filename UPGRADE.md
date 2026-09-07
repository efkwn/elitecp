# eLite CP v0.3.0 Upgrade

Bu sürüm veritabanı veya bot dosya formatını bozmaz. Mevcut v0.2.0 kurulumunun üzerine güvenli şekilde güncellenebilir.

Repository `main` branch'ine v0.3.0 dosyalarını yükledikten sonra VPS'te:

```bash
curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/update.sh -o /tmp/elitecp-update.sh && sudo bash /tmp/elitecp-update.sh
```

Updater SQLite yedeği alır, GitHub `main` branch'ini çeker, test/build yapar ve `elitecp` systemd servisini yeniden başlatır.

Güncellemeden sonra Dashboard'da CPU, RAM, disk ve VPS uptime kartları görünür. Metrikler Linux `/proc` ve `statfs` üzerinden okunur; ekstra daemon veya paket gerekmez.

Kontrol:

```bash
elitecp version
systemctl status elitecp --no-pager
```

Beklenen sürüm:

```text
eLite CP 0.3.0
```
