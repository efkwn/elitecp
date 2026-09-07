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
  systemTimer: null,
  systemHistory: { cpu: [], memory: [], disk: [] },
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

function formatPercent(v) {
  const n = Number(v || 0);
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
}

function formatUptime(seconds) {
  let s = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(s / 86400); s %= 86400;
  const hours = Math.floor(s / 3600); s %= 3600;
  const mins = Math.floor(s / 60);
  if (days) return `${days}g ${hours}sa ${mins}dk`;
  if (hours) return `${hours}sa ${mins}dk`;
  return `${mins}dk`;
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
  $$('.mobile-dock-item[data-view]').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    state.bot = null;
    stopConsole();
    setActiveNav();
    render();
  }));
  $('#mobileNewBot')?.addEventListener('click', openNewBot);
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
    $('#dockerText').textContent = s.docker_ok ? `Docker hazır · v${s.version}` : 'Docker erişilemiyor';
    return s;
  } catch {
    $('#dockerDot').className = 'dot bad';
    $('#dockerText').textContent = 'Sistem hatası';
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
  return `<div class="empty"><div class="empty-icon">${icon('bot')}</div>Henüz bot yok. <b>Yeni Bot</b> ile ilk instance'ını oluştur.</div>`;
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
        <span class="bot-open">Yönet ${icon('chevron-right')}</span>
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
    return `<section class="resource-section"><div class="section-head"><div><span class="section-kicker">VPS HEALTH</span><h2>Sunucu kaynakları</h2></div><span class="server-live">Veriler bekleniyor...</span></div><div class="empty resource-empty">Sunucu metrikleri henüz alınamadı.</div></section>`;
  }
  const cpu = clamp(m.cpu_percent);
  const memory = clamp(m.memory_percent);
  const disk = clamp(m.disk_percent);
  return `<section class="resource-section">
    <div class="section-head">
      <div><span class="section-kicker">VPS HEALTH</span><h2>Sunucu kaynakları</h2><p>${esc(m.hostname || 'VPS')} · ${esc(m.os || 'Linux')}</p></div>
      <span class="server-live"><span class="live-pulse"></span> Canlı · 4 sn</span>
    </div>
    <div class="server-metrics-grid">
      <article class="server-metric" data-system-card="cpu">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('cpu')}</span><span>CPU</span></div><b id="sysCpuValue">${formatPercent(cpu)}</b></div>
        <div class="server-progress"><span id="sysCpuBar" style="width:${cpu}%"></span></div>
        <div id="sysCpuGraph" class="server-graph">${sparkline(state.systemHistory.cpu)}</div>
        <div class="server-metric-foot"><span id="sysCpuSub">${m.cpu_cores || 1} çekirdek</span><span id="sysLoadSub">Load ${Number(m.load_1 || 0).toFixed(2)}</span></div>
      </article>
      <article class="server-metric" data-system-card="memory">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('memory')}</span><span>RAM</span></div><b id="sysRamValue">${formatPercent(memory)}</b></div>
        <div class="server-progress"><span id="sysRamBar" style="width:${memory}%"></span></div>
        <div id="sysRamGraph" class="server-graph">${sparkline(state.systemHistory.memory)}</div>
        <div class="server-metric-foot"><span id="sysRamUsed">${formatBytes(m.memory_used_bytes)} kullanılan</span><span id="sysRamTotal">/ ${formatBytes(m.memory_total_bytes)}</span></div>
      </article>
      <article class="server-metric" data-system-card="disk">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('disk')}</span><span>Disk</span></div><b id="sysDiskValue">${formatPercent(disk)}</b></div>
        <div class="server-progress"><span id="sysDiskBar" style="width:${disk}%"></span></div>
        <div id="sysDiskGraph" class="server-graph">${sparkline(state.systemHistory.disk)}</div>
        <div class="server-metric-foot"><span id="sysDiskUsed">${formatBytes(m.disk_used_bytes)} kullanılan</span><span id="sysDiskTotal">/ ${formatBytes(m.disk_total_bytes)}</span></div>
      </article>
      <article class="server-metric uptime-metric" data-system-card="uptime">
        <div class="server-metric-top"><div class="server-metric-title"><span class="server-metric-icon">${icon('clock')}</span><span>Uptime</span></div><span class="status running"><i class="status-dot"></i>Online</span></div>
        <div id="sysUptime" class="uptime-value">${formatUptime(m.uptime_seconds)}</div>
        <div class="uptime-track"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="server-metric-foot"><span id="sysHost">${esc(m.hostname || 'VPS')}</span><span>${state.system?.docker_ok ? 'Docker hazır' : 'Docker hata'}</span></div>
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
  $('#sysCpuSub').textContent = `${m.cpu_cores || 1} çekirdek`;
  $('#sysLoadSub').textContent = `Load ${Number(m.load_1 || 0).toFixed(2)}`;
  $('#sysRamValue').textContent = formatPercent(memory);
  $('#sysRamBar').style.width = `${memory}%`;
  $('#sysRamGraph').innerHTML = sparkline(state.systemHistory.memory);
  $('#sysRamUsed').textContent = `${formatBytes(m.memory_used_bytes)} kullanılan`;
  $('#sysRamTotal').textContent = `/ ${formatBytes(m.memory_total_bytes)}`;
  $('#sysDiskValue').textContent = formatPercent(disk);
  $('#sysDiskBar').style.width = `${disk}%`;
  $('#sysDiskGraph').innerHTML = sparkline(state.systemHistory.disk);
  $('#sysDiskUsed').textContent = `${formatBytes(m.disk_used_bytes)} kullanılan`;
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
  header('Dashboard', 'Bot altyapının ve VPS kaynaklarının kısa özeti.');
  const running = state.bots.filter(b => b.status === 'running').length;
  const stopped = Math.max(0, state.bots.length - running);
  const problem = state.bots.filter(b => b.state?.oom_killed || (b.state?.exit_code > 0 && b.status !== 'running')).length;
  const healthText = problem ? `${problem} instance kontrol bekliyor` : (state.system?.docker_ok ? 'Altyapı sağlıklı' : 'Docker kontrol gerekli');
  $('#content').innerHTML = `
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <span class="section-kicker">ELITE CONTROL PLANE</span>
        <h2>${problem ? 'Kontrol edilmesi gereken bir şey var.' : 'Her şey kontrol altında.'}</h2>
        <p>${state.bots.length ? `${running} bot aktif, ${stopped} bot beklemede.` : 'İlk botunu oluşturup saniyeler içinde çalıştırabilirsin.'} ${esc(healthText)}.</p>
      </div>
      <div class="hero-status"><span class="hero-status-icon ${problem ? 'warn' : ''}">${icon(problem ? 'alert' : 'shield')}</span><div><b>${problem ? 'Dikkat' : 'System healthy'}</b><span>${state.system?.docker_ok ? 'Docker runtime online' : 'Docker runtime kontrol ediliyor'}</span></div></div>
    </section>
    ${serverMetricCardsHTML()}
    <section class="summary-strip" aria-label="Bot özeti">
      <div class="summary-item"><span class="summary-icon">${icon('bot')}</span><div><small>Toplam</small><strong>${state.bots.length}</strong></div></div>
      <div class="summary-item"><span class="summary-icon green">${icon('play')}</span><div><small>Çalışan</small><strong>${running}</strong></div></div>
      <div class="summary-item"><span class="summary-icon neutral">${icon('stop')}</span><div><small>Kapalı</small><strong>${stopped}</strong></div></div>
      <div class="summary-item"><span class="summary-icon ${problem ? 'red' : 'green'}">${icon(problem ? 'alert' : 'check')}</span><div><small>Uyarı</small><strong>${problem}</strong></div></div>
    </section>
    <section class="content-section">
      <div class="section-head compact"><div><span class="section-kicker">INSTANCES</span><h2>Botlar</h2><p>Python ve Node.js container'larını tek yerden yönet.</p></div><button class="btn quiet" id="dashRefresh">${icon('refresh')} Yenile</button></div>
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
  header('Botlar', 'Discord ve Telegram bot container’larını yönet.');
  const running = state.bots.filter(b => b.status === 'running').length;
  $('#content').innerHTML = `<section class="page-intro"><div><span class="section-kicker">INSTANCES</span><h2>Bot altyapın</h2><p>${state.bots.length} instance · ${running} aktif · Docker ile birbirinden izole.</p></div><button class="btn primary" id="botsNew">${icon('plus')} Yeni Bot</button></section>${botCards(state.bots)}`;
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
        <button class="btn success" data-action="start">${icon('play')} Başlat</button>
        <button class="btn" data-action="restart">${icon('restart')} Restart</button>
        <button class="btn" data-action="stop">${icon('stop')} Durdur</button>
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
    <div class="card premium-card">
      <div class="card-head"><div><span class="section-kicker">REALTIME</span><h3>Canlı kaynaklar</h3></div><span class="card-live"><span class="live-pulse"></span>5 sn</span></div>
      <div class="card-body">
        <div class="metrics">
          <div class="metric"><div class="metric-top"><span>Durum</span><span class="metric-icon">${icon('activity')}</span></div><b id="mStatus">${statusLabel(b.status)}</b><small>Container state</small></div>
          <div class="metric"><div class="metric-top"><span>CPU</span><span class="metric-icon">${icon('cpu')}</span></div><b id="mCPU">—</b><small>Anlık kullanım</small></div>
          <div class="metric"><div class="metric-top"><span>RAM</span><span class="metric-icon">${icon('memory')}</span></div><b id="mRAM">—</b><small>Limit ${b.memory_mb} MB</small></div>
          <div class="metric"><div class="metric-top"><span>Network</span><span class="metric-icon">${icon('network')}</span></div><b id="mNET">—</b><small>RX / TX</small></div>
        </div>
        <div id="stateNote">${stateNoteHTML()}</div>
      </div>
    </div>
    <div class="card premium-card pipeline-card">
      <div class="card-head"><div><span class="section-kicker">AUTOMATION</span><h3>Startup pipeline</h3></div><button class="btn small quiet" id="goStartup">${icon('settings')} Düzenle</button></div>
      <div class="card-body">
        <div class="pipeline-list">
          <div class="pipeline-row"><div class="pipeline-step"><span>01</span>${icon('box')}</div><div class="pipeline-info"><b>Runtime hazırlanır</b><p>${esc(runtimeLabel(b.runtime))}${b.runtime === 'python' ? ' · izole per-bot venv' : ' · izole node_modules'}</p></div></div>
          <div class="pipeline-row"><div class="pipeline-step"><span>02</span>${icon('package')}</div><div class="pipeline-info"><b>Dependencies kurulur</b><code>${esc(b.install_command || 'Kurulum adımı yok')}</code></div></div>
          <div class="pipeline-row"><div class="pipeline-step"><span>03</span>${icon('play')}</div><div class="pipeline-info"><b>${esc(b.main_file)} başlatılır</b><code>${esc(b.startup)}</code></div></div>
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
      <div class="console-title"><span class="terminal-lights"><i></i><i></i><i></i></span><span class="dot ${state.bot.status === 'running' ? 'ok' : ''}"></span>${icon('terminal')}<span>Live Console</span><small>${esc(state.bot.name)}</small></div>
      <div class="console-tools"><button class="btn" id="clearConsole">${icon('trash')}<span>Temizle</span></button><button class="btn" id="reinstallConsole">${icon('package')}<span>Dependencies</span></button></div>
    </div>
    <div id="console" class="console"><span class="console-line-system">eLite CP console bağlanıyor...</span>\n</div>
    <form id="execForm" class="console-command">
      <span class="console-prompt">$</span>
      <input id="execInput" autocomplete="off" spellcheck="false" placeholder="Komut çalıştır · pip list, python --version, ls -la ...">
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
