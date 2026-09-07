# eLite CP v0.2.0 Upgrade

1. Bu paketin içeriğini GitHub repository `main` branch'ine yükle.
2. VPS'de root olarak çalıştır:

```bash
sudo /opt/elitecp/src/update.sh
```

3. Sürümü kontrol et:

```bash
/usr/local/bin/elitecp version
```

Beklenen çıktı:

```text
eLite CP 0.2.0
```

Mevcut botlar ve SQLite verileri silinmez. Updater önce `/var/lib/elitecp/backups/` altına veritabanı yedeği alır; uygulama açılırken v0.2 alanları otomatik migrate edilir.

## Python bot örneği

```text
Dependency File: requirements.txt
Main File: bot.py
Install Command: python -m pip install --disable-pip-version-check -r {{dependency_file}}
Startup Command: python {{main_file}}
```

`bot.py` içinde `import telebot` kullanılıyorsa `requirements.txt` örneği:

```text
pyTelegramBotAPI
```

Start'a basıldığında eLite CP sırasıyla per-bot virtualenv'i hazırlar, requirements değişmişse pip install çalıştırır ve ardından `python bot.py` başlatır.
