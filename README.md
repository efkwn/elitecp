# eLite CP

Hafif, sade ve Docker tabanlı Discord / Telegram bot hosting kontrol paneli.

> **MVP v0.1.0** — Python 3.12 ve Node.js 22 botları hedefler. Oyun sunucuları ve çoklu node/agent mimarisi sonraki sürümler için planlanmıştır.

## Özellikler

- Go backend + gömülü web arayüzü (tek servis)
- SQLite veritabanı
- Python 3.12 / Node.js 22 runtime
- Docker container izolasyonu
- Start / Stop / Restart / Rebuild
- RAM ve CPU limitleri
- Canlı console/log akışı (SSE)
- Container içinde komut çalıştırma
- ENV / token yönetimi
- Dosya yöneticisi ve metin editörü
- ZIP yükleme ve güvenli açma
- Responsive, harici frontend framework kullanmayan sade UI
- Debian 11 için interaktif tek-komut kurulum
- Mevcut CloudPanel'e dokunmadan `127.0.0.1:9080` üzerinde çalışma
- CloudPanel CLI ile reverse proxy ve Let's Encrypt kurulumu

## Mimari

```text
Cloudflare / Domain
        |
CloudPanel NGINX :80/:443
        |
  127.0.0.1:9080
        |
     eLite CP
   Go + SQLite
        |
   Docker Engine
    /        \
Python Bot  Node Bot
```

Panel **80/443 portlarını açmaz**. CloudPanel ana reverse proxy olarak kalır.

## Debian 11 kurulum

Repository GitHub'a yüklendikten sonra root olarak:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/install.sh)
```

Kurucu sırasıyla admin kullanıcı adı/şifresi ve domain sorar. CloudPanel algılanırsa domaini otomatik olarak `http://127.0.0.1:9080` adresine reverse proxy olarak eklemeyi ve Let's Encrypt kurmayı dener.

### Cloudflare

A/AAAA kaydının VPS'e yönelmiş olması gerekir. Let's Encrypt otomasyonu başarısız olursa CloudPanel'deki ilgili sitenin **SSL/TLS** ekranından sertifikayı tekrar kurabilir veya Cloudflare Origin Certificate kullanabilirsin.

## Servis komutları

```bash
systemctl status elitecp
systemctl restart elitecp
journalctl -u elitecp -f
/usr/local/bin/elitecp doctor
```

Güncelleme:

```bash
sudo /opt/elitecp/src/update.sh
```

## Veriler

```text
/var/lib/elitecp/elitecp.db
/var/lib/elitecp/bots/<bot-id>/app/
/etc/elitecp/elitecp.env
```

Bot dosyalarını yedeklemek için `/var/lib/elitecp` dizinini yedeklemek yeterlidir.

## Güvenlik notları

Bu sürüm tek-admin / küçük hosting MVP'sidir. eLite CP sistem kullanıcısı Docker daemon'a erişir; Docker socket erişimi Linux'ta yüksek yetkilidir. Panel bu yetkiyi kontrollü Docker CLI çağrılarıyla sınırlar, bot container'larında capability'leri düşürür, `no-new-privileges`, PID, RAM ve CPU limitleri uygular. Çok kullanıcılı ticari kullanım öncesi ayrı node-agent, RBAC, audit log, 2FA, secret encryption-at-rest ve daha sert sandboxing eklenmesi önerilir.

Botların kendi token ve kod güvenliği yine panel yöneticisinin sorumluluğundadır.

## Geliştirme

Debian/Ubuntu üzerinde:

```bash
sudo apt install gcc libsqlite3-dev
CGO_ENABLED=1 go build -o elitecp .
ELITECP_DATA_DIR=./data ELITECP_DB=./data/dev.db ./elitecp setup-admin --username admin --password 'change-me-now'
ELITECP_DATA_DIR=./data ELITECP_DB=./data/dev.db ELITECP_LISTEN=127.0.0.1:9080 ./elitecp
```

Go tarafında üçüncü parti modül kullanılmaz. SQLite'a sistem `libsqlite3` kütüphanesi üzerinden doğrudan bağlanılır; frontend de vanilla HTML/CSS/JS'dir.

## Lisans

MIT — `LICENSE` dosyasına bakın.
