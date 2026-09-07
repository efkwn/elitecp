const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const ASSET_VERSION = '0.6.1';

function initialLocale() {
  try { return localStorage.getItem('elitecp_locale') === 'tr' ? 'tr' : 'en'; }
  catch { return 'en'; }
}

const state = {
  user: null,
  bots: [],
  view: 'dashboard',
  bot: null,
  tab: 'overview',
  filePath: '',
  editorPath: '',
  console: null,
  statsTimer: null,
  system: null,
  systemTimer: null,
  systemHistory: { cpu: [], memory: [], disk: [] },
  sqlite: { databases: [], path: '', tables: [], table: '', rows: null, loading: false, error: '' },
  locale: initialLocale(),
};



const translations = {
  en: {
    'login.badge': 'Isolated Docker runtime',
    'login.heroTitle': 'Run your bots fast, clean and from one control plane.',
    'login.heroText': 'A lightweight control panel focused on Python and Node.js bots for Discord and Telegram.',
    'login.featureConsole': 'Live console',
    'login.featureDeps': 'Automatic dependency install',
    'login.featureFiles': 'File manager',
    'login.title': 'Welcome back',
    'login.subtitle': 'Sign in to continue to your control panel.',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'nav.dashboard': 'Dashboard',
    'nav.bots': 'Bots',
    'nav.panel': 'Panel',
    'nav.logout': 'Sign out',
    'nav.language': 'Language',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',
    'nav.mobileNavigation': 'Mobile navigation',
    'actions.newBot': 'New Bot',
    'actions.close': 'Close',
    'actions.cancel': 'Cancel',
    'actions.save': 'Save',
    'actions.refresh': 'Refresh',
    'actions.manage': 'Manage',
    'actions.start': 'Start',
    'actions.restart': 'Restart',
    'actions.stop': 'Stop',
    'actions.edit': 'Edit',
    'actions.run': 'Run',
    'actions.clear': 'Clear',
    'actions.upload': 'Upload',
    'actions.download': 'Download',
    'actions.delete': 'Delete',
    'actions.file': 'File',
    'actions.folder': 'Folder',
    'actions.upDirectory': 'Up Directory',
    'system.checkingDocker': 'Checking Docker',
    'system.dockerReady': 'Docker ready · v{version}',
    'system.dockerUnavailable': 'Docker unavailable',
    'system.error': 'System error',
    'system.ready': 'Docker ready',
    'system.dockerError': 'Docker error',
    'status.running': 'Running',
    'status.offline': 'Offline',
    'status.restarting': 'Restarting',
    'status.paused': 'Paused',
    'status.created': 'Ready',
    'status.dead': 'Error',
    'status.removing': 'Removing',
    'status.unknown': 'Unknown',
    'newBot.eyebrow': 'NEW INSTANCE',
    'newBot.title': 'Create Bot',
    'newBot.subtitle': 'Upload your files; eLite CP installs dependencies and then starts your bot.',
    'newBot.general': 'General',
    'newBot.botName': 'Bot name',
    'newBot.startupPlan': 'Startup Plan',
    'newBot.dependencyHelp': 'Python: requirements.txt · Node: package.json',
    'newBot.mainFileHelp': 'The file that starts your bot, e.g. bot.py / index.js.',
    'newBot.dependencyTokenHelp': 'is replaced with the dependency file path automatically.',
    'newBot.startupTokenHelp': 'is replaced with the main file path automatically. Dependencies run first.',
    'newBot.resources': 'Resources',
    'newBot.create': 'Create Bot',
    'pipeline.prepareRuntime': 'Prepare runtime',
    'pipeline.installDependencies': 'Install dependencies',
    'pipeline.startBot': 'Start bot',
    'pipeline.runtimePrepared': 'Runtime is prepared',
    'pipeline.dependenciesInstalled': 'Dependencies are installed',
    'pipeline.noInstallStep': 'No install step',
    'pipeline.fileStarted': '{file} is started',
    'fields.dependencyFile': 'Dependency file',
    'fields.mainFile': 'Main file',
    'fields.installCommand': 'Install command',
    'fields.startupCommand': 'Startup command',
    'editor.eyebrow': 'FILE EDITOR',
    'dashboard.subtitle': 'A quick overview of your bot infrastructure and VPS resources.',
    'dashboard.serverResources': 'Server resources',
    'dashboard.waitingMetrics': 'Waiting for metrics...',
    'dashboard.noMetrics': 'Server metrics are not available yet.',
    'dashboard.live4s': 'Live · 4 sec',
    'dashboard.cores': '{count} cores',
    'dashboard.used': '{value} used',
    'dashboard.everythingFine': 'Everything is under control.',
    'dashboard.needsAttention': 'Something needs your attention.',
    'dashboard.botSummary': '{running} bots running, {stopped} bots idle.',
    'dashboard.firstBot': 'Create your first bot and get it running in seconds.',
    'dashboard.instancesNeedAttention': '{count} instances need attention',
    'dashboard.infrastructureHealthy': 'Infrastructure healthy',
    'dashboard.dockerNeedsCheck': 'Docker needs attention',
    'dashboard.attention': 'Attention',
    'dashboard.systemHealthy': 'System healthy',
    'dashboard.runtimeOnline': 'Docker runtime online',
    'dashboard.runtimeChecking': 'Checking Docker runtime',
    'dashboard.botSummaryAria': 'Bot summary',
    'dashboard.total': 'Total',
    'dashboard.running': 'Running',
    'dashboard.offline': 'Offline',
    'dashboard.alerts': 'Alerts',
    'dashboard.botsTitle': 'Bots',
    'dashboard.botsText': 'Manage Python and Node.js containers from one place.',
    'bots.subtitle': 'Manage your Discord and Telegram bot containers.',
    'bots.title': 'Your bot infrastructure',
    'bots.summary': '{total} instances · {running} running · isolated with Docker.',
    'bots.empty': 'No bots yet. Create your first instance with New Bot.',
    'toast.botCreated': 'Bot created. Upload your files, then press Start.',
    'tabs.overview': 'Overview',
    'tabs.console': 'Console',
    'tabs.files': 'Files',
    'tabs.sqlite': 'SQLite',
    'tabs.variables': 'Variables',
    'tabs.startupSettings': 'Startup & Settings',
    'detail.filesLoading': 'Loading files...',
    'detail.variablesLoading': 'Loading variables...',
    'detail.oom': 'The container was terminated because it reached the RAM limit (OOM). Increase the memory limit or reduce the bot memory usage.',
    'detail.lastExit': 'Last exit code: {code}{error}. Check the logs in the Console tab.',
    'detail.runningNote': 'Container is running. If the dependency file changes, dependencies are installed again automatically on the next start/restart.',
    'detail.offlineNote': 'Bot is offline. Upload your files and press Start; the startup pipeline will run automatically.',
    'overview.liveResources': 'Live resources',
    'overview.status': 'Status',
    'overview.currentUsage': 'Current usage',
    'overview.limit': 'Limit {value} MB',
    'overview.network': 'Network',
    'overview.startupPipeline': 'Startup pipeline',
    'overview.live5s': '5 sec',
    'overview.isolatedVenv': 'isolated per-bot venv',
    'overview.isolatedNodeModules': 'isolated node_modules',
    'botAction.starting': 'Starting bot...',
    'botAction.restarting': 'Restarting bot...',
    'botAction.stopping': 'Stopping bot...',
    'botAction.rebuilding': 'Rebuilding container...',
    'botAction.reinstalling': 'Dependencies will be reinstalled...',
    'botAction.applying': 'Applying action...',
    'botAction.reinstallDone': 'Dependency installation triggered. Follow the progress in Console.',
    'botAction.done': 'Action completed.',
    'console.live': 'Live Console',
    'console.clear': 'Clear',
    'console.dependencies': 'Dependencies',
    'console.connecting': 'eLite CP console is connecting...',
    'console.placeholder': 'Run command · pip list, python --version, ls -la ...',
    'console.waiting': 'Console connection is waiting; it will reconnect when the container starts.',
    'console.noOutput': '(no output)',
    'files.dropzone': 'Drop ZIP or files here · ZIP archives are extracted automatically and safely',
    'files.empty': 'This folder is empty.',
    'files.uploading': 'Uploading {count} file(s)...',
    'files.uploaded': 'Files uploaded. If the dependency file changed, the next start/restart will install dependencies automatically.',
    'files.saved': 'File saved.',
    'files.filePrompt': 'File name (e.g. bot.py):',
    'files.folderPrompt': 'Folder name:',
    'files.deleteConfirm': 'Delete this path?\n{path}',
    'files.deleted': 'Deleted.',
    'sqlite.title': 'SQLite Explorer',
    'sqlite.subtitle': 'Browse SQLite databases found in this bot\'s files without leaving eLite CP.',
    'sqlite.readOnly': 'Read-only',
    'sqlite.scanNote': 'Databases are detected automatically by their SQLite file signature.',
    'sqlite.refresh': 'Refresh',
    'sqlite.databases': 'Databases',
    'sqlite.tables': 'Tables',
    'sqlite.noDatabases': 'No SQLite database was found in this bot\'s files.',
    'sqlite.noTables': 'This database has no user tables.',
    'sqlite.selectDatabase': 'Select a database to browse its tables.',
    'sqlite.selectTable': 'Select a table to preview its rows.',
    'sqlite.emptyRows': 'This table is empty.',
    'sqlite.previous': 'Previous',
    'sqlite.next': 'Next',
    'sqlite.rowsRange': 'Rows {from}–{to}',
    'sqlite.liveNote': 'The bot can keep writing to the database while you browse. Refresh to load the latest data.',
    'sqlite.loading': 'Loading SQLite data...',
    'env.title': 'Environment Variables',
    'env.variable': 'Variable',
    'env.note': 'Store secrets such as Discord / Telegram tokens here. They are passed to the container environment when saved.',
    'env.saveRebuild': 'Save & Rebuild',
    'env.value': 'value',
    'env.saved': 'Variables saved and container updated.',
    'settings.generalResources': 'General & Resources',
    'settings.botName': 'Bot name',
    'settings.startupPlan': 'Startup Plan',
    'settings.dependencyHelp': 'Dependency install runs again automatically when this file changes.',
    'settings.mainFileHelp': 'The actual entry file that starts the bot.',
    'settings.example': 'Example:',
    'settings.startupHelp': 'Dependencies run first, then this command.',
    'settings.reinstallDependencies': 'Reinstall Dependencies',
    'settings.rebuildContainer': 'Rebuild Container',
    'settings.saveRebuild': 'Save & Rebuild',
    'settings.dangerZone': 'Danger Zone',
    'settings.dangerText': 'Permanently deletes the bot, its Docker container and all bot files.',
    'settings.deleteBot': 'Delete Bot',
    'settings.saved': 'Startup plan and settings saved.',
    'settings.deleteConfirm': 'Permanently delete {name} and all of its files?',
    'settings.deleted': 'Bot deleted.',
  },
  tr: {
    'login.badge': 'Docker ile izole runtime',
    'login.heroTitle': 'Botlarını hızlı, sade ve tek panelden yönet.',
    'login.heroText': 'Discord ve Telegram botları için Python ve Node.js odaklı hafif kontrol paneli.',
    'login.featureConsole': 'Canlı console',
    'login.featureDeps': 'Otomatik dependency kurulumu',
    'login.featureFiles': 'Dosya yöneticisi',
    'login.title': 'Tekrar hoş geldin',
    'login.subtitle': 'Kontrol paneline devam etmek için giriş yap.',
    'login.username': 'Kullanıcı adı',
    'login.password': 'Şifre',
    'login.submit': 'Giriş Yap',
    'nav.dashboard': 'Dashboard',
    'nav.bots': 'Botlar',
    'nav.panel': 'Panel',
    'nav.logout': 'Çıkış Yap',
    'nav.language': 'Dil',
    'nav.openMenu': 'Menüyü aç',
    'nav.closeMenu': 'Menüyü kapat',
    'nav.mobileNavigation': 'Mobil navigasyon',
    'actions.newBot': 'Yeni Bot',
    'actions.close': 'Kapat',
    'actions.cancel': 'Vazgeç',
    'actions.save': 'Kaydet',
    'actions.refresh': 'Yenile',
    'actions.manage': 'Yönet',
    'actions.start': 'Başlat',
    'actions.restart': 'Restart',
    'actions.stop': 'Durdur',
    'actions.edit': 'Düzenle',
    'actions.run': 'Çalıştır',
    'actions.clear': 'Temizle',
    'actions.upload': 'Yükle',
    'actions.download': 'İndir',
    'actions.delete': 'Sil',
    'actions.file': 'Dosya',
    'actions.folder': 'Klasör',
    'actions.upDirectory': 'Üst Dizin',
    'system.checkingDocker': 'Docker kontrol ediliyor',
    'system.dockerReady': 'Docker hazır · v{version}',
    'system.dockerUnavailable': 'Docker erişilemiyor',
    'system.error': 'Sistem hatası',
    'system.ready': 'Docker hazır',
    'system.dockerError': 'Docker hata',
    'status.running': 'Çalışıyor',
    'status.offline': 'Kapalı',
    'status.restarting': 'Yeniden başlatılıyor',
    'status.paused': 'Duraklatıldı',
    'status.created': 'Hazır',
    'status.dead': 'Hata',
    'status.removing': 'Siliniyor',
    'status.unknown': 'Bilinmiyor',
    'newBot.eyebrow': 'YENİ INSTANCE',
    'newBot.title': 'Bot Oluştur',
    'newBot.subtitle': 'Dosyaları yükle; eLite CP dependency adımını çalıştırıp ardından botunu başlatsın.',
    'newBot.general': 'Genel',
    'newBot.botName': 'Bot adı',
    'newBot.startupPlan': 'Startup Planı',
    'newBot.dependencyHelp': 'Python: requirements.txt · Node: package.json',
    'newBot.mainFileHelp': 'Botu çalıştıran dosya; örn. bot.py / index.js.',
    'newBot.dependencyTokenHelp': 'otomatik olarak dependency dosya yoluna dönüşür.',
    'newBot.startupTokenHelp': 'otomatik ana dosya yoluna dönüşür. Önce dependency adımı çalışır.',
    'newBot.resources': 'Kaynaklar',
    'newBot.create': 'Botu Oluştur',
    'pipeline.prepareRuntime': 'Runtime hazırlanır',
    'pipeline.installDependencies': 'Kütüphaneler kurulur',
    'pipeline.startBot': 'Bot başlatılır',
    'pipeline.runtimePrepared': 'Runtime hazırlanır',
    'pipeline.dependenciesInstalled': 'Dependencies kurulur',
    'pipeline.noInstallStep': 'Kurulum adımı yok',
    'pipeline.fileStarted': '{file} başlatılır',
    'fields.dependencyFile': 'Dependency dosyası',
    'fields.mainFile': 'Ana dosya',
    'fields.installCommand': 'Kurulum komutu',
    'fields.startupCommand': 'Startup komutu',
    'editor.eyebrow': 'DOSYA EDİTÖRÜ',
    'dashboard.subtitle': 'Bot altyapının ve VPS kaynaklarının kısa özeti.',
    'dashboard.serverResources': 'Sunucu kaynakları',
    'dashboard.waitingMetrics': 'Veriler bekleniyor...',
    'dashboard.noMetrics': 'Sunucu metrikleri henüz alınamadı.',
    'dashboard.live4s': 'Canlı · 4 sn',
    'dashboard.cores': '{count} çekirdek',
    'dashboard.used': '{value} kullanılan',
    'dashboard.everythingFine': 'Her şey kontrol altında.',
    'dashboard.needsAttention': 'Kontrol edilmesi gereken bir şey var.',
    'dashboard.botSummary': '{running} bot aktif, {stopped} bot beklemede.',
    'dashboard.firstBot': 'İlk botunu oluşturup saniyeler içinde çalıştırabilirsin.',
    'dashboard.instancesNeedAttention': '{count} instance kontrol bekliyor',
    'dashboard.infrastructureHealthy': 'Altyapı sağlıklı',
    'dashboard.dockerNeedsCheck': 'Docker kontrol gerekli',
    'dashboard.attention': 'Dikkat',
    'dashboard.systemHealthy': 'Sistem sağlıklı',
    'dashboard.runtimeOnline': 'Docker runtime online',
    'dashboard.runtimeChecking': 'Docker runtime kontrol ediliyor',
    'dashboard.botSummaryAria': 'Bot özeti',
    'dashboard.total': 'Toplam',
    'dashboard.running': 'Çalışan',
    'dashboard.offline': 'Kapalı',
    'dashboard.alerts': 'Uyarı',
    'dashboard.botsTitle': 'Botlar',
    'dashboard.botsText': 'Python ve Node.js containerlarını tek yerden yönet.',
    'bots.subtitle': 'Discord ve Telegram bot containerlarını yönet.',
    'bots.title': 'Bot altyapın',
    'bots.summary': '{total} instance · {running} aktif · Docker ile birbirinden izole.',
    'bots.empty': 'Henüz bot yok. Yeni Bot ile ilk instanceını oluştur.',
    'toast.botCreated': 'Bot oluşturuldu. Dosyaları yükledikten sonra Başlat diyebilirsin.',
    'tabs.overview': 'Genel',
    'tabs.console': 'Console',
    'tabs.files': 'Dosyalar',
    'tabs.sqlite': 'SQLite',
    'tabs.variables': 'Variables',
    'tabs.startupSettings': 'Startup & Ayarlar',
    'detail.filesLoading': 'Dosyalar yükleniyor...',
    'detail.variablesLoading': 'Variables yükleniyor...',
    'detail.oom': 'Container RAM limiti nedeniyle sonlandırıldı (OOM). RAM limitini yükselt veya botun bellek kullanımını azalt.',
    'detail.lastExit': 'Son çıkış kodu: {code}{error}. Console sekmesindeki logları kontrol et.',
    'detail.runningNote': 'Container aktif. Dependency dosyası değişirse sonraki start/restart sırasında otomatik olarak tekrar kurulur.',
    'detail.offlineNote': 'Bot kapalı. Dosyalarını yükledikten sonra Başlat dediğinde startup pipeline otomatik çalışır.',
    'overview.liveResources': 'Canlı kaynaklar',
    'overview.status': 'Durum',
    'overview.currentUsage': 'Anlık kullanım',
    'overview.limit': 'Limit {value} MB',
    'overview.network': 'Network',
    'overview.startupPipeline': 'Startup pipeline',
    'overview.live5s': '5 sn',
    'overview.isolatedVenv': 'izole per-bot venv',
    'overview.isolatedNodeModules': 'izole node_modules',
    'botAction.starting': 'Bot başlatılıyor...',
    'botAction.restarting': 'Bot yeniden başlatılıyor...',
    'botAction.stopping': 'Bot durduruluyor...',
    'botAction.rebuilding': 'Container yeniden oluşturuluyor...',
    'botAction.reinstalling': 'Dependencies yeniden kurulacak...',
    'botAction.applying': 'İşlem uygulanıyor...',
    'botAction.reinstallDone': 'Dependency kurulumu tetiklendi. Console’dan takip edebilirsin.',
    'botAction.done': 'İşlem tamamlandı.',
    'console.live': 'Canlı Console',
    'console.clear': 'Temizle',
    'console.dependencies': 'Dependencies',
    'console.connecting': 'eLite CP console bağlanıyor...',
    'console.placeholder': 'Komut çalıştır · pip list, python --version, ls -la ...',
    'console.waiting': 'Console bağlantısı beklemede; container başlatıldığında tekrar bağlanır.',
    'console.noOutput': '(çıktı yok)',
    'files.dropzone': 'ZIP veya dosyaları buraya bırak · ZIP güvenli şekilde otomatik açılır',
    'files.empty': 'Bu klasör boş.',
    'files.uploading': '{count} dosya yükleniyor...',
    'files.uploaded': 'Dosyalar yüklendi. Dependency dosyası değiştiyse sonraki start/restart otomatik kuracak.',
    'files.saved': 'Dosya kaydedildi.',
    'files.filePrompt': 'Dosya adı (örn. bot.py):',
    'files.folderPrompt': 'Klasör adı:',
    'files.deleteConfirm': 'Bu yol silinsin mi?\n{path}',
    'files.deleted': 'Silindi.',
    'sqlite.title': 'SQLite Gezgini',
    'sqlite.subtitle': 'Bot dosyalarının içindeki SQLite veritabanlarını eLite CP üzerinden görüntüle.',
    'sqlite.readOnly': 'Salt okunur',
    'sqlite.scanNote': 'Veritabanları SQLite dosya imzasına göre otomatik algılanır.',
    'sqlite.refresh': 'Yenile',
    'sqlite.databases': 'Veritabanları',
    'sqlite.tables': 'Tablolar',
    'sqlite.noDatabases': 'Bu botun dosyalarında SQLite veritabanı bulunamadı.',
    'sqlite.noTables': 'Bu veritabanında kullanıcı tablosu yok.',
    'sqlite.selectDatabase': 'Tabloları görmek için bir veritabanı seç.',
    'sqlite.selectTable': 'Satırları görmek için bir tablo seç.',
    'sqlite.emptyRows': 'Bu tablo boş.',
    'sqlite.previous': 'Önceki',
    'sqlite.next': 'Sonraki',
    'sqlite.rowsRange': 'Satırlar {from}–{to}',
    'sqlite.liveNote': 'Sen görüntülerken bot veritabanına yazmaya devam edebilir. En güncel veriler için yenile.',
    'sqlite.loading': 'SQLite verileri yükleniyor...',
    'env.title': 'Environment Variables',
    'env.variable': 'Variable',
    'env.note': 'Discord / Telegram token gibi secret değerleri burada tutabilirsin. Kaydedildiğinde container environmentına aktarılır.',
    'env.saveRebuild': 'Kaydet & Rebuild',
    'env.value': 'değer',
    'env.saved': 'Variables kaydedildi ve container güncellendi.',
    'settings.generalResources': 'Genel & Kaynaklar',
    'settings.botName': 'Bot adı',
    'settings.startupPlan': 'Startup Planı',
    'settings.dependencyHelp': 'Dosya değiştiğinde dependency kurulumu otomatik yeniden çalışır.',
    'settings.mainFileHelp': 'Botu gerçekten çalıştıran giriş dosyası.',
    'settings.example': 'Örn:',
    'settings.startupHelp': 'Önce dependency adımı, sonra bu komut çalışır.',
    'settings.reinstallDependencies': 'Dependencies’i Yeniden Kur',
    'settings.rebuildContainer': 'Container Rebuild',
    'settings.saveRebuild': 'Kaydet & Rebuild',
    'settings.dangerZone': 'Tehlikeli Alan',
    'settings.dangerText': 'Botu, Docker containerını ve botun tüm dosyalarını kalıcı olarak siler.',
    'settings.deleteBot': 'Botu Sil',
    'settings.saved': 'Startup planı ve ayarlar kaydedildi.',
    'settings.deleteConfirm': '{name} ve tüm dosyaları kalıcı olarak silinsin mi?',
    'settings.deleted': 'Bot silindi.',
  },
};

function t(key, vars = {}) {
  let text = translations[state.locale]?.[key] ?? translations.en[key] ?? key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

function applyStaticTranslations() {
  document.documentElement.lang = state.locale;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('[data-lang]').forEach(el => el.classList.toggle('active', el.dataset.lang === state.locale));
}

async function setLocale(locale) {
  state.locale = locale === 'tr' ? 'tr' : 'en';
  try { localStorage.setItem('elitecp_locale', state.locale); } catch {}
  applyStaticTranslations();
  if (state.user) {
    stopConsole();
    await refreshSystem();
    render();
  }
}

const runtimeDefaults = {
  python: {
    dependency_file: 'requirements.txt',
    main_file: 'bot.py',
    install_command: 'python -m pip install --disable-pip-version-check -r {{dependency_file}}',
    startup: 'python {{main_file}}',
  },
  node: {
    dependency_file: 'package.json',
    main_file: 'index.js',
    install_command: 'if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi',
    startup: 'node {{main_file}}',
  },
};

function icon(name, cls = '') {
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="/icons.svg?v=${ASSET_VERSION}#${name}"></use></svg>`;
}

async function api(path, opts = {}) {
  const options = { ...opts, headers: { ...(opts.headers || {}) } };
  if (options.body && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    if (typeof options.body !== 'string') options.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/login') showLogin();
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function toast(msg, error = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function esc(v = '') {
  return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatPercent(v) {
  const n = Number(v || 0);
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
}

function formatUptime(seconds) {
  let s = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(s / 86400); s %= 86400;
  const hours = Math.floor(s / 3600); s %= 3600;
  const mins = Math.floor(s / 60);
  if (state.locale === 'tr') {
    if (days) return `${days}g ${hours}sa ${mins}dk`;
    if (hours) return `${hours}sa ${mins}dk`;
    return `${mins}dk`;
  }
  if (days) return `${days}d ${hours}h ${mins}m`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(v || 0)));
}

function pushMetricHistory(metrics) {
  if (!metrics) return;
  const values = {
    cpu: clamp(metrics.cpu_percent),
    memory: clamp(metrics.memory_percent),
    disk: clamp(metrics.disk_percent),
  };
  Object.entries(values).forEach(([key, value]) => {
    state.systemHistory[key].push(value);
    if (state.systemHistory[key].length > 28) state.systemHistory[key].shift();
  });
}

function sparkline(values = []) {
  const list = values.length ? values : [0, 0];
  const width = 180;
  const height = 38;
  const step = list.length > 1 ? width / (list.length - 1) : width;
  const points = list.map((v, i) => `${(i * step).toFixed(1)},${(height - (clamp(v) / 100) * (height - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"></polyline></svg>`;
}

function statusLabel(s) {
  const key = ({
    running: 'status.running', offline: 'status.offline', restarting: 'status.restarting', paused: 'status.paused',
    created: 'status.created', dead: 'status.dead', removing: 'status.removing', unknown: 'status.unknown',
  })[s] || 'status.unknown';
  return t(key);
}

function runtimeLabel(runtime) { return runtime === 'python' ? 'Python 3.12' : 'Node.js 22'; }
function runtimeShort(runtime) { return runtime === 'python' ? 'PY' : 'JS'; }

async function boot() {
  applyStaticTranslations();
  wireStatic();
  try {
    const me = await api('/api/me');
    state.user = me.user;
    showApp();
    await Promise.all([refreshSystem(), loadBots()]);
    render();
  } catch {
    showLogin();
  }
}

function wireStatic() {
  $('#loginForm').addEventListener('submit', login);
  $('#logoutBtn').addEventListener('click', logout);
  $('#newBotBtn').addEventListener('click', openNewBot);
  $('#runtimeSelect').addEventListener('change', e => applyRuntimeDefaults(e.target.value));
  $('#botForm').addEventListener('submit', createBot);
  $$('[data-close-dialog]').forEach(b => b.addEventListener('click', () => $('#botDialog').close()));
  $('#closeEditor').addEventListener('click', () => $('#editorDialog').close());
  $('#cancelEditor').addEventListener('click', () => $('#editorDialog').close());
  $('#saveEditor').addEventListener('click', saveEditor);
  $$('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    state.bot = null;
    stopConsole();
    closeSidebar();
    setActiveNav();
    render();
  }));
  $('#mobileMenu').addEventListener('click', openSidebar);
  $('#sidebarBackdrop').addEventListener('click', closeSidebar);
  $$('.mobile-dock-item[data-view]').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    state.bot = null;
    stopConsole();
    setActiveNav();
    render();
  }));
  $('#mobileNewBot')?.addEventListener('click', openNewBot);
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => setLocale(b.dataset.lang)));
}

function openSidebar() {
  $('.sidebar').classList.add('open');
  $('#sidebarBackdrop').classList.add('show');
}
function closeSidebar() {
  $('.sidebar').classList.remove('open');
  $('#sidebarBackdrop').classList.remove('show');
}

async function login(e) {
  e.preventDefault();
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: { username: $('#loginUser').value, password: $('#loginPass').value },
    });
    state.user = data.user;
    showApp();
    await Promise.all([refreshSystem(), loadBots()]);
    render();
  } catch (err) { toast(err.message, true); }
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  state.user = null;
  state.bot = null;
  showLogin();
}

function showLogin() {
  stopConsole();
  closeSidebar();
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
  setTimeout(() => $('#loginUser').focus(), 50);
}
function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  const username = state.user?.username || 'admin';
  $('#userChip').innerHTML = `<span class="user-avatar">${esc(username.slice(0, 1).toUpperCase())}</span><span>${esc(username)}</span>`;
  syncMobileDock();
}

function syncMobileDock() {
  $$('.mobile-dock-item[data-view]').forEach(x => x.classList.toggle('active', !state.bot && x.dataset.view === state.view));
}

function setActiveNav() {
  $$('.nav-item[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === state.view));
  syncMobileDock();
}

async function refreshSystem() {
  try {
    const s = await api('/api/system');
    state.system = s;
    pushMetricHistory(s.metrics);
    $('#dockerDot').className = `dot ${s.docker_ok ? 'ok' : 'bad'}`;
    $('#dockerText').textContent = s.docker_ok ? t('system.dockerReady', { version: s.version }) : t('system.dockerUnavailable');
    return s;
  } catch {
    $('#dockerDot').className = 'dot bad';
    $('#dockerText').textContent = t('system.error');
    return null;
  }
}

async function loadBots() {
  const d = await api('/api/bots');
  state.bots = d.bots || [];
  $('#botCountBadge').textContent = state.bots.length;
}

function render() {
  clearInterval(state.statsTimer);
  clearInterval(state.systemTimer);
  if (state.bot) return renderBotDetail();
  if (state.view === 'bots') renderBots();
  else renderDashboard();
}

function header(title, sub) {
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = sub;
}

function emptyBots() {
  return `<div class="empty"><div class="empty-icon">${icon('bot')}</div>${t('bots.empty')}</div>`;
}

function botCards(bots) {
  if (!bots.length) return emptyBots();
  return `<div class="bot-list">${bots.map(b => `
    <article class="bot-card" data-bot="${b.id}" tabindex="0">
      <div class="bot-card-accent"></div>
      <div class="bot-card-top">
        <div class="bot-ident">
          <div class="bot-icon ${b.runtime === 'node' ? 'node' : ''}">${runtimeShort(b.runtime)}</div>
          <div class="bot-title-wrap"><p class="bot-name">${esc(b.name)}</p><span class="bot-meta">${runtimeLabel(b.runtime)} <i>·</i> ${b.id}</span></div>
        </div>
        <span class="status ${esc(b.status)}"><i class="status-dot"></i>${statusLabel(b.status)}</span>
      </div>
      <div class="bot-resources">
        <span>${icon('memory')}<span>RAM</span><b>${b.memory_mb} MB</b></span>
        <span>${icon('cpu')}<span>CPU</span><b>${b.cpus}</b></span>
        <span class="bot-open">${t('actions.manage')} ${icon('chevron-right')}</span>
      </div>
    </article>`).join('')}</div>`;
}

function wireBotCards() {
  $$('[data-bot]').forEach(el => {
    el.addEventListener('click', () => openBot(el.dataset.bot));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openBot(el.dataset.bot); });
  });
}

function serverMetricCardsHTML() {
  const m = state.system?.metrics;
  if (!m) {
    return `<section class="resource-section"><div class="section-head"><div><span class="section-kicker">VPS HEALTH</span><h2>${t('dashboard.serverResources')}</h2></div><span class="server-live">${t('dashboard.waitingMetrics')}</span></div><div class="empty resource-empty">${t('dashboard.noMetrics')}</div></section>`;
  }
  const cpu = clamp(m.cpu_percent);
  const memory = clamp(m.memory_percent);
  const disk = clamp(m.disk_percent);
  return `<section class="resource-section">
    <div class="section-head">
      <div><span class="section-kicker">VPS HEALTH</span><h2>${t('dashboard.serverResources')}</h2><p>${esc(m.hostname || 'VPS')} · ${esc(m.os || 'Linux')}</p></div>
      <span class="server-live"><span class="live-pulse"></span> ${t('dashboard.live4s')}</span>
    </div>
    <div class="server-metrics-grid">
      <article class="server-metric" data-system-card="cpu">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('cpu')}</span><span>CPU</span></div><b id="sysCpuValue">${formatPercent(cpu)}</b></div>
        <div class="server-progress"><span id="sysCpuBar" style="width:${cpu}%"></span></div>
        <div id="sysCpuGraph" class="server-graph">${sparkline(state.systemHistory.cpu)}</div>
        <div class="server-metric-foot"><span id="sysCpuSub">${t('dashboard.cores', { count: m.cpu_cores || 1 })}</span><span id="sysLoadSub">Load ${Number(m.load_1 || 0).toFixed(2)}</span></div>
      </article>
      <article class="server-metric" data-system-card="memory">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('memory')}</span><span>RAM</span></div><b id="sysRamValue">${formatPercent(memory)}</b></div>
        <div class="server-progress"><span id="sysRamBar" style="width:${memory}%"></span></div>
        <div id="sysRamGraph" class="server-graph">${sparkline(state.systemHistory.memory)}</div>
        <div class="server-metric-foot"><span id="sysRamUsed">${t('dashboard.used', { value: formatBytes(m.memory_used_bytes) })}</span><span id="sysRamTotal">/ ${formatBytes(m.memory_total_bytes)}</span></div>
      </article>
      <article class="server-metric" data-system-card="disk">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('disk')}</span><span>Disk</span></div><b id="sysDiskValue">${formatPercent(disk)}</b></div>
        <div class="server-progress"><span id="sysDiskBar" style="width:${disk}%"></span></div>
        <div id="sysDiskGraph" class="server-graph">${sparkline(state.systemHistory.disk)}</div>
        <div class="server-metric-foot"><span id="sysDiskUsed">${t('dashboard.used', { value: formatBytes(m.disk_used_bytes) })}</span><span id="sysDiskTotal">/ ${formatBytes(m.disk_total_bytes)}</span></div>
      </article>
      <article class="server-metric uptime-metric" data-system-card="uptime">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('clock')}</span><span>Uptime</span></div><span class="status running"><i class="status-dot"></i>Online</span></div>
        <div id="sysUptime" class="uptime-value">${formatUptime(m.uptime_seconds)}</div>
        <div class="uptime-track"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="server-metric-foot"><span id="sysHost">${esc(m.hostname || 'VPS')}</span><span>${state.system?.docker_ok ? t('system.ready') : t('system.dockerError')}</span></div>
      </article>
    </div>
  </section>`;
}

function updateSystemCards() {
  const m = state.system?.metrics;
  if (!m || !$('#sysCpuValue')) return;
  const cpu = clamp(m.cpu_percent);
  const memory = clamp(m.memory_percent);
  const disk = clamp(m.disk_percent);
  $('#sysCpuValue').textContent = formatPercent(cpu);
  $('#sysCpuBar').style.width = `${cpu}%`;
  $('#sysCpuGraph').innerHTML = sparkline(state.systemHistory.cpu);
  $('#sysCpuSub').textContent = t('dashboard.cores', { count: m.cpu_cores || 1 });
  $('#sysLoadSub').textContent = `Load ${Number(m.load_1 || 0).toFixed(2)}`;
  $('#sysRamValue').textContent = formatPercent(memory);
  $('#sysRamBar').style.width = `${memory}%`;
  $('#sysRamGraph').innerHTML = sparkline(state.systemHistory.memory);
  $('#sysRamUsed').textContent = t('dashboard.used', { value: formatBytes(m.memory_used_bytes) });
  $('#sysRamTotal').textContent = `/ ${formatBytes(m.memory_total_bytes)}`;
  $('#sysDiskValue').textContent = formatPercent(disk);
  $('#sysDiskBar').style.width = `${disk}%`;
  $('#sysDiskGraph').innerHTML = sparkline(state.systemHistory.disk);
  $('#sysDiskUsed').textContent = t('dashboard.used', { value: formatBytes(m.disk_used_bytes) });
  $('#sysDiskTotal').textContent = `/ ${formatBytes(m.disk_total_bytes)}`;
  $('#sysUptime').textContent = formatUptime(m.uptime_seconds);
  $('#sysHost').textContent = m.hostname || 'VPS';
}

async function refreshDashboardMetrics() {
  if (state.bot || state.view !== 'dashboard') return;
  await refreshSystem();
  updateSystemCards();
}

function renderDashboard() {
  header('Dashboard', t('dashboard.subtitle'));
  const running = state.bots.filter(b => b.status === 'running').length;
  const stopped = Math.max(0, state.bots.length - running);
  const problem = state.bots.filter(b => b.state?.oom_killed || (b.state?.exit_code > 0 && b.status !== 'running')).length;
  const healthText = problem
    ? t('dashboard.instancesNeedAttention', { count: problem })
    : (state.system?.docker_ok ? t('dashboard.infrastructureHealthy') : t('dashboard.dockerNeedsCheck'));
  $('#content').innerHTML = `
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <span class="section-kicker">ELITE CONTROL PLANE</span>
        <h2>${problem ? t('dashboard.needsAttention') : t('dashboard.everythingFine')}</h2>
        <p>${state.bots.length ? t('dashboard.botSummary', { running, stopped }) : t('dashboard.firstBot')} ${esc(healthText)}.</p>
      </div>
      <div class="hero-status"><span class="hero-status-icon ${problem ? 'warn' : ''}">${icon(problem ? 'alert' : 'shield')}</span><div><b>${problem ? t('dashboard.attention') : t('dashboard.systemHealthy')}</b><span>${state.system?.docker_ok ? t('dashboard.runtimeOnline') : t('dashboard.runtimeChecking')}</span></div></div>
    </section>
    ${serverMetricCardsHTML()}
    <section class="summary-strip" aria-label="${esc(t('dashboard.botSummaryAria'))}">
      <div class="summary-item"><span class="summary-icon">${icon('bot')}</span><div><small>${t('dashboard.total')}</small><strong>${state.bots.length}</strong></div></div>
      <div class="summary-item"><span class="summary-icon green">${icon('play')}</span><div><small>${t('dashboard.running')}</small><strong>${running}</strong></div></div>
      <div class="summary-item"><span class="summary-icon neutral">${icon('stop')}</span><div><small>${t('dashboard.offline')}</small><strong>${stopped}</strong></div></div>
      <div class="summary-item"><span class="summary-icon ${problem ? 'red' : 'green'}">${icon(problem ? 'alert' : 'check')}</span><div><small>${t('dashboard.alerts')}</small><strong>${problem}</strong></div></div>
    </section>
    <section class="content-section">
      <div class="section-head compact"><div><span class="section-kicker">INSTANCES</span><h2>${t('dashboard.botsTitle')}</h2><p>${t('dashboard.botsText')}</p></div><button class="btn quiet" id="dashRefresh">${icon('refresh')} ${t('actions.refresh')}</button></div>
      ${botCards(state.bots)}
    </section>`;
  wireBotCards();
  updateSystemCards();
  clearInterval(state.systemTimer);
  state.systemTimer = setInterval(refreshDashboardMetrics, 4000);
  $('#dashRefresh')?.addEventListener('click', async () => {
    await Promise.all([refreshSystem(), loadBots()]);
    renderDashboard();
  });
}

function renderBots() {
  header(t('nav.bots'), t('bots.subtitle'));
  const running = state.bots.filter(b => b.status === 'running').length;
  $('#content').innerHTML = `<section class="page-intro"><div><span class="section-kicker">INSTANCES</span><h2>${t('bots.title')}</h2><p>${t('bots.summary', { total: state.bots.length, running })}</p></div><button class="btn primary" id="botsNew">${icon('plus')} ${t('actions.newBot')}</button></section>${botCards(state.bots)}`;
  $('#botsNew')?.addEventListener('click', openNewBot);
  wireBotCards();
}

function applyRuntimeDefaults(runtime) {
  const d = runtimeDefaults[runtime] || runtimeDefaults.python;
  $('#dependencyFileInput').value = d.dependency_file;
  $('#mainFileInput').value = d.main_file;
  $('#installCommandInput').value = d.install_command;
  $('#startupInput').value = d.startup;
}

function openNewBot() {
  $('#botForm').reset();
  $('#runtimeSelect').value = 'python';
  applyRuntimeDefaults('python');
  $('#botDialog').showModal();
  setTimeout(() => $('#botForm input[name="name"]').focus(), 30);
}

async function createBot(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    name: fd.get('name'),
    runtime: fd.get('runtime'),
    dependency_file: fd.get('dependency_file'),
    main_file: fd.get('main_file'),
    install_command: fd.get('install_command'),
    startup: fd.get('startup'),
    memory_mb: Number(fd.get('memory_mb')),
    cpus: Number(fd.get('cpus')),
  };
  try {
    const d = await api('/api/bots', { method: 'POST', body: payload });
    $('#botDialog').close();
    toast(t('toast.botCreated'));
    await loadBots();
    openBot(d.bot.id);
  } catch (err) { toast(err.message, true); }
}

async function openBot(id) {
  try {
    const d = await api(`/api/bots/${id}`);
    state.bot = d.bot;
    state.tab = 'overview';
    state.filePath = '';
    state.sqlite = { databases: [], path: '', tables: [], table: '', rows: null, loading: false, error: '' };
    state.view = 'bots';
    setActiveNav();
    render();
  } catch (err) { toast(err.message, true); }
}

function tabDef() {
  return [
    ['overview', 'dashboard', t('tabs.overview')],
    ['console', 'terminal', t('tabs.console')],
    ['files', 'folder', t('tabs.files')],
    ['sqlite', 'sqlite', t('tabs.sqlite')],
    ['env', 'key', t('tabs.variables')],
    ['settings', 'settings', t('tabs.startupSettings')],
  ];
}

function botDetailShell(inner) {
  const b = state.bot;
  header(b.name, `${runtimeLabel(b.runtime)} · ${b.id}`);
  return `
    <section class="instance-hero">
      <div class="detail-title">
        <div class="bot-icon hero-bot-icon ${b.runtime === 'node' ? 'node' : ''}">${runtimeShort(b.runtime)}</div>
        <div class="detail-title-copy">
          <div class="instance-label">INSTANCE <span>/${esc(b.id)}</span></div>
          <h2>${esc(b.name)}</h2>
          <div class="detail-title-meta"><span class="status ${esc(b.status)}"><i class="status-dot"></i>${statusLabel(b.status)}</span><span class="runtime-chip">${runtimeLabel(b.runtime)}</span><span class="runtime-chip">${b.memory_mb} MB · ${b.cpus} CPU</span></div>
        </div>
      </div>
      <div class="action-row">
        <button class="btn success" data-action="start">${icon('play')} ${t('actions.start')}</button>
        <button class="btn" data-action="restart">${icon('restart')} ${t('actions.restart')}</button>
        <button class="btn" data-action="stop">${icon('stop')} ${t('actions.stop')}</button>
      </div>
    </section>
    <div class="tabs detail-tabs">${tabDef().map(([k, i, v]) => `<button class="tab ${state.tab === k ? 'active' : ''}" data-tab="${k}">${icon(i)}<span>${v}</span></button>`).join('')}</div>
    <div class="detail-content">${inner}</div>`;
}

function wireDetail() {
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
    stopConsole();
    state.tab = b.dataset.tab;
    renderBotDetail();
  }));
  $$('[data-action]').forEach(b => b.addEventListener('click', () => botAction(b.dataset.action)));
}

async function renderBotDetail() {
  if (!state.bot) return;
  clearInterval(state.statsTimer);
  clearInterval(state.systemTimer);
  let inner = '';
  if (state.tab === 'overview') inner = overviewHTML();
  else if (state.tab === 'console') inner = consoleHTML();
  else if (state.tab === 'files') inner = `<div id="filesRoot"><div class="empty">${t('detail.filesLoading')}</div></div>`;
  else if (state.tab === 'sqlite') inner = `<div id="sqliteRoot"><div class="empty">${t('sqlite.loading')}</div></div>`;
  else if (state.tab === 'env') inner = `<div id="envRoot"><div class="empty">${t('detail.variablesLoading')}</div></div>`;
  else inner = settingsHTML();

  $('#content').innerHTML = botDetailShell(inner);
  wireDetail();
  if (state.tab === 'overview') {
    $('#goStartup')?.addEventListener('click', () => { state.tab = 'settings'; renderBotDetail(); });
    loadStats();
    state.statsTimer = setInterval(loadStats, 5000);
  }
  if (state.tab === 'console') startConsole();
  if (state.tab === 'files') loadFiles();
  if (state.tab === 'sqlite') loadSQLiteDatabases();
  if (state.tab === 'env') loadEnv();
  if (state.tab === 'settings') wireSettings();
}

function stateNoteHTML() {
  const s = state.bot.state || {};
  if (s.oom_killed) return `<div class="state-note error">${icon('alert')} ${t('detail.oom')}</div>`;
  if (typeof s.exit_code === 'number' && s.exit_code > 0 && state.bot.status !== 'running') {
    return `<div class="state-note error">${t('detail.lastExit', { code: `<b>${s.exit_code}</b>`, error: s.error ? ` · ${esc(s.error)}` : '' })}</div>`;
  }
  if (state.bot.status === 'running') return `<div class="state-note">${t('detail.runningNote')}</div>`;
  return `<div class="state-note">${t('detail.offlineNote')}</div>`;
}

function overviewHTML() {
  const b = state.bot;
  return `<div class="overview-grid">
    <div class="card premium-card">
      <div class="card-head"><div><span class="section-kicker">REALTIME</span><h3>${t('overview.liveResources')}</h3></div><span class="card-live"><span class="live-pulse"></span>${t('overview.live5s')}</span></div>
      <div class="card-body">
        <div class="metrics">
          <div class="metric"><div class="metric-top"><span>${t('overview.status')}</span><span class="metric-icon">${icon('activity')}</span></div><b id="mStatus">${statusLabel(b.status)}</b><small>Container state</small></div>
          <div class="metric"><div class="metric-top"><span>CPU</span><span class="metric-icon">${icon('cpu')}</span></div><b id="mCPU">—</b><small>${t('overview.currentUsage')}</small></div>
          <div class="metric"><div class="metric-top"><span>RAM</span><span class="metric-icon">${icon('memory')}</span></div><b id="mRAM">—</b><small>${t('overview.limit', { value: b.memory_mb })}</small></div>
          <div class="metric"><div class="metric-top"><span>${t('overview.network')}</span><span class="metric-icon">${icon('network')}</span></div><b id="mNET">—</b><small>RX / TX</small></div>
        </div>
        <div id="stateNote">${stateNoteHTML()}</div>
      </div>
    </div>
    <div class="card premium-card pipeline-card">
      <div class="card-head"><div><span class="section-kicker">AUTOMATION</span><h3>${t('overview.startupPipeline')}</h3></div><button class="btn small quiet" id="goStartup">${icon('settings')} ${t('actions.edit')}</button></div>
      <div class="card-body">
        <div class="pipeline-list">
          <div class="pipeline-row"><div class="pipeline-step"><span>01</span>${icon('box')}</div><div class="pipeline-info"><b>${t('pipeline.runtimePrepared')}</b><p>${esc(runtimeLabel(b.runtime))}${b.runtime === 'python' ? ` · ${t('overview.isolatedVenv')}` : ` · ${t('overview.isolatedNodeModules')}`}</p></div></div>
          <div class="pipeline-row"><div class="pipeline-step"><span>02</span>${icon('package')}</div><div class="pipeline-info"><b>${t('pipeline.dependenciesInstalled')}</b><code>${esc(b.install_command || t('pipeline.noInstallStep'))}</code></div></div>
          <div class="pipeline-row"><div class="pipeline-step"><span>03</span>${icon('play')}</div><div class="pipeline-info"><b>${t('pipeline.fileStarted', { file: esc(b.main_file) })}</b><code>${esc(b.startup)}</code></div></div>
        </div>
      </div>
    </div>
  </div>`;
}

async function refreshCurrentBot() {
  if (!state.bot) return;
  const d = await api(`/api/bots/${state.bot.id}`);
  state.bot = d.bot;
}

async function loadStats() {
  if (!state.bot) return;
  try {
    await refreshCurrentBot();
    $('#mStatus') && ($('#mStatus').textContent = statusLabel(state.bot.status));
    const note = $('#stateNote');
    if (note) note.innerHTML = stateNoteHTML();
    const d = await api(`/api/bots/${state.bot.id}/stats`);
    if (d.available) {
      $('#mCPU').textContent = d.stats.cpu;
      $('#mRAM').textContent = d.stats.memory;
      $('#mNET').textContent = d.stats.network;
    } else {
      $('#mCPU').textContent = '—'; $('#mRAM').textContent = '—'; $('#mNET').textContent = '—';
    }
  } catch {}
}

async function botAction(action) {
  const labels = {
    start: t('botAction.starting'),
    restart: t('botAction.restarting'),
    stop: t('botAction.stopping'),
    rebuild: t('botAction.rebuilding'),
    reinstall: t('botAction.reinstalling'),
  };
  try {
    toast(labels[action] || t('botAction.applying'));
    await api(`/api/bots/${state.bot.id}/action`, { method: 'POST', body: { action } });
    await Promise.all([refreshCurrentBot(), loadBots()]);
    renderBotDetail();
    toast(action === 'reinstall' ? t('botAction.reinstallDone') : t('botAction.done'));
  } catch (err) { toast(err.message, true); }
}

function consoleHTML() {
  return `<div class="console-card">
    <div class="console-toolbar">
      <div class="console-title"><span class="terminal-lights"><i></i><i></i><i></i></span><span class="dot ${state.bot.status === 'running' ? 'ok' : ''}"></span>${icon('terminal')}<span>${t('console.live')}</span><small>${esc(state.bot.name)}</small></div>
      <div class="console-tools"><button class="btn" id="clearConsole">${icon('trash')}<span>${t('console.clear')}</span></button><button class="btn" id="reinstallConsole">${icon('package')}<span>${t('console.dependencies')}</span></button></div>
    </div>
    <div id="console" class="console"><span class="console-line-system">${t('console.connecting')}</span>\n</div>
    <form id="execForm" class="console-command">
      <span class="console-prompt">$</span>
      <input id="execInput" autocomplete="off" spellcheck="false" placeholder="${esc(t('console.placeholder'))}">
      <button class="btn primary">${icon('send')}<span>${t('actions.run')}</span></button>
    </form>
  </div>`;
}

function stopConsole() {
  if (state.console) { state.console.close(); state.console = null; }
}

function appendConsole(text, type = '') {
  const c = $('#console');
  if (!c) return;
  const span = document.createElement('span');
  if (type === 'system') span.className = 'console-line-system';
  if (type === 'error') span.className = 'console-line-error';
  span.textContent = text;
  c.appendChild(span);
  c.scrollTop = c.scrollHeight;
}

function startConsole() {
  stopConsole();
  const c = $('#console');
  if (c) c.textContent = '';
  const es = new EventSource(`/api/bots/${state.bot.id}/console`);
  state.console = es;
  es.onmessage = e => appendConsole(e.data.replaceAll('\\n', '\n'));
  es.addEventListener('system', e => appendConsole(`\n[eLite CP] ${e.data}\n`, e.data.toLowerCase().includes('killed') || e.data.toLowerCase().includes('exit 1') ? 'error' : 'system'));
  es.onerror = () => appendConsole(`\n[eLite CP] ${t('console.waiting')}\n`, 'system');
  $('#execForm')?.addEventListener('submit', execCommand);
  $('#clearConsole')?.addEventListener('click', () => { if ($('#console')) $('#console').textContent = ''; });
  $('#reinstallConsole')?.addEventListener('click', () => botAction('reinstall'));
}

async function execCommand(e) {
  e.preventDefault();
  const input = $('#execInput');
  const cmd = input.value.trim();
  if (!cmd) return;
  appendConsole(`\n$ ${cmd}\n`, 'system');
  input.value = '';
  try {
    const d = await api(`/api/bots/${state.bot.id}/exec`, { method: 'POST', body: { command: cmd } });
    appendConsole((d.output || d.error || t('console.noOutput')) + '\n', d.ok ? '' : 'error');
  } catch (err) { appendConsole(err.message + '\n', 'error'); }
}

async function loadFiles() {
  try {
    const d = await api(`/api/bots/${state.bot.id}/files?path=${encodeURIComponent(state.filePath)}`);
    renderFiles(d.files || []);
  } catch (err) {
    $('#filesRoot').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function parentPath(p) { const a = p.split('/').filter(Boolean); a.pop(); return a.join('/'); }

function renderFiles(files) {
  const root = $('#filesRoot');
  if (!root) return;
  const dateLocale = state.locale === 'tr' ? 'tr-TR' : 'en-US';
  root.innerHTML = `
    <div id="dropzone" class="dropzone"><div class="dropzone-inner">${icon('upload')} ${t('files.dropzone')}</div></div>
    <div class="file-toolbar">
      <div class="breadcrumb">/${esc(state.filePath)}</div>
      ${state.filePath ? `<button class="btn small ghost" id="upDir">${icon('arrow-up')} ${t('actions.upDirectory')}</button>` : ''}
      <button class="btn small ghost" id="newFile">${icon('file-plus')} ${t('actions.file')}</button>
      <button class="btn small ghost" id="newDir">${icon('folder-plus')} ${t('actions.folder')}</button>
      <label class="btn small primary" style="display:inline-flex;cursor:pointer">${icon('upload')} ${t('actions.upload')}<input id="fileUpload" type="file" multiple hidden></label>
    </div>
    <div class="file-list">${files.length ? files.map(f => `
      <div class="file-row">
        <div class="file-name">${icon(f.is_dir ? 'folder' : 'file')}<button data-open-file="${esc(f.path)}" data-dir="${f.is_dir}">${esc(f.name)}</button></div>
        <div class="file-dim">${f.is_dir ? '—' : formatBytes(f.size)}</div>
        <div class="file-dim">${new Date(f.modified_at).toLocaleString(dateLocale)}</div>
        <div class="file-actions">${f.is_dir ? '' : `<a class="btn small ghost file-download" href="/api/bots/${encodeURIComponent(state.bot.id)}/download?path=${encodeURIComponent(f.path)}" aria-label="${esc(t('actions.download'))}" title="${esc(t('actions.download'))}">${icon('download')}</a>`}<button class="btn small danger" data-delete-file="${esc(f.path)}" aria-label="${esc(t('actions.delete'))}">${icon('trash')}</button></div>
      </div>`).join('') : `<div class="empty">${t('files.empty')}</div>`}</div>`;

  $('#upDir')?.addEventListener('click', () => { state.filePath = parentPath(state.filePath); loadFiles(); });
  $$('[data-open-file]').forEach(b => b.addEventListener('click', () => b.dataset.dir === 'true' ? (state.filePath = b.dataset.openFile, loadFiles()) : openEditor(b.dataset.openFile)));
  $$('[data-delete-file]').forEach(b => b.addEventListener('click', () => deletePath(b.dataset.deleteFile)));
  $('#fileUpload')?.addEventListener('change', e => uploadSelected(e.target.files));
  $('#newFile')?.addEventListener('click', newFile);
  $('#newDir')?.addEventListener('click', newDir);
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => uploadSelected(e.dataTransfer.files));
}

async function uploadSelected(files) {
  if (!files?.length) return;
  const fd = new FormData();
  [...files].forEach(f => fd.append('files', f));
  fd.append('path', state.filePath);
  try {
    toast(t('files.uploading', { count: files.length }));
    await api(`/api/bots/${state.bot.id}/upload`, { method: 'POST', body: fd });
    toast(t('files.uploaded'));
    loadFiles();
  } catch (err) { toast(err.message, true); }
}

async function openEditor(path) {
  try {
    const d = await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(path)}`);
    state.editorPath = path;
    $('#editorTitle').textContent = path.split('/').pop();
    $('#editorPath').textContent = '/' + path;
    $('#fileEditor').value = d.content;
    $('#editorDialog').showModal();
  } catch (err) { toast(err.message, true); }
}

async function saveEditor() {
  try {
    await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(state.editorPath)}`, { method: 'PUT', body: { content: $('#fileEditor').value } });
    $('#editorDialog').close();
    toast(t('files.saved'));
    loadFiles();
  } catch (err) { toast(err.message, true); }
}

async function newFile() {
  const name = prompt(t('files.filePrompt'));
  if (!name) return;
  const p = [state.filePath, name].filter(Boolean).join('/');
  state.editorPath = p;
  $('#editorTitle').textContent = name;
  $('#editorPath').textContent = '/' + p;
  $('#fileEditor').value = '';
  $('#editorDialog').showModal();
}

async function newDir() {
  const name = prompt(t('files.folderPrompt'));
  if (!name) return;
  const p = [state.filePath, name].filter(Boolean).join('/');
  try { await api(`/api/bots/${state.bot.id}/mkdir`, { method: 'POST', body: { path: p } }); loadFiles(); }
  catch (err) { toast(err.message, true); }
}

async function deletePath(path) {
  if (!confirm(t('files.deleteConfirm', { path }))) return;
  try { await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }); toast(t('files.deleted')); loadFiles(); }
  catch (err) { toast(err.message, true); }
}


function sqliteCell(value) {
  if (value === null) return `<span class="sqlite-null">NULL</span>`;
  const text = String(value);
  return `<span class="sqlite-cell-value" title="${esc(text)}">${esc(text)}</span>`;
}

function wireSQLiteUI() {
  $('#refreshSQLite')?.addEventListener('click', () => loadSQLiteDatabases(true));
  $$('[data-sqlite-db]').forEach(b => b.addEventListener('click', () => loadSQLiteTables(b.dataset.sqliteDb)));
  $$('[data-sqlite-table]').forEach(b => b.addEventListener('click', () => loadSQLiteRows(b.dataset.sqliteTable, 0)));
  $('#sqlitePrev')?.addEventListener('click', () => {
    const s = state.sqlite;
    loadSQLiteRows(s.table, Math.max(0, (s.rows?.offset || 0) - (s.rows?.limit || 100)));
  });
  $('#sqliteNext')?.addEventListener('click', () => {
    const s = state.sqlite;
    loadSQLiteRows(s.table, (s.rows?.offset || 0) + (s.rows?.limit || 100));
  });
}

function renderSQLite() {
  const root = $('#sqliteRoot');
  if (!root) return;
  const s = state.sqlite;
  const selectedDB = s.databases.find(d => d.path === s.path);
  const rows = s.rows;
  const rowItems = Array.isArray(rows?.rows) ? rows.rows : [];
  const columns = Array.isArray(rows?.columns) ? rows.columns : [];
  const rowOffset = Number.isFinite(Number(rows?.offset)) ? Number(rows.offset) : 0;
  const rowLimit = Number.isFinite(Number(rows?.limit)) && Number(rows.limit) > 0 ? Number(rows.limit) : 100;
  const from = rows && rowItems.length ? rowOffset + 1 : 0;
  const to = rows ? rowOffset + rowItems.length : 0;

  const databaseList = s.databases.length ? s.databases.map(db => `
    <button class="sqlite-list-item ${s.path === db.path ? 'active' : ''}" data-sqlite-db="${esc(db.path)}">
      <span class="sqlite-list-icon">${icon('database')}</span>
      <span class="sqlite-list-copy"><b>${esc(db.name)}</b><small title="/${esc(db.path)}">/${esc(db.path)}</small></span>
      <span class="sqlite-list-meta">${formatBytes(db.size)}</span>
    </button>`).join('') : `<div class="sqlite-empty-small">${t('sqlite.noDatabases')}</div>`;

  const tableList = s.path ? (s.tables.length ? s.tables.map(table => `
    <button class="sqlite-table-item ${s.table === table.name ? 'active' : ''}" data-sqlite-table="${esc(table.name)}">
      ${icon('table')}<span>${esc(table.name)}</span>${icon('chevron-right')}
    </button>`).join('') : `<div class="sqlite-empty-small">${t('sqlite.noTables')}</div>`) : `<div class="sqlite-empty-small">${t('sqlite.selectDatabase')}</div>`;

  let dataArea = `<div class="sqlite-empty-state">${icon('database')}<h3>${t('sqlite.title')}</h3><p>${s.databases.length ? t('sqlite.selectDatabase') : t('sqlite.noDatabases')}</p></div>`;
  if (s.path && !s.table) {
    dataArea = `<div class="sqlite-empty-state">${icon('table')}<h3>${selectedDB ? esc(selectedDB.name) : t('sqlite.title')}</h3><p>${s.tables.length ? t('sqlite.selectTable') : t('sqlite.noTables')}</p></div>`;
  }
  if (s.path && s.table && rows) {
    const tableHead = columns.map(c => `<th title="${esc(c)}">${esc(c)}</th>`).join('');
    const tableRows = rowItems.length ? rowItems.map(row => {
      const cells = Array.isArray(row) ? row : [];
      return `<tr>${cells.map(sqliteCell).map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }).join('') : `<tr><td colspan="${Math.max(1, columns.length)}"><div class="sqlite-table-empty">${t('sqlite.emptyRows')}</div></td></tr>`;
    dataArea = `
      <div class="sqlite-data-head">
        <div><span class="section-kicker">TABLE</span><h3>${esc(s.table)}</h3><p>/${esc(s.path)}</p></div>
        <a class="btn small ghost" href="/api/bots/${encodeURIComponent(state.bot.id)}/download?path=${encodeURIComponent(s.path)}">${icon('download')} ${t('actions.download')}</a>
      </div>
      <div class="sqlite-table-scroll"><table class="sqlite-table"><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table></div>
      <div class="sqlite-pagination">
        <span>${t('sqlite.rowsRange', { from, to })}</span>
        <div><button class="btn small ghost" id="sqlitePrev" ${rowOffset <= 0 ? 'disabled' : ''}>${icon('chevron-left')} ${t('sqlite.previous')}</button><button class="btn small ghost" id="sqliteNext" ${!rows.has_more ? 'disabled' : ''}>${t('sqlite.next')} ${icon('chevron-right')}</button></div>
      </div>`;
  }

  root.innerHTML = `
    <section class="sqlite-intro card">
      <div class="sqlite-intro-icon">${icon('database')}</div>
      <div class="sqlite-intro-copy"><div><span class="section-kicker">DATA</span><h3>${t('sqlite.title')}</h3></div><p>${t('sqlite.subtitle')}</p><div class="sqlite-note">${icon('shield')}<b>${t('sqlite.readOnly')}</b><span>${t('sqlite.scanNote')}</span></div></div>
      <button class="btn ghost" id="refreshSQLite">${icon('refresh')} ${t('sqlite.refresh')}</button>
    </section>
    ${s.error ? `<div class="state-note error">${icon('alert')} ${esc(s.error)}</div>` : ''}
    <div class="sqlite-workspace ${s.loading ? 'is-loading' : ''}">
      <aside class="sqlite-browser">
        <section class="card sqlite-pane">
          <div class="sqlite-pane-head"><span>${t('sqlite.databases')}</span><b>${s.databases.length}</b></div>
          <div class="sqlite-list">${databaseList}</div>
        </section>
        <section class="card sqlite-pane">
          <div class="sqlite-pane-head"><span>${t('sqlite.tables')}</span><b>${s.tables.length}</b></div>
          <div class="sqlite-list sqlite-table-list">${tableList}</div>
        </section>
      </aside>
      <section class="card sqlite-data">${s.loading && !rows ? `<div class="sqlite-empty-state">${icon('refresh')}<h3>${t('sqlite.loading')}</h3></div>` : dataArea}</section>
    </div>
    <div class="state-note sqlite-live-note">${icon('activity')} ${t('sqlite.liveNote')}</div>`;
  wireSQLiteUI();
}

async function loadSQLiteDatabases(force = false) {
  const s = state.sqlite;
  s.loading = true;
  s.error = '';
  if (force) s.rows = null;
  renderSQLite();
  try {
    const d = await api(`/api/bots/${state.bot.id}/sqlite`);
    s.databases = d.databases || [];
    if (s.path && !s.databases.some(db => db.path === s.path)) {
      s.path = ''; s.tables = []; s.table = ''; s.rows = null;
    }
    s.loading = false;
    if (!s.path && s.databases.length) return loadSQLiteTables(s.databases[0].path);
    if (s.path) return loadSQLiteTables(s.path, s.table, s.rows?.offset || 0);
    renderSQLite();
  } catch (err) {
    s.loading = false;
    s.error = err.message;
    renderSQLite();
  }
}

async function loadSQLiteTables(path, preferredTable = '', preferredOffset = 0) {
  const s = state.sqlite;
  s.path = path;
  s.tables = [];
  s.table = '';
  s.rows = null;
  s.loading = true;
  s.error = '';
  renderSQLite();
  try {
    const d = await api(`/api/bots/${state.bot.id}/sqlite/tables?path=${encodeURIComponent(path)}`);
    s.tables = d.tables || [];
    s.loading = false;
    const table = preferredTable && s.tables.some(x => x.name === preferredTable) ? preferredTable : (s.tables[0]?.name || '');
    if (table) return loadSQLiteRows(table, preferredOffset);
    renderSQLite();
  } catch (err) {
    s.loading = false;
    s.tables = [];
    s.error = err.message;
    renderSQLite();
  }
}

async function loadSQLiteRows(table, offset = 0) {
  const s = state.sqlite;
  if (!s.path || !table) return;
  if (s.table !== table) s.rows = null;
  s.table = table;
  s.loading = true;
  s.error = '';
  renderSQLite();
  try {
    const payload = await api(`/api/bots/${state.bot.id}/sqlite/rows?path=${encodeURIComponent(s.path)}&table=${encodeURIComponent(table)}&limit=100&offset=${Math.max(0, offset)}`);
    s.rows = {
      ...payload,
      columns: Array.isArray(payload?.columns) ? payload.columns : [],
      rows: Array.isArray(payload?.rows) ? payload.rows : [],
      offset: Number.isFinite(Number(payload?.offset)) ? Number(payload.offset) : Math.max(0, offset),
      limit: Number.isFinite(Number(payload?.limit)) && Number(payload.limit) > 0 ? Number(payload.limit) : 100,
      has_more: Boolean(payload?.has_more),
    };
    s.loading = false;
    renderSQLite();
  } catch (err) {
    s.loading = false;
    s.rows = null;
    s.error = err.message;
    renderSQLite();
  }
}

async function loadEnv() {
  try { const d = await api(`/api/bots/${state.bot.id}/env`); renderEnv(d.env || []); }
  catch (err) { toast(err.message, true); }
}

function renderEnv(env) {
  const root = $('#envRoot');
  root.innerHTML = `<div class="card">
    <div class="card-head"><h3>${t('env.title')}</h3><button class="btn small ghost" id="addEnv">${icon('plus')} ${t('env.variable')}</button></div>
    <div class="card-body">
      <div class="state-note" style="margin-top:0;margin-bottom:13px">${t('env.note')}</div>
      <div id="envList" class="env-list">${env.length ? env.map(e => envRow(e.key, e.value)).join('') : envRow('', '')}</div>
      <div class="settings-actions"><button class="btn primary" id="saveEnv">${icon('save')} ${t('env.saveRebuild')}</button></div>
    </div>
  </div>`;
  $('#addEnv').addEventListener('click', () => { $('#envList').insertAdjacentHTML('beforeend', envRow('', '')); wireEnvRemove(); });
  $('#saveEnv').addEventListener('click', saveEnv);
  wireEnvRemove();
}

function envRow(k, v) {
  return `<div class="env-row"><input class="env-key mono" placeholder="TELEGRAM_TOKEN" value="${esc(k)}"><input class="env-value mono" type="password" placeholder="${esc(t('env.value'))}" value="${esc(v)}"><button type="button" class="env-remove" aria-label="${esc(t('actions.delete'))}">${icon('trash')}</button></div>`;
}

function wireEnvRemove() { $$('.env-remove').forEach(b => { b.onclick = () => b.parentElement.remove(); }); }

async function saveEnv() {
  const env = $$('.env-row').map(r => ({ key: $('.env-key', r).value.trim(), value: $('.env-value', r).value })).filter(e => e.key);
  try {
    await api(`/api/bots/${state.bot.id}/env`, { method: 'PUT', body: { env } });
    await refreshCurrentBot();
    toast(t('env.saved'));
    renderBotDetail();
  } catch (err) { toast(err.message, true); }
}

function settingsHTML() {
  const b = state.bot;
  return `<form id="settingsForm" class="settings-stack">
    <section class="card settings-section">
      <div class="settings-section-title">${icon('bot')} ${t('settings.generalResources')}</div>
      <div class="settings-grid">
        <label>${t('settings.botName')}<input name="name" maxlength="64" value="${esc(b.name)}"></label>
        <label>Runtime<input value="${runtimeLabel(b.runtime)}" disabled></label>
        <label>RAM (MB)<input type="number" name="memory_mb" min="64" max="32768" value="${b.memory_mb}"></label>
        <label>CPU<input type="number" step="0.1" min="0.1" max="32" name="cpus" value="${b.cpus}"></label>
      </div>
    </section>

    <section class="card settings-section">
      <div class="settings-section-title">${icon('workflow')} ${t('settings.startupPlan')}</div>
      <div class="settings-grid">
        <label>${t('fields.dependencyFile')}<input name="dependency_file" value="${esc(b.dependency_file || '')}" placeholder="requirements.txt"><span class="field-help">${t('settings.dependencyHelp')}</span></label>
        <label>${t('fields.mainFile')}<input name="main_file" value="${esc(b.main_file || '')}" placeholder="bot.py"><span class="field-help">${t('settings.mainFileHelp')}</span></label>
      </div>
      <label style="margin-top:14px">${t('fields.installCommand')}<textarea class="mono" name="install_command" rows="3" spellcheck="false">${esc(b.install_command || '')}</textarea><span class="field-help">${t('settings.example')} <code>python -m pip install -r {{dependency_file}}</code></span></label>
      <label style="margin-top:14px">${t('fields.startupCommand')}<textarea class="mono" name="startup" rows="3" spellcheck="false">${esc(b.startup)}</textarea><span class="field-help">${t('settings.example')} <code>python {{main_file}}</code>. ${t('settings.startupHelp')}</span></label>
      <div class="settings-actions">
        <button type="button" class="btn soft" id="reinstallDeps">${icon('package')} ${t('settings.reinstallDependencies')}</button>
        <button type="button" class="btn ghost" id="rebuildBot">${icon('refresh')} ${t('settings.rebuildContainer')}</button>
        <button class="btn primary">${icon('save')} ${t('settings.saveRebuild')}</button>
      </div>
    </section>

    <section class="danger-zone">
      <h4>${t('settings.dangerZone')}</h4>
      <p>${t('settings.dangerText')}</p>
      <button type="button" id="deleteBot" class="btn danger">${icon('trash')} ${t('settings.deleteBot')}</button>
    </section>
  </form>`;
}

function wireSettings() {
  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#deleteBot').addEventListener('click', deleteBot);
  $('#reinstallDeps').addEventListener('click', () => botAction('reinstall'));
  $('#rebuildBot').addEventListener('click', () => botAction('rebuild'));
}

async function saveSettings(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const payload = {
    name: f.get('name'),
    dependency_file: f.get('dependency_file'),
    main_file: f.get('main_file'),
    install_command: f.get('install_command'),
    startup: f.get('startup'),
    memory_mb: Number(f.get('memory_mb')),
    cpus: Number(f.get('cpus')),
  };
  try {
    const d = await api(`/api/bots/${state.bot.id}`, { method: 'PUT', body: payload });
    state.bot = d.bot;
    await loadBots();
    toast(t('settings.saved'));
    renderBotDetail();
  } catch (err) { toast(err.message, true); }
}

async function deleteBot() {
  if (!confirm(t('settings.deleteConfirm', { name: state.bot.name }))) return;
  try {
    await api(`/api/bots/${state.bot.id}`, { method: 'DELETE' });
    state.bot = null;
    await loadBots();
    toast(t('settings.deleted'));
    render();
  } catch (err) { toast(err.message, true); }
}

boot();
