const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, bots:[], view:'dashboard', bot:null, tab:'overview', filePath:'', editorPath:'', console:null, statsTimer:null };
const runtimeDefaults = {
  python: "mkdir -p .home .elitecp-venv && python -m venv .elitecp-venv && . .elitecp-venv/bin/activate && if [ -f requirements.txt ]; then pip install --disable-pip-version-check --no-cache-dir -r requirements.txt; fi && exec python main.py",
  node: "mkdir -p .home && if [ -f package-lock.json ]; then npm ci --omit=dev; elif [ -f package.json ]; then npm install --omit=dev; fi && exec npm start"
};

async function api(path, opts={}) {
  const options = {...opts, headers:{...(opts.headers||{})}};
  if (options.body && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    if (typeof options.body !== 'string') options.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, options);
  const data = await res.json().catch(()=>({}));
  if (!res.ok) {
    if (res.status===401 && path!=='/api/login') showLogin();
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
function toast(msg, error=false){const el=$('#toast');el.textContent=msg;el.className='toast show'+(error?' error':'');clearTimeout(el._t);el._t=setTimeout(()=>el.className='toast',2800)}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatBytes(n){if(!n)return '0 B';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`}
function statusLabel(s){return ({running:'Çalışıyor',offline:'Kapalı',restarting:'Yeniden başlıyor',paused:'Duraklatıldı'}[s]||s||'Bilinmiyor')}

async function boot(){
  wireStatic();
  try{const me=await api('/api/me');state.user=me.user;showApp();await refreshSystem();await loadBots();render();}
  catch{showLogin();}
}
function wireStatic(){
  $('#loginForm').addEventListener('submit',login);
  $('#logoutBtn').addEventListener('click',logout);
  $('#newBotBtn').addEventListener('click',openNewBot);
  $('#runtimeSelect').addEventListener('change',e=>$('#startupInput').value=runtimeDefaults[e.target.value]);
  $('#botForm').addEventListener('submit',createBot);
  $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>$('#botDialog').close()));
  $('#closeEditor').addEventListener('click',()=>$('#editorDialog').close());
  $('#cancelEditor').addEventListener('click',()=>$('#editorDialog').close());
  $('#saveEditor').addEventListener('click',saveEditor);
  $$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;state.bot=null;stopConsole();setActiveNav();render();$('.sidebar').classList.remove('open')}));
  $('#mobileMenu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
}
async function login(e){e.preventDefault();try{const data=await api('/api/login',{method:'POST',body:{username:$('#loginUser').value,password:$('#loginPass').value}});state.user=data.user;showApp();await refreshSystem();await loadBots();render();}catch(err){toast(err.message,true)}}
async function logout(){try{await api('/api/logout',{method:'POST'})}catch{}state.user=null;showLogin()}
function showLogin(){stopConsole();$('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');setTimeout(()=>$('#loginUser').focus(),50)}
function showApp(){$('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#userChip').textContent=state.user?.username||'admin'}
function setActiveNav(){$$('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===state.view))}
async function refreshSystem(){try{const s=await api('/api/system');$('#dockerDot').className='dot '+(s.docker_ok?'ok':'bad');$('#dockerText').textContent=s.docker_ok?'Docker hazır':'Docker erişilemiyor'}catch{$('#dockerDot').className='dot bad';$('#dockerText').textContent='Sistem hatası'}}
async function loadBots(){const d=await api('/api/bots');state.bots=d.bots||[]}
function render(){clearInterval(state.statsTimer);if(state.bot)return renderBotDetail();if(state.view==='bots')renderBots();else renderDashboard()}
function header(title,sub){$('#pageTitle').textContent=title;$('#pageSubtitle').textContent=sub}
function botCards(bots){if(!bots.length)return `<div class="empty">Henüz bot yok. Sağ üstten ilk botunu oluşturabilirsin.</div>`;return `<div class="bot-list">${bots.map(b=>`<article class="bot-card" data-bot="${b.id}"><div class="bot-card-top"><div style="display:flex;gap:12px"><div class="bot-icon">${b.runtime==='python'?'Py':'JS'}</div><div><p class="bot-name">${esc(b.name)}</p><span class="bot-meta">${b.runtime==='python'?'Python 3.12':'Node.js 22'} · ${b.id}</span></div></div><span class="status ${esc(b.status)}">${statusLabel(b.status)}</span></div><div class="bot-resources"><span>RAM <b>${b.memory_mb} MB</b></span><span>CPU <b>${b.cpus}</b></span></div></article>`).join('')}</div>`}
function wireBotCards(){$$('[data-bot]').forEach(el=>el.addEventListener('click',()=>openBot(el.dataset.bot)))}
function renderDashboard(){header('Dashboard','Bot altyapının kısa özeti.');const running=state.bots.filter(b=>b.status==='running').length;$('#content').innerHTML=`<div class="stats-grid"><div class="stat-card"><div class="stat-label">Toplam Bot</div><div class="stat-value">${state.bots.length}</div><div class="stat-sub">Python + Node.js</div></div><div class="stat-card"><div class="stat-label">Çalışan</div><div class="stat-value">${running}</div><div class="stat-sub">Aktif container</div></div><div class="stat-card"><div class="stat-label">Kapalı</div><div class="stat-value">${state.bots.length-running}</div><div class="stat-sub">Başlatılabilir</div></div><div class="stat-card"><div class="stat-label">Panel</div><div class="stat-value">eLite</div><div class="stat-sub">Hafif kontrol paneli</div></div></div><section class="card"><div class="card-head"><h3>Botlar</h3><button class="btn small ghost" id="dashRefresh">Yenile</button></div><div class="card-body">${botCards(state.bots)}</div></section>`;wireBotCards();$('#dashRefresh')?.addEventListener('click',async()=>{await loadBots();renderDashboard()})}
function renderBots(){header('Botlar','Discord ve Telegram bot container’larını yönet.');$('#content').innerHTML=botCards(state.bots);wireBotCards()}
function openNewBot(){$('#runtimeSelect').value='python';$('#startupInput').value=runtimeDefaults.python;$('#botForm').reset();$('#runtimeSelect').value='python';$('#startupInput').value=runtimeDefaults.python;$('#botDialog').showModal()}
async function createBot(e){e.preventDefault();const fd=new FormData(e.target);try{const d=await api('/api/bots',{method:'POST',body:{name:fd.get('name'),runtime:fd.get('runtime'),startup:fd.get('startup'),memory_mb:Number(fd.get('memory_mb')),cpus:Number(fd.get('cpus'))}});$('#botDialog').close();toast('Bot oluşturuldu');await loadBots();openBot(d.bot.id)}catch(err){toast(err.message,true)}}
async function openBot(id){try{const d=await api(`/api/bots/${id}`);state.bot=d.bot;state.tab='overview';state.filePath='';state.view='bots';setActiveNav();render()}catch(err){toast(err.message,true)}}
function botDetailShell(inner){const b=state.bot;header(b.name,`${b.runtime==='python'?'Python 3.12':'Node.js 22'} · ${b.id}`);return `<div class="detail-head"><div class="detail-title"><div class="bot-icon">${b.runtime==='python'?'Py':'JS'}</div><div><h2>${esc(b.name)}</h2><span class="status ${esc(b.status)}">${statusLabel(b.status)}</span></div></div><div class="action-row"><button class="btn small" data-action="start">▶ Başlat</button><button class="btn small" data-action="restart">↻ Restart</button><button class="btn small" data-action="stop">■ Durdur</button></div></div><div class="tabs">${[['overview','Genel'],['console','Console'],['files','Dosyalar'],['env','Variables'],['settings','Ayarlar']].map(([k,v])=>`<button class="tab ${state.tab===k?'active':''}" data-tab="${k}">${v}</button>`).join('')}</div>${inner}`}
function wireDetail(){
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{stopConsole();state.tab=b.dataset.tab;renderBotDetail()}));
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>botAction(b.dataset.action)));
}
async function renderBotDetail(){if(!state.bot)return;let inner='';if(state.tab==='overview')inner=overviewHTML();else if(state.tab==='console')inner=consoleHTML();else if(state.tab==='files')inner=`<div id="filesRoot"><div class="empty">Dosyalar yükleniyor...</div></div>`;else if(state.tab==='env')inner=`<div id="envRoot"><div class="empty">Variables yükleniyor...</div></div>`;else inner=settingsHTML();$('#content').innerHTML=botDetailShell(inner);wireDetail();if(state.tab==='overview'){loadStats();state.statsTimer=setInterval(loadStats,5000)}if(state.tab==='console')startConsole();if(state.tab==='files')loadFiles();if(state.tab==='env')loadEnv();if(state.tab==='settings')wireSettings()}
function overviewHTML(){return `<div class="card"><div class="card-head"><h3>Canlı Kaynaklar</h3><span class="muted" style="font-size:11px">5 sn güncellenir</span></div><div class="card-body"><div class="metrics"><div class="metric"><span>Durum</span><b id="mStatus">${statusLabel(state.bot.status)}</b></div><div class="metric"><span>CPU</span><b id="mCPU">—</b></div><div class="metric"><span>RAM</span><b id="mRAM">—</b></div><div class="metric"><span>Network</span><b id="mNET">—</b></div></div></div></div>`}
async function loadStats(){if(!state.bot)return;try{const d=await api(`/api/bots/${state.bot.id}/stats`);$('#mStatus')&&( $('#mStatus').textContent=statusLabel(state.bot.status));if(d.available){$('#mCPU').textContent=d.stats.cpu;$('#mRAM').textContent=d.stats.memory;$('#mNET').textContent=d.stats.network}else{$('#mCPU').textContent='—';$('#mRAM').textContent='—';$('#mNET').textContent='—'}}catch{}}
async function botAction(action){try{toast(action==='start'?'Bot başlatılıyor...':'İşlem uygulanıyor...');const d=await api(`/api/bots/${state.bot.id}/action`,{method:'POST',body:{action}});state.bot.status=d.status;await loadBots();renderBotDetail();toast('İşlem tamamlandı')}catch(err){toast(err.message,true)}}
function consoleHTML(){return `<div id="console" class="console"><span class="console-line-system">eLite CP console bağlanıyor...</span>\n</div><form id="execForm" class="console-command"><input id="execInput" autocomplete="off" placeholder="Container içinde komut çalıştır: ls -la"><button class="btn primary">Çalıştır</button></form>`}
function stopConsole(){if(state.console){state.console.close();state.console=null}}
function appendConsole(text,system=false){const c=$('#console');if(!c)return;const span=document.createElement('span');if(system)span.className='console-line-system';span.textContent=text;c.appendChild(span);c.scrollTop=c.scrollHeight}
function startConsole(){stopConsole();const c=$('#console');if(c)c.textContent='';const es=new EventSource(`/api/bots/${state.bot.id}/console`);state.console=es;es.onmessage=e=>appendConsole(e.data.replaceAll('\\n','\n'));es.addEventListener('system',e=>appendConsole(`[system] ${e.data}\n`,true));es.onerror=()=>appendConsole('\n[console bağlantısı kapandı]\n',true);$('#execForm')?.addEventListener('submit',execCommand)}
async function execCommand(e){e.preventDefault();const input=$('#execInput');const cmd=input.value.trim();if(!cmd)return;appendConsole(`\n$ ${cmd}\n`,true);input.value='';try{const d=await api(`/api/bots/${state.bot.id}/exec`,{method:'POST',body:{command:cmd}});appendConsole((d.output||d.error||'')+'\n',!d.ok)}catch(err){appendConsole(err.message+'\n',true)}}
async function loadFiles(){try{const d=await api(`/api/bots/${state.bot.id}/files?path=${encodeURIComponent(state.filePath)}`);renderFiles(d.files||[])}catch(err){$('#filesRoot').innerHTML=`<div class="empty">${esc(err.message)}</div>`}}
function parentPath(p){const a=p.split('/').filter(Boolean);a.pop();return a.join('/')}
function renderFiles(files){const root=$('#filesRoot');if(!root)return;root.innerHTML=`<div id="dropzone" class="dropzone">ZIP veya dosyaları buraya bırak · ZIP otomatik açılır</div><div class="file-toolbar"><div class="breadcrumb">/${esc(state.filePath)}</div>${state.filePath?'<button class="btn small ghost" id="upDir">↑ Üst Dizin</button>':''}<button class="btn small ghost" id="newFile">+ Dosya</button><button class="btn small ghost" id="newDir">+ Klasör</button><label class="btn small primary" style="display:inline-flex;cursor:pointer">Yükle<input id="fileUpload" type="file" multiple hidden></label></div><div class="file-list">${files.length?files.map(f=>`<div class="file-row"><div class="file-name"><span>${f.is_dir?'▰':'▱'}</span><button data-open-file="${esc(f.path)}" data-dir="${f.is_dir}">${esc(f.name)}</button></div><div class="file-dim">${f.is_dir?'—':formatBytes(f.size)}</div><div class="file-dim">${new Date(f.modified_at).toLocaleString()}</div><div class="file-actions"><button class="btn small ghost" data-delete-file="${esc(f.path)}">Sil</button></div></div>`).join(''):'<div class="empty">Bu klasör boş.</div>'}</div>`;
  $('#upDir')?.addEventListener('click',()=>{state.filePath=parentPath(state.filePath);loadFiles()});
  $$('[data-open-file]').forEach(b=>b.addEventListener('click',()=>b.dataset.dir==='true'?(state.filePath=b.dataset.openFile,loadFiles()):openEditor(b.dataset.openFile)));
  $$('[data-delete-file]').forEach(b=>b.addEventListener('click',()=>deletePath(b.dataset.deleteFile)));
  $('#fileUpload')?.addEventListener('change',e=>uploadSelected(e.target.files));
  $('#newFile')?.addEventListener('click',newFile);$('#newDir')?.addEventListener('click',newDir);
  const dz=$('#dropzone');['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>uploadSelected(e.dataTransfer.files));
}
async function uploadSelected(files){if(!files?.length)return;const fd=new FormData();[...files].forEach(f=>fd.append('files',f));fd.append('path',state.filePath);try{await api(`/api/bots/${state.bot.id}/upload`,{method:'POST',body:fd});toast('Dosyalar yüklendi');loadFiles()}catch(err){toast(err.message,true)}}
async function openEditor(path){try{const d=await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(path)}`);state.editorPath=path;$('#editorTitle').textContent=path.split('/').pop();$('#editorPath').textContent='/'+path;$('#fileEditor').value=d.content;$('#editorDialog').showModal()}catch(err){toast(err.message,true)}}
async function saveEditor(){try{await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(state.editorPath)}`,{method:'PUT',body:{content:$('#fileEditor').value}});$('#editorDialog').close();toast('Dosya kaydedildi');loadFiles()}catch(err){toast(err.message,true)}}
async function newFile(){const name=prompt('Dosya adı (örn. main.py):');if(!name)return;const p=[state.filePath,name].filter(Boolean).join('/');state.editorPath=p;$('#editorTitle').textContent=name;$('#editorPath').textContent='/'+p;$('#fileEditor').value='';$('#editorDialog').showModal()}
async function newDir(){const name=prompt('Klasör adı:');if(!name)return;const p=[state.filePath,name].filter(Boolean).join('/');try{await api(`/api/bots/${state.bot.id}/mkdir`,{method:'POST',body:{path:p}});loadFiles()}catch(err){toast(err.message,true)}}
async function deletePath(path){if(!confirm(`Silinsin mi?\n${path}`))return;try{await api(`/api/bots/${state.bot.id}/file?path=${encodeURIComponent(path)}`,{method:'DELETE'});toast('Silindi');loadFiles()}catch(err){toast(err.message,true)}}
async function loadEnv(){try{const d=await api(`/api/bots/${state.bot.id}/env`);renderEnv(d.env||[])}catch(err){toast(err.message,true)}}
function renderEnv(env){const root=$('#envRoot');root.innerHTML=`<div class="card"><div class="card-head"><h3>Environment Variables</h3><button class="btn small ghost" id="addEnv">+ Variable</button></div><div class="card-body"><div id="envList" class="env-list">${env.map(e=>envRow(e.key,e.value)).join('')}</div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" id="saveEnv">Kaydet & Rebuild</button></div></div></div>`;$('#addEnv').addEventListener('click',()=>$('#envList').insertAdjacentHTML('beforeend',envRow('','')));$('#saveEnv').addEventListener('click',saveEnv);wireEnvRemove()}
function envRow(k,v){return `<div class="env-row"><input class="env-key mono" placeholder="DISCORD_TOKEN" value="${esc(k)}"><input class="env-value mono" type="password" placeholder="değer" value="${esc(v)}"><button type="button" class="env-remove">×</button></div>`}
function wireEnvRemove(){$$('.env-remove').forEach(b=>b.onclick=()=>b.parentElement.remove())}
async function saveEnv(){const env=$$('.env-row').map(r=>({key:$('.env-key',r).value.trim(),value:$('.env-value',r).value})).filter(e=>e.key);try{await api(`/api/bots/${state.bot.id}/env`,{method:'PUT',body:{env}});toast('Variables kaydedildi');const d=await api(`/api/bots/${state.bot.id}`);state.bot=d.bot;renderBotDetail()}catch(err){toast(err.message,true)}}
function settingsHTML(){const b=state.bot;return `<form id="settingsForm" class="card"><div class="card-head"><h3>Bot Ayarları</h3></div><div class="card-body"><div class="settings-grid"><label>Bot adı<input name="name" value="${esc(b.name)}"></label><label>Runtime<input value="${b.runtime==='python'?'Python 3.12':'Node.js 22'}" disabled></label><label>RAM (MB)<input type="number" name="memory_mb" min="64" max="32768" value="${b.memory_mb}"></label><label>CPU<input type="number" step="0.1" min="0.1" max="32" name="cpus" value="${b.cpus}"></label></div><label style="margin-top:16px">Başlatma komutu<textarea name="startup" rows="5">${esc(b.startup)}</textarea></label><div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary">Kaydet & Rebuild</button></div><div class="danger-zone"><h4>Tehlikeli Alan</h4><p class="muted" style="font-size:12px">Botu, container'ı ve tüm dosyalarını kalıcı olarak siler.</p><button type="button" id="deleteBot" class="btn danger">Botu Sil</button></div></div></form>`}
function wireSettings(){$('#settingsForm').addEventListener('submit',saveSettings);$('#deleteBot').addEventListener('click',deleteBot)}
async function saveSettings(e){e.preventDefault();const f=new FormData(e.target);try{const d=await api(`/api/bots/${state.bot.id}`,{method:'PUT',body:{name:f.get('name'),startup:f.get('startup'),memory_mb:Number(f.get('memory_mb')),cpus:Number(f.get('cpus'))}});state.bot=d.bot;await loadBots();toast('Ayarlar kaydedildi');renderBotDetail()}catch(err){toast(err.message,true)}}
async function deleteBot(){if(!confirm(`${state.bot.name} ve tüm dosyaları kalıcı olarak silinsin mi?`))return;try{await api(`/api/bots/${state.bot.id}`,{method:'DELETE'});state.bot=null;await loadBots();toast('Bot silindi');render()}catch(err){toast(err.message,true)}}

boot();
