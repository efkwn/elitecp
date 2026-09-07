# Changelog

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
