// ── CLIENT-SIDE ROUTER ─────────────────────────────────────
const _PAGE_URL = { dashboard:'/', analysis:'/analisa', journal:'/jurnal', settings:'/setting' };
const _SEC_URL  = { kurs:'/setting/kurs', pairs:'/setting/pair', setups:'/setting/setup', akun:'/setting/akun', backup:'/setting/backup', about:'/setting/about' };
const _URL_ROUTE = {
  '/':              { page:'dashboard' },
  '/analisa':       { page:'analysis' },
  '/jurnal':        { page:'journal' },
  '/setting':       { page:'settings', sec:'kurs' },
  '/setting/kurs':  { page:'settings', sec:'kurs' },
  '/setting/pair':  { page:'settings', sec:'pairs' },
  '/setting/setup': { page:'settings', sec:'setups' },
  '/setting/akun':  { page:'settings', sec:'akun' },
  '/setting/backup':{ page:'settings', sec:'backup' },
  '/setting/about': { page:'settings', sec:'about' },
};

// ── ANIMASI HALAMAN — replay saat navigasi ─────────────────────
function _triggerPageAnimations(page) {
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;

  // Helper: reset & replay animasi dengan delay per-index
  function _replay(els, animClass, delayStep, baseDelay) {
    els.forEach((el, i) => {
      el.classList.remove(animClass);
      void el.offsetWidth; // force reflow
      el.style.animationDelay = (baseDelay + i * delayStep).toFixed(3) + 's';
      el.classList.add(animClass);
      // Bersihkan setelah animasi selesai supaya tidak konflik hover
      el.addEventListener('animationend', () => {
        el.classList.remove(animClass);
        el.style.animationDelay = '';
      }, { once: true });
    });
  }

  if (page === 'dashboard') {
    _replay([...pageEl.querySelectorAll('.kpi')], 'anim-kpi', 0.055, 0.02);
    _replay([...pageEl.querySelectorAll('.panel')], 'anim-panel', 0.06, 0.05);
  }

  if (page === 'analysis') {
    // metric-card diisi dinamis oleh renderAnalysis → tunda sedikit
    setTimeout(() => {
      _replay([...pageEl.querySelectorAll('.metric-card')], 'anim-metric', 0.045, 0.02);
      _replay([...pageEl.querySelectorAll('.panel')], 'anim-panel', 0.065, 0.04);
      // Replay Chart.js animations
      ['anEquity','anDist','anDay','anDD'].forEach(k => {
        if (APP.charts[k]) {
          try { APP.charts[k].reset(); APP.charts[k].update(); } catch(e){}
        }
      });
    }, 60);
  }

  if (page === 'journal') {
    _replay([...pageEl.querySelectorAll('.panel')], 'anim-panel', 0.05, 0.04);
    setTimeout(() => {
      _replay([...pageEl.querySelectorAll('.data-tbl tbody tr')], 'anim-row', 0.025, 0.03);
    }, 80);
  }

  if (page === 'settings') {
    _replay([...pageEl.querySelectorAll('.panel, .s-sec.active .panel')], 'anim-panel', 0.06, 0.03);
  }
}

function router(){
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const route = _URL_ROUTE[path] || { page:'dashboard' };
  _applyPage(route.page);
  if(route.page === 'settings' && route.sec){
    const tabEl = document.querySelector(`.settings-tab[onclick*="'${route.sec}'"]`);
    _applySec(route.sec, tabEl, false);
  }
}

function _applyPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  const sItem=document.querySelector(`.sidebar-item[onclick*="'${page}'"]`);
  if(sItem)sItem.classList.add('active');
  const mItem=document.getElementById('mbn-'+page);
  if(mItem)mItem.classList.add('active');
  const isSettings=page==='settings';
  document.getElementById('mainSubbar').style.display=isSettings?'none':'block';
  document.getElementById('settingsTabbar').style.display=isSettings?'block':'none';
  const ctrlRow=document.getElementById('mainSubbar').querySelector('.ctrl-row');
  ctrlRow.style.visibility=page==='journal'?'hidden':'visible';
  if(page==='analysis')renderAnalysis();
  if(page==='journal')renderJournal();
  if(page==='settings')renderSettings();
  // Replay animasi setiap kali halaman dibuka
  requestAnimationFrame(()=>_triggerPageAnimations(page));
}

function _applySec(id, el, push){
  document.querySelectorAll('.s-sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.settings-tab').forEach(s=>s.classList.remove('active'));
  document.getElementById('ssec-'+id).classList.add('active');
  if(el) el.classList.add('active');
  if(push) history.pushState(null, '', _SEC_URL[id] || '/setting');
}

function switchPage(page, el){
  _applyPage(page);
  if(el && !el.classList.contains('sidebar-item') && !el.classList.contains('mobile-nav-item')) el.classList.add('active');
  const activeSec = document.querySelector('.s-sec.active');
  const secId = activeSec ? activeSec.id.replace('ssec-','') : null;
  const url = page==='settings' ? (_SEC_URL[secId] || '/setting') : (_PAGE_URL[page] || '/');
  history.pushState(null, '', url);
}

window.addEventListener('popstate', router);
// SIDEBAR TOGGLE
function toggleSidebar(){
  document.getElementById('mainSidebar').classList.toggle('collapsed');
}

// MODAL
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

function openAddModal(){
  APP.editTradeId=null;
  document.getElementById('tradeModalTitle').textContent='➕ Tambah Trade Baru';
  const now=new Date();
  document.getElementById('fm-date').value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  document.getElementById('fm-pnl-usd').value='';
  document.getElementById('fm-tf').value='15m';
  document.getElementById('fm-entry').value='';
  document.getElementById('fm-sl').value='';
  document.getElementById('fm-tp').value='';
  document.getElementById('fm-exit').value='';
  document.getElementById('fm-note').value='';
  document.getElementById('fm-fee').value='';
  document.getElementById('fm-rr').value='';
  document.getElementById('fm-rr-display').value='';
  document.getElementById('pnlUSDPreview').textContent='$0.00';
  document.getElementById('pnlRpPreview').textContent='Rp 0';
  document.getElementById('feePreview').textContent='Rp 0';
  document.getElementById('pnlNetPreview').textContent='';
  // Reset hasil badge
  const badge=document.getElementById('fm-result-badge');
  if(badge){badge.className='res-be';badge.textContent='—';}
  document.getElementById('fm-result').value='OPEN';
  populateTradeForm();
  openModal('tradeModal');
}

function openEditModal(id){
  const t=APP.trades.find(x=>x.id===id);if(!t)return;
  APP.editTradeId=id;
  document.getElementById('tradeModalTitle').textContent='✏️ Edit Trade #'+id;
  populateTradeForm(t.akun);
  document.getElementById('fm-akun').value=t.akun;
  document.getElementById('fm-date').value=dateToInputVal(t.date);
  document.getElementById('fm-pair').value=t.pair;
  document.getElementById('fm-tf').value=t.tf||'15m';
  document.getElementById('fm-dir').value=t.dir;
  document.getElementById('fm-lot').value=t.lot;
  document.getElementById('fm-entry').value=t.entry;
  document.getElementById('fm-sl').value=t.sl||'';
  document.getElementById('fm-tp').value=t.tp||'';
  document.getElementById('fm-exit').value=t.exit||'';
  // Kosongkan override PnL agar RR, Hasil, dan estimasi PnL dihitung ulang
  // secara otomatis dari Entry/SL/Exit yang baru diisi. User bisa isi manual
  // field Override PnL USD jika diperlukan setelah modal terbuka.
  document.getElementById('fm-pnl-usd').value='';
  document.getElementById('fm-fee').value=t.fee||'';
  renderSetupPicker(getSetupArr(t));
  document.getElementById('fm-note').value=t.note;
  // Trigger kalkulasi ulang: PnL preview, RR, dan Hasil otomatis ter-refresh
  onPairChange();
  openModal('tradeModal');
}

function populateTradeForm(includeAkunName){
  const activeAkuns=APP.akuns.filter(a=>a.status!=='inactive');
  let opts=activeAkuns.map(a=>`<option>${a.name}</option>`).join('');
  if(includeAkunName&&!activeAkuns.some(a=>a.name===includeAkunName)){
    const arsipAkun=APP.akuns.find(a=>a.name===includeAkunName);
    if(arsipAkun)opts+=`<option value="${arsipAkun.name}">${arsipAkun.name} (arsip)</option>`;
  }
  document.getElementById('fm-akun').innerHTML=opts;
  document.getElementById('fm-pair').innerHTML=APP.pairs.map(p=>`<option value="${p.name}">${p.name} — ${p.desc||''}</option>`).join('');
  renderSetupPicker([]);
  onPairChange();
}

// ── SETUP MULTI-PICKER HELPERS ─────────────────────────────
function getSetupArr(t){const s=t.setup;if(!s||s==='')return[];if(Array.isArray(s))return s.filter(Boolean);
  // Handle comma-separated string yang disimpan dari DB (contoh: "ICT, Breakout")
  return s.split(',').map(x=>x.trim()).filter(Boolean);}
function renderSetupPicker(selected=[]){
  const picker=document.getElementById('fm-setup-picker');
  if(!picker)return;
  if(!APP.setups.length){picker.innerHTML='<span style="font-size:11px;color:var(--txt2);">Belum ada setup — tambah di Settings → Setup</span>';return;}
  picker.innerHTML=APP.setups.map(s=>`<div class="setup-pick-chip${selected.includes(s)?' selected':''}" onclick="this.classList.toggle('selected')">${s}</div>`).join('');
}
function getSelectedSetups(){return[...document.querySelectorAll('#fm-setup-picker .setup-pick-chip.selected')].map(el=>el.textContent.trim());}

function saveTrade(){
  const entryVal=parseFloat(document.getElementById('fm-entry').value)||0;
  if(!entryVal){return showToast('❌ Entry Price wajib diisi!','error');}
  const exitVal=parseFloat(document.getElementById('fm-exit').value)||0;
  const manual=document.getElementById('fm-pnl-usd').value;
  const pnlUSD=manual!==''?parseFloat(manual)||0:calcPnLAuto();
  const grossRp=Math.round(pnlUSD*APP.kurs);
  const fee=parseInt(document.getElementById('fm-fee').value)||0;
  const pnlRp=grossRp-fee;
  const data={
    akun:document.getElementById('fm-akun').value,
    date:document.getElementById('fm-date').value,
    pair:document.getElementById('fm-pair').value,
    tf:document.getElementById('fm-tf').value,
    dir:document.getElementById('fm-dir').value,
    lot:parseFloat(document.getElementById('fm-lot').value)||0.01,
    entry:parseFloat(document.getElementById('fm-entry').value)||0,
    sl:parseFloat(document.getElementById('fm-sl').value)||0,
    tp:parseFloat(document.getElementById('fm-tp').value)||0,
    exit:exitVal,
    pnlUSD,pnlRp,fee,
    rr:parseFloat(document.getElementById('fm-rr').value)||0,
    result:document.getElementById('fm-result').value,
    setup:getSelectedSetups(),
    note:document.getElementById('fm-note').value,
  };
  const wasEditId = APP.editTradeId; // capture BEFORE reset
  if(APP.editTradeId!==null){
    const idx=APP.trades.findIndex(t=>t.id===APP.editTradeId);
    if(idx>-1)APP.trades[idx]={...APP.trades[idx],...data};
    showToast('✅ Trade #'+APP.editTradeId+' diperbarui!');
  }else{
    const newId=Math.max(0,...APP.trades.map(t=>t.id))+1;
    APP.trades.unshift({id:newId,...data}); // unshift = newest first
    data.id=newId;
    showToast('✅ Trade baru ditambahkan!');
  }
  APP.editTradeId=null; // reset agar add trade berikutnya tidak menimpa data lama
  closeModal('tradeModal');
  updateAll();
  renderJournal(); // selalu render ulang jurnal agar perubahan langsung tampil
  // Sync ke cloud — gunakan wasEditId (sebelum modal close reset)
  const tradeToSync = wasEditId!==null
    ? APP.trades.find(t=>t.id===wasEditId)
    : APP.trades[0];
  cloudSync('saveTrade', {trade: tradeToSync||data});
}

// PAIR MODAL
