const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
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
};

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
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="/icons.svg#${name}"></use></svg>`;
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

function statusLabel(s) {
  return ({
    running: 'Çalışıyor', offline: 'Kapalı', restarting: 'Restart', paused: 'Duraklatıldı',
    created: 'Hazır', dead: 'Hata', removing: 'Siliniyor', unknown: 'Bilinmiyor',
  }[s] || s || 'Bilinmiyor');
}

function runtimeLabel(runtime) { return runtime === 'python' ? 'Python 3.12' : 'Node.js 22'; }
function runtimeShort(runtime) { return runtime === 'python' ? 'PY' : 'JS'; }

async function boot() {
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
  $('#userChip').textContent = state.user?.username || 'admin';
}
function setActiveNav() {
  $$('.nav-item[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === state.view));
}

async function refreshSystem() {
  try {
    const s = await api('/api/system');
    state.system = s;
    $('#dockerDot').className = `dot ${s.docker_ok ? 'ok' : 'bad'}`;
    $('#dockerText').textContent = s.docker_ok ? `Docker hazır · v${s.version}` : 'Docker erişilemiyor';
  } catch {
    $('#dockerDot').className = 'dot bad';
    $('#dockerText').textContent = 'Sistem hatası';
  }
}

async function loadBots() {
  const d = await api('/api/bots');
  state.bots = d.bots || [];
  $('#botCountBadge').textContent = state.bots.length;
}

function render() {
  clearInterval(state.statsTimer);
  if (state.bot) return renderBotDetail();
  if (state.view === 'bots') renderBots();
  else renderDashboard();
}

function header(title, sub) {
  $('#pageTitle').textContent = title;
  $('#pageSubtitle').textContent = sub;
}

function emptyBots() {
  return `<div class="empty"><div class="empty-icon">${icon('bot')}</div>Henüz bot yok. <b>Yeni Bot</b> ile ilk instance'ını oluştur.</div>`;
}

function botCards(bots) {
  if (!bots.length) return emptyBots();
  return `<div class="bot-list">${bots.map(b => `
    <article class="bot-card" data-bot="${b.id}" tabindex="0">
      <div class="bot-card-top">
        <div class="bot-ident">
          <div class="bot-icon ${b.runtime === 'node' ? 'node' : ''}">${runtimeShort(b.runtime)}</div>
          <div style="min-width:0"><p class="bot-name">${esc(b.name)}</p><span class="bot-meta">${runtimeLabel(b.runtime)} · ${b.id}</span></div>
        </div>
        <span class="status ${esc(b.status)}">${statusLabel(b.status)}</span>
      </div>
      <div class="bot-resources">
        <span>${icon('memory')} RAM <b>${b.memory_mb} MB</b></span>
        <span>${icon('cpu')} CPU <b>${b.cpus}</b></span>
      </div>
    </article>`).join('')}</div>`;
}

function wireBotCards() {
  $$('[data-bot]').forEach(el => {
    el.addEventListener('click', () => openBot(el.dataset.bot));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openBot(el.dataset.bot); });
  });
}

function renderDashboard() {
  header('Dashboard', 'Bot altyapının kısa özeti.');
  const running = state.bots.filter(b => b.status === 'running').length;
  const problem = state.bots.filter(b => b.state?.oom_killed || (b.state?.exit_code > 0 && b.status !== 'running')).length;
  $('#content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-icon">${icon('bot')}</div><div class="stat-label">Toplam Bot</div><div class="stat-value">${state.bots.length}</div><div class="stat-sub">Python + Node.js instances</div></div>
      <div class="stat-card"><div class="stat-card-icon">${icon('play')}</div><div class="stat-label">Çalışan</div><div class="stat-value">${running}</div><div class="stat-sub">Aktif Docker container</div></div>
      <div class="stat-card"><div class="stat-card-icon">${icon('stop')}</div><div class="stat-label">Kapalı</div><div class="stat-value">${Math.max(0, state.bots.length - running)}</div><div class="stat-sub">Başlatılabilir instance</div></div>
      <div class="stat-card"><div class="stat-card-icon">${icon(problem ? 'alert' : 'shield')}</div><div class="stat-label">Son Hata</div><div class="stat-value">${problem}</div><div class="stat-sub">Exit / OOM görülen bot</div></div>
    </div>
    <section class="card">
      <div class="card-head"><h3>Botlar</h3><button class="btn small ghost" id="dashRefresh">${icon('refresh')} Yenile</button></div>
      <div class="card-body">${botCards(state.bots)}</div>
    </section>`;
  wireBotCards();
  $('#dashRefresh')?.addEventListener('click', async () => { await loadBots(); renderDashboard(); });
}

function renderBots() {
  header('Botlar', 'Discord ve Telegram bot container’larını yönet.');
  $('#content').innerHTML = botCards(state.bots);
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
    toast('Bot oluşturuldu. Dosyaları yükledikten sonra Başlat diyebilirsin.');
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
    state.view = 'bots';
    setActiveNav();
    render();
  } catch (err) { toast(err.message, true); }
}

function tabDef() {
  return [
    ['overview', 'dashboard', 'Genel'],
    ['console', 'terminal', 'Console'],
    ['files', 'folder', 'Dosyalar'],
    ['env', 'key', 'Variables'],
    ['settings', 'settings', 'Startup & Ayarlar'],
  ];
}

function botDetailShell(inner) {
  const b = state.bot;
  header(b.name, `${runtimeLabel(b.runtime)} · ${b.id}`);
  return `
    <div class="detail-head">
      <div class="detail-title">
        <div class="bot-icon ${b.runtime === 'node' ? 'node' : ''}">${runtimeShort(b.runtime)}</div>
        <div class="detail-title-copy">
          <h2>${esc(b.name)}</h2>
          <div class="detail-title-meta"><span class="status ${esc(b.status)}">${statusLabel(b.status)}</span><span class="muted mono" style="font-size:10px">${b.id}</span></div>
        </div>
      </div>
      <div class="action-row">
        <button class="btn small success" data-action="start">${icon('play')} Başlat</button>
        <button class="btn small" data-action="restart">${icon('restart')} Restart</button>
        <button class="btn small" data-action="stop">${icon('stop')} Durdur</button>
      </div>
    </div>
    <div class="tabs">${tabDef().map(([k, i, v]) => `<button class="tab ${state.tab === k ? 'active' : ''}" data-tab="${k}">${icon(i)}${v}</button>`).join('')}</div>
    ${inner}`;
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
  let inner = '';
  if (state.tab === 'overview') inner = overviewHTML();
  else if (state.tab === 'console') inner = consoleHTML();
  else if (state.tab === 'files') inner = '<div id="filesRoot"><div class="empty">Dosyalar yükleniyor...</div></div>';
  else if (state.tab === 'env') inner = '<div id="envRoot"><div class="empty">Variables yükleniyor...</div></div>';
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
  if (state.tab === 'env') loadEnv();
  if (state.tab === 'settings') wireSettings();
}

function stateNoteHTML() {
  const s = state.bot.state || {};
  if (s.oom_killed) return `<div class="state-note error">${icon('alert')} Container RAM limiti nedeniyle sonlandırılmış (OOM). RAM limitini yükselt veya botun bellek kullanımını azalt.</div>`;
  if (typeof s.exit_code === 'number' && s.exit_code > 0 && state.bot.status !== 'running') {
    return `<div class="state-note error">Son çıkış kodu: <b>${s.exit_code}</b>${s.error ? ` · ${esc(s.error)}` : ''}. Console sekmesindeki logları kontrol et.</div>`;
  }
  if (state.bot.status === 'running') return `<div class="state-note">Container aktif. Dependency dosyası değişirse sonraki restart/start sırasında otomatik olarak tekrar kurulur.</div>`;
  return `<div class="state-note">Bot kapalı. Dosyalarını yükledikten sonra <b>Başlat</b> dediğinde startup pipeline otomatik çalışır.</div>`;
}

function overviewHTML() {
  const b = state.bot;
  return `<div class="overview-grid">
    <div class="card">
      <div class="card-head"><h3>Canlı Kaynaklar</h3><span class="muted" style="font-size:10px">5 sn güncellenir</span></div>
      <div class="card-body">
        <div class="metrics">
          <div class="metric"><div class="metric-top"><span>Durum</span>${icon('activity')}</div><b id="mStatus">${statusLabel(b.status)}</b></div>
          <div class="metric"><div class="metric-top"><span>CPU</span>${icon('cpu')}</div><b id="mCPU">—</b></div>
          <div class="metric"><div class="metric-top"><span>RAM</span>${icon('memory')}</div><b id="mRAM">—</b></div>
          <div class="metric"><div class="metric-top"><span>Network</span>${icon('network')}</div><b id="mNET">—</b></div>
        </div>
        <div id="stateNote">${stateNoteHTML()}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Startup Pipeline</h3><button class="btn small soft" id="goStartup">${icon('settings')} Düzenle</button></div>
      <div class="card-body">
        <div class="pipeline-list">
          <div class="pipeline-row"><div class="pipeline-step">1</div><div class="pipeline-info"><b>Runtime ortamı</b><code>${esc(runtimeLabel(b.runtime))}${b.runtime === 'python' ? ' · per-bot venv' : ' · per-bot node_modules'}</code></div></div>
          <div class="pipeline-row"><div class="pipeline-step">2</div><div class="pipeline-info"><b>Dependency kurulumu · ${esc(b.dependency_file || 'kapalı')}</b><code>${esc(b.install_command || 'Kurulum adımı yok')}</code></div></div>
          <div class="pipeline-row"><div class="pipeline-step">3</div><div class="pipeline-info"><b>Startup · ${esc(b.main_file)}</b><code>${esc(b.startup)}</code></div></div>
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
  const labels = { start: 'Bot başlatılıyor...', restart: 'Bot yeniden başlatılıyor...', stop: 'Bot durduruluyor...', rebuild: 'Container yeniden oluşturuluyor...', reinstall: 'Dependencies yeniden kurulacak...' };
  try {
    toast(labels[action] || 'İşlem uygulanıyor...');
    await api(`/api/bots/${state.bot.id}/action`, { method: 'POST', body: { action } });
    await Promise.all([refreshCurrentBot(), loadBots()]);
    renderBotDetail();
    toast(action === 'reinstall' ? 'Dependency kurulumu tetiklendi. Console’dan takip edebilirsin.' : 'İşlem tamamlandı.');
  } catch (err) { toast(err.message, true); }
}

function consoleHTML() {
  return `<div class="console-card">
    <div class="console-toolbar">
      <div class="console-title"><span class="dot ${state.bot.status === 'running' ? 'ok' : ''}"></span>${icon('terminal')} Live Console</div>
      <div class="console-tools"><button class="btn" id="clearConsole">${icon('trash')} Temizle</button><button class="btn" id="reinstallConsole">${icon('package')} Dependencies</button></div>
    </div>
    <div id="console" class="console"><span class="console-line-system">eLite CP console bağlanıyor...</span>\n</div>
    <form id="execForm" class="console-command">
      <span class="console-prompt">$</span>
      <input id="execInput" autocomplete="off" spellcheck="false" placeholder="Komut çalıştır: pip list, python --version, ls -la ...">
      <button class="btn primary">${icon('send')}<span>Çalıştır</span></button>
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
  es.onerror = () => appendConsole('\n[eLite CP] Console bağlantısı beklemede; container başlatıldığında tekrar bağlanır.\n', 'system');
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
    appendConsole((d.output || d.error || '(çıktı yok)') + '\n', d.ok ? '' : 'error');
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
  root.innerHTML = `
    <div id="dropzone" class="dropzone"><div class="dropzone-inner">${icon('upload')} ZIP veya dosyaları buraya bırak · ZIP güvenli şekilde otomatik açılır</div></div>
    <div class="file-toolbar">
      <div class="breadcrumb">/${esc(state.filePath)}</div>
      ${state.filePath ? `<button class="btn small ghost" id="upDir">${icon('arrow-up')} Üst Dizin</button>` : ''}
      <button class="btn small ghost" id="newFile">${icon('file-plus')} Dosya</button>
      <button class="btn small ghost" id="newDir">${icon('folder-plus')} Klasör</button>
      <label class="btn small primary" style="display:inline-flex;cursor:pointer">${icon('upload')} Yükle<input id="fileUpload" type="file" multiple hidden></label>
    </div>
    <div class="file-list">${files.length ? files.map(f => `
      <div class="file-row">
        <div class="file-name">${icon(f.is_dir ? 'folder' : 'file')}<button data-open-file="${esc(f.path)}" data-dir="${f.is_dir}">${esc(f.name)}</button></div>
        <div class="file-dim">${f.is_dir ? '—' : formatBytes(f.size)}</div>
        <div class="file-dim">${new Date(f.modified_at).toLocaleString('tr-TR')}</div>
        <div class="file-actions"><button class="btn small danger" data-delete-file="${esc(f.path)}" aria-label="Sil">${icon('trash')}</button></div>
      </div>`).join('') : '<div class="empty">Bu klasör boş.</div>'}</div>`;

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
    toast(`${files.length} dosya yükleniyor...`);
    await api(`/api/bots/${state.bot.id}/upload`, { method: 'POST', body: fd });
    toast('Dosyalar yüklendi. Dependency dosyası değiştiyse sonraki start/restart otomatik kuracak.');
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
    toast('Dosya kaydedildi.');
    loadFiles();
  } catch (err) { toast(err.message, true); }
}

async function newFile() {
  const name = prompt('Dosya adı (örn. bot.py):');
  if (!name) return;
  const p = [state.filePath, name].filter(Boolean).join('/');
  state.editorPath = p;
  $('#editorTitle').textContent = name;
  $('#editorPath').textContent = '/' + p;
  $('#fileEditor').value = '';
  $('#editorDialog').showModal();
}

async function newDir() {
  const name = prompt('Klasör adı:');
  if (!name) return;
  const p = [state.filePath, name].filter(Boolean).join('/');
  try { await api(`/api/bots/${state.bot.id}/mkdir`, { method: 'POST', body: { path: p } }); loadFiles(); }
  catch (err) { toast(err.message, true); }
}

async function deletePath(path) {
  if (!confirm(`Silinsin mi?\n${path}`)) return;
  try { await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }); toast('Silindi.'); loadFiles(); }
  catch (err) { toast(err.message, true); }
}

async function loadEnv() {
  try { const d = await api(`/api/bots/${state.bot.id}/env`); renderEnv(d.env || []); }
  catch (err) { toast(err.message, true); }
}

function renderEnv(env) {
  const root = $('#envRoot');
  root.innerHTML = `<div class="card">
    <div class="card-head"><h3>Environment Variables</h3><button class="btn small ghost" id="addEnv">${icon('plus')} Variable</button></div>
    <div class="card-body">
      <div class="state-note" style="margin-top:0;margin-bottom:13px">Discord / Telegram token gibi secret değerleri burada tutabilirsin. Kaydedildiğinde container environment'ına aktarılır.</div>
      <div id="envList" class="env-list">${env.length ? env.map(e => envRow(e.key, e.value)).join('') : envRow('', '')}</div>
      <div class="settings-actions"><button class="btn primary" id="saveEnv">${icon('save')} Kaydet & Rebuild</button></div>
    </div>
  </div>`;
  $('#addEnv').addEventListener('click', () => { $('#envList').insertAdjacentHTML('beforeend', envRow('', '')); wireEnvRemove(); });
  $('#saveEnv').addEventListener('click', saveEnv);
  wireEnvRemove();
}

function envRow(k, v) {
  return `<div class="env-row"><input class="env-key mono" placeholder="TELEGRAM_TOKEN" value="${esc(k)}"><input class="env-value mono" type="password" placeholder="değer" value="${esc(v)}"><button type="button" class="env-remove" aria-label="Sil">${icon('trash')}</button></div>`;
}
function wireEnvRemove() { $$('.env-remove').forEach(b => { b.onclick = () => b.parentElement.remove(); }); }

async function saveEnv() {
  const env = $$('.env-row').map(r => ({ key: $('.env-key', r).value.trim(), value: $('.env-value', r).value })).filter(e => e.key);
  try {
    await api(`/api/bots/${state.bot.id}/env`, { method: 'PUT', body: { env } });
    await refreshCurrentBot();
    toast('Variables kaydedildi ve container güncellendi.');
    renderBotDetail();
  } catch (err) { toast(err.message, true); }
}

function settingsHTML() {
  const b = state.bot;
  return `<form id="settingsForm" class="settings-stack">
    <section class="card settings-section">
      <div class="settings-section-title">${icon('bot')} Genel & Kaynaklar</div>
      <div class="settings-grid">
        <label>Bot adı<input name="name" maxlength="64" value="${esc(b.name)}"></label>
        <label>Runtime<input value="${runtimeLabel(b.runtime)}" disabled></label>
        <label>RAM (MB)<input type="number" name="memory_mb" min="64" max="32768" value="${b.memory_mb}"></label>
        <label>CPU<input type="number" step="0.1" min="0.1" max="32" name="cpus" value="${b.cpus}"></label>
      </div>
    </section>

    <section class="card settings-section">
      <div class="settings-section-title">${icon('workflow')} Startup Planı</div>
      <div class="settings-grid">
        <label>Dependency dosyası<input name="dependency_file" value="${esc(b.dependency_file || '')}" placeholder="requirements.txt"><span class="field-help">Dosya değiştiğinde dependency kurulumu otomatik yeniden çalışır.</span></label>
        <label>Ana dosya<input name="main_file" value="${esc(b.main_file || '')}" placeholder="bot.py"><span class="field-help">Botu gerçekten çalıştıran giriş dosyası.</span></label>
      </div>
      <label style="margin-top:14px">Kurulum komutu<textarea class="mono" name="install_command" rows="3" spellcheck="false">${esc(b.install_command || '')}</textarea><span class="field-help">Örn: <code>python -m pip install -r {{dependency_file}}</code></span></label>
      <label style="margin-top:14px">Startup komutu<textarea class="mono" name="startup" rows="3" spellcheck="false">${esc(b.startup)}</textarea><span class="field-help">Örn: <code>python {{main_file}}</code>. Önce dependency adımı, sonra bu komut çalışır.</span></label>
      <div class="settings-actions">
        <button type="button" class="btn soft" id="reinstallDeps">${icon('package')} Dependencies'i Yeniden Kur</button>
        <button type="button" class="btn ghost" id="rebuildBot">${icon('refresh')} Container Rebuild</button>
        <button class="btn primary">${icon('save')} Kaydet & Rebuild</button>
      </div>
    </section>

    <section class="danger-zone">
      <h4>Tehlikeli Alan</h4>
      <p>Botu, Docker container'ını ve botun tüm dosyalarını kalıcı olarak siler.</p>
      <button type="button" id="deleteBot" class="btn danger">${icon('trash')} Botu Sil</button>
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
    toast('Startup planı ve ayarlar kaydedildi.');
    renderBotDetail();
  } catch (err) { toast(err.message, true); }
}

async function deleteBot() {
  if (!confirm(`${state.bot.name} ve tüm dosyaları kalıcı olarak silinsin mi?`)) return;
  try {
    await api(`/api/bots/${state.bot.id}`, { method: 'DELETE' });
    state.bot = null;
    await loadBots();
    toast('Bot silindi.');
    render();
  } catch (err) { toast(err.message, true); }
}

boot();
