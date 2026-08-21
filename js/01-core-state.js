// ══════════════════════════════════════════════════════════
//  AUTH — Firebase Auth. Kalau belum login, langsung ke login.html.
//  authReady = Promise yang resolve setelah status login pertama kali
//  selesai dicek (dipakai file 08-ui-utils-boot.js sebelum load data).
// ══════════════════════════════════════════════════════════
function waitForAuth() {
  return new Promise(resolve => {
    const unsub = firebase.auth().onAuthStateChanged(user => { unsub(); resolve(user); });
  });
}

let CURRENT_USER = null;
const authReady = (async () => {
  CURRENT_USER = await waitForAuth();
  if (!CURRENT_USER) { location.href = 'login.html'; return; }
})();

function currentUid() {
  if (!CURRENT_USER) { location.href = 'login.html'; throw new Error('Belum login'); }
  return CURRENT_USER.uid;
}
function requireAdmin() {
  if (!APP.isAdmin) throw new Error('Aksi ini khusus admin');
}
function accountStatusMessage(status) {
  if (status === 'pending')  return 'Akun kamu masih menunggu persetujuan admin.';
  if (status === 'inactive') return 'Akun kamu sudah dinonaktifkan. Hubungi admin.';
  if (status === 'rejected') return 'Pendaftaran kamu belum disetujui.';
  return 'Akun tidak aktif.';
}
function fmtDate(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function logout() {
  if (!confirm('Keluar dari akun ini?')) return;
  firebase.auth().signOut().then(() => location.href = 'login.html');
}

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
//  FIRESTORE HELPERS — struktur data:
//  /users/{uid}                    → profil (email, nama, role, status)
//  /users/{uid}/data/main          → 1 dokumen: kurs, kursHistory, pairs, setups, akuns, risk
//  /users/{uid}/trades/{tradeId}   → 1 dokumen per trade
// ══════════════════════════════════════════════════════════
const userDoc   = uid => firebase.firestore().collection('users').doc(uid);
const dataDoc   = uid => userDoc(uid).collection('data').doc('main');
const tradesCol = uid => userDoc(uid).collection('trades');

/**
 * Pengganti pemanggilan Apps Script — signature (action, payload) DIPERTAHANKAN SAMA
 * supaya semua pemanggil di file 02-09 tidak perlu diubah sama sekali.
 * Sekarang semua operasi jalan langsung ke Firestore (client SDK), diamankan oleh
 * firestore.rules (bukan lagi oleh backend Apps Script).
 */
async function api(action, payload = {}) {
  await authReady;
  const uid = currentUid();

  switch (action) {

    case 'getAll': {
      const profileSnap = await userDoc(uid).get();
      const profile = profileSnap.exists ? profileSnap.data() : null;
      if (!profile || profile.status !== 'active') {
        const msg = accountStatusMessage(profile ? profile.status : 'pending');
        location.href = 'login.html';
        throw new Error(msg);
      }
      APP.me = { email: profile.email, name: profile.name, picture: profile.picture, role: profile.role };
      APP.isAdmin = profile.role === 'admin';

      const [dataSnap, tradesSnap] = await Promise.all([ dataDoc(uid).get(), tradesCol(uid).get() ]);
      const settings = dataSnap.exists ? dataSnap.data() : {};
      const trades = tradesSnap.docs.map(d => d.data());

      return {
        ok: true,
        trades,
        kurs: settings.kurs,
        kursHistory: settings.kursHistory || [],
        pairs: settings.pairs,
        setups: settings.setups,
        akuns: settings.akuns,
        risk: settings.risk,
        me: APP.me
      };
    }

    case 'saveTrade':
      await tradesCol(uid).doc(String(payload.trade.id)).set(payload.trade);
      return { ok: true };

    case 'saveAllTrades': { // dipakai import CSV — tulis banyak trade sekaligus
      const batch = firebase.firestore().batch();
      (payload.trades || []).forEach(t => batch.set(tradesCol(uid).doc(String(t.id)), t));
      await batch.commit();
      return { ok: true };
    }

    case 'deleteTrade':
      await tradesCol(uid).doc(String(payload.id)).delete();
      return { ok: true };

    case 'deleteAllTrades': {
      const snap = await tradesCol(uid).get();
      const batch = firebase.firestore().batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return { ok: true };
    }

    case 'saveKurs': {
      const cur = (await dataDoc(uid).get()).data() || {};
      const hist = [payload.kurs, ...(cur.kursHistory || [])];
      await dataDoc(uid).set({ kurs: payload.kurs.val, kursHistory: hist }, { merge: true });
      return { ok: true };
    }

    case 'savePairs':  await dataDoc(uid).set({ pairs: payload.pairs },   { merge: true }); return { ok: true };
    case 'saveSetups': await dataDoc(uid).set({ setups: payload.setups }, { merge: true }); return { ok: true };
    case 'saveAkuns':  await dataDoc(uid).set({ akuns: payload.akuns },   { merge: true }); return { ok: true };
    case 'saveRisk':   await dataDoc(uid).set({ risk: payload.risk },     { merge: true }); return { ok: true };

    case 'replaceAll': {
      const d = payload.data;
      const snap = await tradesCol(uid).get();
      const batch = firebase.firestore().batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      (d.trades || []).forEach(t => batch.set(tradesCol(uid).doc(String(t.id)), t));
      await batch.commit();
      await dataDoc(uid).set({
        kurs: d.kurs, kursHistory: d.kursHistory || [], pairs: d.pairs, setups: d.setups, akuns: d.akuns
      }, { merge: true });
      return { ok: true };
    }

    // ── ADMIN — diamankan ganda: cek role di sini (UX) + firestore.rules (keamanan asli) ──
    case 'getPendingUsers': {
      requireAdmin();
      const snap = await firebase.firestore().collection('users').where('status', '==', 'pending').get();
      return snap.docs.map(d => ({ email: d.data().email, name: d.data().name, picture: d.data().picture, daftar: fmtDate(d.data().daftar) }));
    }
    case 'getAllUsers': {
      requireAdmin();
      const snap = await firebase.firestore().collection('users').get();
      return snap.docs.map(d => ({
        email: d.data().email, name: d.data().name, picture: d.data().picture,
        role: d.data().role || 'member', status: d.data().status || 'pending',
        daftar: fmtDate(d.data().daftar), approve: fmtDate(d.data().approve)
      }));
    }
    case 'approveUser': {
      requireAdmin();
      const q = await firebase.firestore().collection('users').where('email', '==', payload.email).limit(1).get();
      if (q.empty) return { error: 'User tidak ditemukan' };
      await q.docs[0].ref.update({ status: 'active', approve: firebase.firestore.FieldValue.serverTimestamp() });
      return { ok: true, email: payload.email };
    }
    case 'rejectUser': {
      requireAdmin();
      const q = await firebase.firestore().collection('users').where('email', '==', payload.email).limit(1).get();
      if (q.empty) return { error: 'User tidak ditemukan' };
      await q.docs[0].ref.update({ status: 'rejected' });
      return { ok: true };
    }
    case 'setUserStatus': {
      requireAdmin();
      const q = await firebase.firestore().collection('users').where('email', '==', payload.email).limit(1).get();
      if (q.empty) return { error: 'User tidak ditemukan' };
      await q.docs[0].ref.update({ status: payload.status });
      return { ok: true };
    }

    default:
      return { error: 'Unknown action: ' + action };
  }
}

/** Fire-and-forget cloud sync dengan feedback pill (signature sama seperti versi lama) */
function cloudSync(action, payload, successMsg) {
  setCloudPill('saving');
  api(action, payload)
    .then(r => {
      if (r && r.error) { setCloudPill('err'); showToast('❌ Cloud: ' + r.error, 'error'); }
      else { setCloudPill('idle'); if (successMsg) showToast(successMsg); }
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

