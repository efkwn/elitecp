# eLite CP

Hafif, sade ve Docker tabanlı Discord / Telegram bot hosting kontrol paneli.

> **v0.2.0** — Python 3.12 ve Node.js 22 botları hedefler. Bu sürüm startup pipeline, otomatik dependency kurulumu, daha detaylı console ve tamamen yenilenmiş responsive açık tema getirir.

## Özellikler

- Go backend + gömülü vanilla web arayüzü (tek servis)
- SQLite veritabanı
- Python 3.12 / Node.js 22 runtime
- Her bot için ayrı Docker container
- Python botlarında **bot başına ayrı ve kalıcı venv** (`/app/.elitecp/venv`)
- Node.js botlarında bot başına ayrı `node_modules`
- Startup planı: dependency dosyası + install command + main file + startup command
- `requirements.txt` / `package.json` değiştiğinde dependency kurulumunu otomatik tekrar çalıştırma
- Manuel **Dependencies'i Yeniden Kur** aksiyonu
- Start / Stop / Restart / Rebuild
- RAM ve CPU limitleri
- OOM / exit code bilgisi
- Canlı Docker log/console akışı (SSE)
- Console komutlarında Python venv'i otomatik aktive etme
- ENV / token yönetimi
- Dosya yöneticisi ve metin editörü
- ZIP yükleme ve güvenli açma
- Açık tema, local SVG icon set ve mobil uyumlu arayüz
- Debian 11 için interaktif tek-komut kurulum
- Mevcut CloudPanel'e dokunmadan `127.0.0.1:9080` üzerinde çalışma
- CloudPanel CLI ile reverse proxy ve Let's Encrypt kurulumu

## Startup pipeline

Python örneği:

```text
1. Python container hazırlanır
2. /app/.elitecp/venv oluşturulur / aktive edilir
3. requirements.txt hash'i kontrol edilir
4. Değişmişse: python -m pip install -r requirements.txt
5. Startup: python bot.py
```

Panelde varsayılan alanlar:

```text
Dependency file: requirements.txt
Main file:       bot.py
Install command: python -m pip install --disable-pip-version-check -r {{dependency_file}}
Startup command: python {{main_file}}
```

Node.js için varsayılanlar:

```text
Dependency file: package.json
Main file:       index.js
Install command: package-lock.json varsa npm ci --omit=dev, yoksa npm install --omit=dev
Startup command: node {{main_file}}
```

Dependency dosyası değişmediyse gereksiz yere tekrar paket indirilmez. Panelde **Dependencies'i Yeniden Kur** ile cache damgası silinip kurulum zorlanabilir.

## İzolasyon

Bot kütüphaneleri host sisteme kurulmaz.

```text
VPS host
└── Docker
    ├── Bot A / Python
    │   └── /app/.elitecp/venv
    ├── Bot B / Python
    │   └── /app/.elitecp/venv
    └── Bot C / Node.js
        └── /app/node_modules
```

Her botun `/app` dizini kendi `/var/lib/elitecp/bots/<id>/app/` dizinine bağlıdır. Python venv ve Node modülleri bu bot dizininde kalır; host `pip`, host Python paketleri veya başka botların paketleriyle karışmaz.

> Docker container bir sanal makine değildir; container'lar host kernel'i paylaşır. Paket/dosya/process izolasyonu vardır. Çok kullanıcılı ticari hosting için sonraki aşamada ayrı node-agent ve daha sert sandboxing planlanmalıdır.

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

Root olarak:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/efkwn/elitecp/main/install.sh)
```

Kurucu admin kullanıcı adı/şifresi ve domain sorar. CloudPanel algılanırsa domaini otomatik olarak `http://127.0.0.1:9080` adresine reverse proxy olarak eklemeyi ve Let's Encrypt kurmayı dener.

## v0.1.x -> v0.2.0 güncelleme

Repository'nin `main` branch'ine v0.2.0 dosyalarını yükledikten sonra VPS'te:

```bash
sudo /opt/elitecp/src/update.sh
```

SQLite migration otomatik çalışır; mevcut bot ve dosyalar silinmez. Eski sürümde oluşturulmuş Docker container'lar ilk **Start/Restart** sırasında yeni runtime schema ile otomatik recreate edilir. Dosyalar bind mount altında kaldığı için korunur.

Güncelleme sonrası kontrol:

```bash
systemctl status elitecp --no-pager
journalctl -u elitecp -n 80 --no-pager
```

## Cloudflare

A/AAAA kaydının VPS'e yönelmiş olması gerekir. Let's Encrypt otomasyonu başarısız olursa CloudPanel'deki ilgili sitenin **SSL/TLS** ekranından sertifikayı tekrar kurabilir veya Cloudflare Origin Certificate kullanabilirsin.

## Servis komutları

```bash
systemctl status elitecp
systemctl restart elitecp
journalctl -u elitecp -f
/usr/local/bin/elitecp doctor
```

## Veriler

```text
/var/lib/elitecp/elitecp.db
/var/lib/elitecp/bots/<bot-id>/app/
/etc/elitecp/elitecp.env
```

Bot dosyalarını yedeklemek için `/var/lib/elitecp` dizinini yedeklemek yeterlidir.

## Güvenlik notları

Bu sürüm tek-admin / küçük hosting MVP'sidir. eLite CP sistem kullanıcısı Docker daemon'a erişir; Docker socket erişimi Linux'ta yüksek yetkilidir. Panel bot container'larında capability'leri düşürür, `no-new-privileges`, PID, RAM ve CPU limitleri uygular. Çok kullanıcılı ticari kullanım öncesi ayrı node-agent, RBAC, audit log, 2FA, secret encryption-at-rest ve daha sert sandboxing eklenmelidir.

Bot tokenları ve bot kodunun güvenliği panel yöneticisinin sorumluluğundadır.

## Geliştirme

Debian/Ubuntu üzerinde:

```bash
sudo apt install gcc libsqlite3-dev
CGO_ENABLED=1 go build -o elitecp .
ELITECP_DATA_DIR=./data ELITECP_DB=./data/dev.db ./elitecp setup-admin --username admin --password 'change-me-now'
ELITECP_DATA_DIR=./data ELITECP_DB=./data/dev.db ELITECP_LISTEN=127.0.0.1:9080 ./elitecp
```

Go tarafında üçüncü parti modül kullanılmaz. SQLite sistem `libsqlite3` kütüphanesi üzerinden bağlanır; frontend vanilla HTML/CSS/JS'dir.

## Lisans

MIT — `LICENSE` dosyasına bakın.
