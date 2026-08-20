

// ══════════════════════════════════════════════════════════
//  DATE NORMALIZER — pastikan t.date selalu dalam format ISO
//  "YYYY-MM-DDTHH:MM" yang kompatibel dengan datetime-local input
// ══════════════════════════════════════════════════════════

/**
 * Normalkan berbagai format tanggal ke "YYYY-MM-DDTHH:MM".
 * Diperlukan karena Google Sheets kadang mengirim tanggal sebagai:
 *   - Date object yang di-String() → "Mon Jan 15 2024 08:30:00 GMT+0700..."
 *   - ISO string "2024-01-15T08:30"
 *   - String tanpa jam "2024-01-15"
 */
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === 'undefined') return '';
  // Sudah format ISO YYYY-MM-DD... → kembalikan langsung
  if (/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) return String(dateStr);
  // Parse sebagai Date object, lalu format ulang ke local time
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format tanggal ISO ke string tampilan "DD Mon YYYY HH:MM"
 * untuk ditampilkan di modal detail & tabel jurnal.
 */
function formatDateDisplay(dateStr) {
  const d = new Date(normalizeDate(dateStr));
  if (isNaN(d.getTime())) return dateStr || '—';
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format tanggal ISO ke "YYYY-MM-DDTHH:MM" yang diterima oleh
 * input[type=datetime-local].
 */
function dateToInputVal(dateStr) {
  const n = normalizeDate(dateStr);
  return n ? n.slice(0, 16) : '';
}

// ══════════════════════════════════════════════════════════
//  CLOUD-FIRST INIT (menggantikan localStorage)
// ══════════════════════════════════════════════════════════

/**
 * Terapkan data yang diterima dari cloud ke APP state,
 * lalu render semua komponen.
 */
function applyCloudData(data) {
  if (data.trades       && Array.isArray(data.trades))                          APP.trades       = data.trades;
  if (data.pairs        && Array.isArray(data.pairs)   && data.pairs.length)    APP.pairs        = data.pairs;
  if (data.setups       && Array.isArray(data.setups)  && data.setups.length)   APP.setups       = data.setups;
  if (data.akuns        && Array.isArray(data.akuns)   && data.akuns.length)    APP.akuns        = data.akuns;
  if (data.kurs         && parseInt(data.kurs) > 0)                             APP.kurs         = parseInt(data.kurs);
  if (data.kursHistory  && Array.isArray(data.kursHistory))                     APP.kursHistory  = data.kursHistory;
  if (data.risk         && typeof data.risk === 'object')                        APP.risk         = { ...APP.risk, ...data.risk };

  // Normalisasi tanggal & pastikan pnlRp selalu terhitung
  APP.trades.forEach(t => {
    t.date  = normalizeDate(t.date);
    if (!t.pnlRp) t.pnlRp = Math.round(t.pnlUSD * APP.kurs);
    if (t.tp === undefined || t.tp === null) t.tp = 0;
  });
  // Normalisasi field baru akun (currency & balance)
  APP.akuns.forEach(a => {
    if (!a.currency) a.currency = 'IDR';
    if (a.balance === undefined || a.balance === null) a.balance = a.modal || 0;
  });
}

/**
 * Render Settings section: kurs display, kurs history, pair manager,
 * setup tags, akun manager.
 */
function renderSettings() {
  document.getElementById('kursDisplay').textContent = 'Rp ' + APP.kurs.toLocaleString('id');
  document.getElementById('kursInput').value = APP.kurs;
  const ds=document.getElementById('kursDisplaySettings');if(ds)ds.textContent='Rp '+APP.kurs.toLocaleString('id');
  // Risk Management Rules
  const r = APP.risk;
  document.getElementById('maxDailyLoss').value  = r.maxDailyLoss  ?? 500000;
  document.getElementById('maxTradeLoss').value  = r.maxTradeLoss  ?? 200000;
  document.getElementById('maxTrades').value     = r.maxTrades     ?? 10;
  renderKursHistory();
  renderPairManager();
  renderSetupTags();
  renderAkunManager();
  renderArchivedAkuns();
  if (LIVE_KURS_VAL === null) fetchLiveKurs();
  else checkKursDiff();
}

// MISC helpers (tidak berubah)
function saveRiskRules(){
  const maxDailyLoss = parseInt(document.getElementById('maxDailyLoss').value) || 500000;
  const maxTradeLoss = parseInt(document.getElementById('maxTradeLoss').value) || 200000;
  const maxTrades    = parseInt(document.getElementById('maxTrades').value)    || 10;
  APP.risk = { maxDailyLoss, maxTradeLoss, maxTrades };
  cloudSync('saveRisk', { risk: APP.risk }, '✅ Risk rules disimpan ke cloud!');
}
