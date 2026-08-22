// ══════════════════════════════════════════════════════════
//  KONFIGURASI CLOUD — ISI SESUAI DEPLOYMENT GAS ANDA
// ══════════════════════════════════════════════════════════
const GAS_URL   = 'https://script.google.com/macros/s/AKfycbw5XMGydEm4lc6RO22nPIK2RHpmbLoC070VKtjh1p1U4YDvQUBCERFEXGtxPRWkjqo/exec'; // ← Tempel URL dari GAS deployment
const SHEET_ID  = '1LiA3hIK8Y3FRJLNcf68hZd5ru0rrjU1Aq51p28siiHc';          // ← Sheet ID (untuk referensi)

// ══════════════════════════════════════════════════════════
//  AUTH — token & profil disimpan oleh login.html di localStorage,
//  dibaca di sini. Kalau belum login, langsung dialihkan ke login.html.
// ══════════════════════════════════════════════════════════
// jt_sessionToken (bukan jt_idToken lagi) yang dipakai untuk komunikasi dengan server —
// idToken Google cuma tahan ~1 jam sehingga user sering ke-log-out sendiri di tengah pemakaian.
function getAuthToken() { return localStorage.getItem('jt_sessionToken') || ''; }
function getAuthUser()  { try { return JSON.parse(localStorage.getItem('jt_user') || 'null'); } catch (e) { return null; } }
function clearAuth()    { localStorage.removeItem('jt_idToken'); localStorage.removeItem('jt_user'); localStorage.removeItem('jt_sessionToken'); }
function goToLogin(reason) {
  clearAuth();
  if (reason) sessionStorage.setItem('jt_loginMsg', reason);
  location.href = 'login.html';
}
if (!getAuthToken()) { goToLogin(); }

// ══════════════════════════════════════════════════════════
//  STATE APLIKASI (default; akan di-override dari cloud)
// ══════════════════════════════════════════════════════════
const APP={
  kurs:17223,
  kursHistory:[],
  pairs:[
    {name:'XAU/USD',type:'commodity100',mult:100,pip:0.01,color:'chip-gold',desc:'Gold / Emas'},
    {name:'EUR/USD',type:'forex',mult:100000,pip:0.0001,color:'chip-blue',desc:'Euro vs Dollar'},
    {name:'GBP/USD',type:'forex',mult:100000,pip:0.0001,color:'chip-purple',desc:'Pound vs Dollar'},
    {name:'AUD/USD',type:'forex',mult:100000,pip:0.0001,color:'chip-cyan',desc:'Aussie vs Dollar'},
    {name:'USD/JPY',type:'jpy',mult:1000,pip:0.01,color:'chip-blue',desc:'Dollar vs Yen'},
    {name:'NZD/USD',type:'forex',mult:100000,pip:0.0001,color:'chip-cyan',desc:'Kiwi vs Dollar'},
    {name:'XAG/USD',type:'commodity1000',mult:5000,pip:0.001,color:'chip-gray',desc:'Silver / Perak'},
    {name:'WTI/USD',type:'commodity1000',mult:1000,pip:0.01,color:'chip-red',desc:'Crude Oil'},
  ],
  setups:['Scalping','Swing','Breakout','Retest','News Play','Reversal','Trend Following'],
  akuns:[
    {name:'SCALPING ONE',broker:'XM Global',currency:'USD',balance:50,modal:800000,type:'live',status:true},
    {name:'BACKTEST v5.m',broker:'Demo Account',currency:'IDR',balance:800000,modal:800000,type:'demo',status:true},
  ],
  trades:[],
  risk:{ maxDailyLoss:500000, maxTradeLoss:200000, maxTrades:10 },
  showArsip:false,
  editTradeId:null,editPairIdx:null,editAkunIdx:null,_deleteAkunIdx:null,
  jSortKey:'id',jSortAsc:false,jPage:1,jPageSize:15,jSelected:new Set(),
  rekapMode:'day',equityMode:'day',charts:{},
  me:null, isAdmin:false
};

// ══════════════════════════════════════════════════════════
//  CLOUD API
// ══════════════════════════════════════════════════════════

/**
 * Kirim request ke GAS Web App. idToken disisipkan otomatis di setiap request.
 * Menggunakan Content-Type: text/plain untuk menghindari CORS preflight.
 */
async function api(action, payload = {}) {
  if (!GAS_URL || GAS_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    throw new Error('GAS_URL belum dikonfigurasi. Edit konstanta GAS_URL di script.');
  }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload, sessionToken: getAuthToken() })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();

  // Sesi tidak valid / akun tidak lagi aktif → tendang balik ke login
  if (data && data.error) {
    const authErrors = ['INVALID_TOKEN', 'NO_SPREADSHEET', 'ACCOUNT_PENDING', 'ACCOUNT_INACTIVE', 'ACCOUNT_REJECTED'];
    if (authErrors.indexOf(data.error) !== -1) {
      goToLogin(data.message || 'Sesi berakhir, silakan login ulang.');
      throw new Error(data.message || data.error);
    }
  }
  if (data && data.me) {
    APP.me = data.me;
    APP.isAdmin = data.me.role === 'admin';
    localStorage.setItem('jt_user', JSON.stringify(data.me));
  }
  return data;
}

/** Fire-and-forget cloud sync dengan feedback pill */
function cloudSync(action, payload, successMsg) {
  setCloudPill('saving');
  api(action, payload)
    .then(r => {
      if (r.error) { setCloudPill('err'); showToast('❌ Cloud: ' + r.error, 'error'); }
      else { setCloudPill('idle'); if(successMsg) showToast(successMsg); }
    })
    .catch(e => { setCloudPill('err'); showToast('❌ Gagal sync cloud: ' + e.message, 'error'); });
}

// ── Cloud status pill ──────────────────────────────────────
function setCloudPill(state) {
  const el = document.getElementById('cloudPill');
  if (!el) return;
  el.className = 'cloud-pill ' + state;
  const labels = { idle: '☁️ Tersimpan', saving: '⏳ Menyimpan...', err: '⚠️ Error' };
  el.textContent = labels[state] || '☁️ Cloud';
}

// ── Loader overlay ─────────────────────────────────────────
function showLoader(sub) {
  const el = document.getElementById('cloudLoader');
  if (el) { el.classList.remove('hidden'); if(sub) document.getElementById('cloudLoaderSub').textContent = sub; }
}
function hideLoader() {
  const el = document.getElementById('cloudLoader');
  if (el) setTimeout(() => el.classList.add('hidden'), 600);
}

// HELPERS
const fmt=n=>Math.round(Math.abs(n)).toLocaleString('id');
const fmtRp=n=>(n>=0?'':'- ')+'Rp '+fmt(n);
const fmtPct=n=>n.toFixed(2)+'%';
const getPair=name=>{const p=APP.pairs.find(p=>p.name===name);return p||(APP.pairs[0]??{name:'N/A',type:'forex',mult:100000,pip:0.0001,color:'chip-blue',desc:''});}
const tfChipClass=tf=>{
  const map={'1m':'chip-red','5m':'chip-red','15m':'chip-gold','30m':'chip-gold','1h':'chip-blue','4h':'chip-blue','1D':'chip-green'};
  return map[tf]||'chip-gray';
}
const getAkun=name=>APP.akuns.find(a=>a.name===name);
const g=(id,val)=>document.getElementById(id).textContent=val;

// PNL CALC
