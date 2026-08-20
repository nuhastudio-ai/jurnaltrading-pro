// ── DATE RANGE PICKER ──────────────────────────────────────
const DRP = {
  target: null,       // 'main' | 'journal'
  startDate: null,    // YYYY-MM-DD
  endDate: null,
  hoverDate: null,
  selecting: 0,       // 0=idle, 1=picking start, 2=picking end
  viewYear: 0,
  viewMonth: 0,       // left calendar month (right = +1)
  preset: 'all',      // current preset key
};

const DRP_PRESETS = {
  today:   () => { const d=_drpToday(); return {from:d, to:d}; },
  last7:   () => { return {from:_drpDaysAgo(6), to:_drpToday()}; },
  last30:  () => { return {from:_drpDaysAgo(29), to:_drpToday()}; },
  last3m:  () => { const n=new Date();n.setMonth(n.getMonth()-3);return {from:_drpFmt(n),to:_drpToday()}; },
  last12m: () => { const n=new Date();n.setFullYear(n.getFullYear()-1);return {from:_drpFmt(n),to:_drpToday()}; },
  mtd:     () => { const n=new Date();return {from:n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-01',to:_drpToday()}; },
  ytd:     () => { return {from:new Date().getFullYear()+'-01-01', to:_drpToday()}; },
  all:     () => { return {from:'', to:''}; },
};

const DRP_LABELS = {
  today:'Hari Ini', last7:'7 Hari Terakhir', last30:'30 Hari Terakhir',
  last3m:'3 Bulan Terakhir', last12m:'12 Bulan Terakhir', mtd:'Bulan Ini',
  ytd:'Tahun Ini', all:'Semua Waktu',
};

const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

function _drpToday(){ return new Date().toISOString().slice(0,10); }
function _drpDaysAgo(n){ const d=new Date();d.setDate(d.getDate()-n);return _drpFmt(d); }
function _drpFmt(d){ return d.toISOString().slice(0,10); }
function _drpParse(s){ const [y,m,dd]=s.split('-').map(Number);return new Date(y,m-1,dd); }

function openDRP(target) {
  DRP.target = target;
  const now = new Date();
  DRP.viewYear = now.getFullYear();
  DRP.viewMonth = now.getMonth(); // left month

  // Load current values
  const fromId = target==='main'?'dateFrom':'jDateFrom';
  const toId   = target==='main'?'dateTo':'jDateTo';
  DRP.startDate = document.getElementById(fromId).value || null;
  DRP.endDate   = document.getElementById(toId).value || null;
  DRP.selecting = 0;
  DRP.hoverDate = null;

  // Position popup under the button
  const btnId = target==='main'?'mainDrpBtn':'jDrpBtn';
  const btn = document.getElementById(btnId);
  const rect = btn.getBoundingClientRect();
  const popup = document.getElementById('drpPopup');
  popup.style.top = (rect.bottom + 6) + 'px';
  // Align left, but keep in viewport
  let left = rect.left;
  popup.style.left = left + 'px';
  popup.style.right = 'auto';

  // Show
  document.getElementById('drpOverlay').style.display = 'block';
  popup.classList.add('open');

  // Highlight active preset
  document.querySelectorAll('.drp-preset').forEach(el => {
    el.classList.toggle('drp-preset-active', el.dataset.preset === DRP.preset);
  });

  _drpRender();

  // After render, fix overflow
  requestAnimationFrame(() => {
    const pr = popup.getBoundingClientRect();
    if(pr.right > window.innerWidth - 8) {
      popup.style.left = 'auto';
      popup.style.right = '8px';
    }
    if(pr.bottom > window.innerHeight - 8) {
      popup.style.top = (rect.top - pr.height - 6) + 'px';
    }
  });
}

function closeDRP() {
  document.getElementById('drpOverlay').style.display = 'none';
  document.getElementById('drpPopup').classList.remove('open');
}

function drpSelectPreset(key) {
  DRP.preset = key;
  const range = DRP_PRESETS[key]();
  DRP.startDate = range.from || null;
  DRP.endDate   = range.to   || null;
  DRP.selecting = 0;
  DRP.hoverDate = null;

  document.querySelectorAll('.drp-preset').forEach(el => {
    el.classList.toggle('drp-preset-active', el.dataset.preset === key);
  });

  _drpRender();
  _drpUpdateFooter();
}

function drpNavMonth(dir) {
  DRP.viewMonth += dir;
  if(DRP.viewMonth > 11){ DRP.viewMonth=0; DRP.viewYear++; }
  if(DRP.viewMonth < 0){ DRP.viewMonth=11; DRP.viewYear--; }
  _drpRender();
}

function drpDayMouseDown(dateStr) {
  // Selalu mulai seleksi baru saat mousedown
  DRP.startDate = dateStr;
  DRP.endDate = null;
  DRP.selecting = 1;
  DRP.hoverDate = null;
  DRP.preset = 'custom';
  document.querySelectorAll('.drp-preset').forEach(el => el.classList.remove('drp-preset-active'));
  _drpRender();
  _drpUpdateFooter();
}

function drpDayMouseUp(dateStr) {
  if(DRP.selecting === 1) {
    // Selesaikan seleksi: tentukan start & end yang benar
    if(dateStr < DRP.startDate) {
      DRP.endDate = DRP.startDate;
      DRP.startDate = dateStr;
    } else {
      DRP.endDate = dateStr;
    }
    DRP.selecting = 2;
    DRP.hoverDate = null;
    _drpRender();
    _drpUpdateFooter();
  }
}

function drpDayHover(dateStr) {
  if(DRP.selecting === 1) {
    DRP.hoverDate = dateStr;
    _drpRender();
  }
}

// Global mouseup: jika user melepas mouse di luar sel tanggal (di area popup/overlay),
// selesaikan seleksi menggunakan hoverDate terakhir supaya tidak "menggantung"
document.addEventListener('mouseup', function(e) {
  if(DRP.selecting === 1) {
    const candidate = DRP.hoverDate || DRP.startDate;
    if(candidate) {
      if(candidate < DRP.startDate) {
        DRP.endDate = DRP.startDate;
        DRP.startDate = candidate;
      } else {
        DRP.endDate = candidate;
      }
    }
    DRP.selecting = 2;
    DRP.hoverDate = null;
    _drpRender();
    _drpUpdateFooter();
  }
});

function _drpRender() {
  const rightYear = DRP.viewMonth === 11 ? DRP.viewYear + 1 : DRP.viewYear;
  const rightMonth = (DRP.viewMonth + 1) % 12;
  document.getElementById('drpTitleLeft').textContent  = MONTH_ID[DRP.viewMonth] + ', ' + DRP.viewYear;
  document.getElementById('drpTitleRight').textContent = MONTH_ID[rightMonth] + ', ' + rightYear;
  _drpBuildGrid('drpGridLeft', DRP.viewYear, DRP.viewMonth);
  _drpBuildGrid('drpGridRight', rightYear, rightMonth);
  _drpUpdateFooter();
}

function _drpBuildGrid(gridId, year, month) {
  const grid = document.getElementById(gridId);
  const today = _drpToday();
  const dows = ['S','S','R','K','J','S','M']; // Mon-Sun Indonesian
  let html = dows.map(d=>`<div class="drp-dow">${d}</div>`).join('');

  const firstDay = new Date(year, month, 1);
  // Adjust so week starts Monday (0=Mon…6=Sun)
  let startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  // Effective range for highlighting (consider hover)
  const effEnd = DRP.selecting === 1 && DRP.hoverDate
    ? (DRP.hoverDate >= DRP.startDate ? DRP.hoverDate : DRP.startDate)
    : DRP.endDate;
  const effStart = DRP.selecting === 1 && DRP.hoverDate
    ? (DRP.hoverDate < DRP.startDate ? DRP.hoverDate : DRP.startDate)
    : DRP.startDate;

  // Prev month trailing days
  for(let i = startDow - 1; i >= 0; i--) {
    const d = prevDays - i;
    html += `<div class="drp-day drp-day-other">${d}</div>`;
  }

  for(let d = 1; d <= daysInMonth; d++) {
    const ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    let cls = 'drp-day';
    if(ds === today) cls += ' drp-day-today';
    const isStart = ds === DRP.startDate;
    const isEnd   = ds === effEnd;
    const inRange = effStart && effEnd && ds > effStart && ds < effEnd;
    if(isStart && isEnd) cls += ' drp-day-start drp-day-end';
    else if(isStart) cls += ' drp-day-start';
    else if(isEnd)   cls += ' drp-day-end';
    else if(inRange) cls += ' drp-day-in-range';
    html += `<div class="${cls}" onmousedown="drpDayMouseDown('${ds}')" onmouseup="drpDayMouseUp('${ds}')" onmouseenter="drpDayHover('${ds}')" ondragstart="return false">${d}</div>`;
  }

  // Fill trailing
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  let nd = 1;
  for(let i = startDow + daysInMonth; i < totalCells; i++) {
    html += `<div class="drp-day drp-day-other">${nd++}</div>`;
  }

  grid.innerHTML = html;
}

function _drpUpdateFooter() {
  const lbl = document.getElementById('drpRangeLbl');
  if(!DRP.startDate && !DRP.endDate) {
    lbl.innerHTML = DRP.preset === 'all' ? '<b>Semua Waktu</b>' : 'Pilih tanggal awal';
  } else if(DRP.startDate && !DRP.endDate) {
    lbl.innerHTML = 'Dari: <b>' + _drpFormatDisplay(DRP.startDate) + '</b> — pilih akhir';
  } else {
    lbl.innerHTML = '<b>' + _drpFormatDisplay(DRP.startDate) + '</b> s/d <b>' + _drpFormatDisplay(DRP.endDate) + '</b>';
  }
}

function _drpFormatDisplay(ds) {
  if(!ds) return '—';
  const [y,m,d] = ds.split('-');
  return d + ' ' + MONTH_ID[parseInt(m)-1] + ' ' + y;
}

function drpApply() {
  const fromId = DRP.target==='main'?'dateFrom':'jDateFrom';
  const toId   = DRP.target==='main'?'dateTo':'jDateTo';

  // Jika masih selecting (belum selesai pilih tanggal akhir),
  // gunakan hoverDate atau startDate sebagai endDate
  if(DRP.selecting === 1) {
    const candidate = DRP.hoverDate || DRP.startDate;
    if(candidate && DRP.startDate) {
      if(candidate < DRP.startDate) {
        DRP.endDate = DRP.startDate;
        DRP.startDate = candidate;
      } else {
        DRP.endDate = candidate;
      }
    }
    DRP.selecting = 2;
    DRP.hoverDate = null;
  }
  // Jika endDate masih null tapi startDate ada → single-day range
  if(DRP.startDate && !DRP.endDate) {
    DRP.endDate = DRP.startDate;
  }

  document.getElementById(fromId).value = DRP.startDate || '';
  document.getElementById(toId).value   = DRP.endDate   || '';

  // Update button label
  const labelId = DRP.target==='main'?'mainDrpLabel':'jDrpLabel';
  const btnId   = DRP.target==='main'?'mainDrpBtn':'jDrpBtn';
  let displayLabel;
  if(DRP.preset && DRP.preset !== 'custom') {
    displayLabel = DRP_LABELS[DRP.preset] || 'Semua Waktu';
  } else if(DRP.startDate && DRP.endDate) {
    displayLabel = _drpFormatDisplay(DRP.startDate) + ' – ' + _drpFormatDisplay(DRP.endDate);
  } else if(DRP.startDate) {
    displayLabel = 'Dari ' + _drpFormatDisplay(DRP.startDate);
  } else {
    displayLabel = 'Semua Waktu';
  }
  document.getElementById(labelId).textContent = displayLabel;
  document.getElementById(btnId).classList.toggle('drp-active', DRP.preset !== 'all' || !!DRP.startDate);

  closeDRP();

  // Trigger update
  if(DRP.target === 'main') updateAll();
  else renderJournal();
}
const _toastQueue=[];let _toastRunning=false;
function showToast(msg,type=''){
  _toastQueue.push({msg,type});
  if(!_toastRunning)_processToastQueue();
}
function _processToastQueue(){
  if(!_toastQueue.length){_toastRunning=false;return;}
  _toastRunning=true;
  const {msg,type}=_toastQueue.shift();
  const el=document.createElement('div');
  el.className='toast'+(type?' '+type:'');
  el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>{
    el.style.transition='opacity .25s ease, transform .25s ease';
    el.style.opacity='0';
    el.style.transform='translateX(-50%) translateY(-8px)';
    setTimeout(()=>{el.remove();_processToastQueue();},260);
  },2800);
}
function initWinLossChart(){/* replaced by SVG card */}
setInterval(()=>{const n=new Date();const str=[n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');document.getElementById('clockBox').textContent=str;document.getElementById('fTime').textContent=n.toLocaleDateString('id-ID')+' '+str;},1000);
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;if(e.key==='n'||e.key==='N')openAddModal();if(e.key==='e'||e.key==='E')exportCSV();if(e.key==='f'||e.key==='F'){const jTab=document.querySelectorAll('.sidebar-item')[2];switchPage('journal',jTab);setTimeout(()=>document.getElementById('jSearchPair')?.focus(),100);}if(e.key==='Escape')document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('open'));});

// ── MAIN BOOT ──────────────────────────────────────────────
// Set filter Kalender & Rekap ke bulan/tahun sekarang
function initDateFilters(){
  const now=new Date();
  const mNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const curM=mNames[now.getMonth()];
  const curY=String(now.getFullYear());
  ['calYear','rekapYear'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(![...el.options].some(o=>o.value===curY)){el.add(new Option(curY,curY));}
    el.value=curY;
  });
  ['calMonth','rekapMonth'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value=curM;
  });
}

(async function init() {
  initDateFilters();
  // Swipe navigation untuk mobile
  _addSwipe('rekapNavWrap',()=>navRekapMonth(1),()=>navRekapMonth(-1));
  _addSwipe('calPanel',()=>navCalMonth(1),()=>navCalMonth(-1));
  // 1. Tampilkan loader
  showLoader('Menghubungkan ke Google Spreadsheet...');
  setCloudPill('saving');

  // 2. Jika GAS_URL belum diisi → tampilkan warning tapi tetap jalan
  if (!GAS_URL || GAS_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    document.getElementById('cloudLoaderSub').textContent =
      '⚠️ GAS_URL belum dikonfigurasi. Menggunakan data default.';
    await new Promise(r => setTimeout(r, 1800));
    hideLoader();
    setCloudPill('err');
    // Render dengan data default yang sudah ada di APP
    document.getElementById('kursDisplay').textContent = 'Rp ' + APP.kurs.toLocaleString('id');
    document.getElementById('kursInput').value = APP.kurs;
    populateCtrlAkun(); initWinLossChart(); updateAll(); renderSettings(); router();
    showToast('⚠️ Isi GAS_URL untuk mengaktifkan cloud storage', 'info');
    return;
  }

  // 3. Load dari cloud
  try {
    document.getElementById('cloudLoaderSub').textContent = 'Mengambil data jurnal & pengaturan...';
    const data = await api('getAll');

    if (data.error) throw new Error(data.error);

    applyCloudData(data);
    setCloudPill('idle');
    applyAdminUI();
    applyUserBadge();

    const total = APP.trades.length;
    document.getElementById('cloudLoaderSub').textContent =
      `✅ ${total} trade, ${APP.pairs.length} pair, ${APP.akuns.length} akun dimuat!`;

    await new Promise(r => setTimeout(r, 700));
    hideLoader();

    // 4. Render semua
    document.getElementById('kursDisplay').textContent = 'Rp ' + APP.kurs.toLocaleString('id');
    document.getElementById('kursInput').value = APP.kurs;
    populateCtrlAkun(); initWinLossChart(); updateAll(); renderSettings(); router();

    if (total === 0) showToast('☁️ Cloud terhubung! Belum ada trade.', 'info');
    else showToast(`☁️ ${total} trade berhasil dimuat dari cloud!`);

  } catch (err) {
    console.error('Cloud load error:', err);
    document.getElementById('cloudLoaderSub').textContent = '';

    // Tampilkan error di loader
    const sub = document.getElementById('cloudLoaderSub');
    sub.innerHTML = `<div class="cloud-loader-err">
      ❌ Gagal terhubung ke cloud:<br><b>${err.message}</b><br><br>
      Pastikan GAS sudah di-deploy & SHEET_ID benar.<br>
      <button onclick="location.reload()" style="margin-top:10px;background:var(--c-blue2);color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:700;">🔄 Coba Lagi</button>
    </div>`;
    setCloudPill('err');

    // Tetap render dengan data default supaya app tidak blank
    await new Promise(r => setTimeout(r, 2500));
    hideLoader();
    document.getElementById('kursDisplay').textContent = 'Rp ' + APP.kurs.toLocaleString('id');
    document.getElementById('kursInput').value = APP.kurs;
    populateCtrlAkun(); initWinLossChart(); updateAll(); renderSettings(); router();
    showToast('⚠️ Offline mode — data cloud tidak tersedia', 'error');
  }
})();
