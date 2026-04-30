// ============================================================
//  FOREX JOURNAL PRO — Google Apps Script Backend v3.0
//  Koneksikan HTML Dashboard dengan Google Spreadsheet
//
//  CARA DEPLOY:
//  1. Buka https://script.google.com
//  2. Buat project baru → paste seluruh kode ini
//  3. Ganti SHEET_ID di bawah dengan ID spreadsheet Anda
//  4. Klik Deploy → New Deployment
//     - Type: Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  5. Copy URL deployment → tempel ke GAS_URL di HTML
// ============================================================

const SHEET_ID = '1LiA3hIK8Y3FRJLNcf68hZd5ru0rrjU1Aq51p28siiHc'; // ← GANTI INI

// ─── Nama Sheet / Tab ─────────────────────────────────────
const SH = {
  JURNAL : 'JURNAL',
  KURS   : 'KURS',
  PAIRS  : 'PAIRS',
  SETUPS : 'SETUPS',
  AKUN   : 'AKUN'
};

// ─── Header Kolom ─────────────────────────────────────────
const HEADERS = {
  JURNAL  : ['ID','Tanggal','Akun','Pair','Arah','Lot','Entry','SL','Exit/TP','PnL USD','PnL Rp','Fee (Rp)','RR','Hasil','Setup','Catatan'],
  KURS    : ['Tanggal','Nilai'],
  PAIRS   : ['Nama','Tipe','Multiplier','Pip','Warna','Deskripsi'],
  SETUPS  : ['Nama'],
  AKUN    : ['Nama','Broker','Modal','Tipe']
};

// ─── Style header warna tema dashboard ────────────────────
const HEADER_STYLE = { bg: '#0f1628', fg: '#f0f4ff', bold: true };

// ══════════════════════════════════════════════════════════
//  ENTRY POINTS
// ══════════════════════════════════════════════════════════

function doGet(e) {
  return respond(getAllData());
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let result;
    switch (req.action) {
      case 'getAll'          : result = getAllData();              break;
      case 'saveTrade'       : result = saveTrade(req.trade);     break;
      case 'deleteTrade'     : result = deleteTrade(req.id);      break;
      case 'deleteAllTrades' : result = deleteAllTrades();        break;
      case 'saveKurs'        : result = saveKurs(req.kurs);       break;
      case 'savePairs'       : result = savePairs(req.pairs);     break;
      case 'saveSetups'      : result = saveSetups(req.setups);   break;
      case 'saveAkuns'       : result = saveAkuns(req.akuns);     break;
      case 'replaceAll'      : result = replaceAll(req.data);     break;
      default                : result = { error: 'Unknown action: ' + req.action };
    }
    return respond(result);
  } catch (err) {
    Logger.log('ERROR: ' + err.toString());
    return respond({ error: err.toString() });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════
//  SHEET HELPER
// ══════════════════════════════════════════════════════════

function getSS() {
  return SpreadsheetApp.openById(SHEET_ID);
}

/**
 * Ambil sheet, buat jika belum ada, pastikan header ada.
 */
function getOrCreateSheet(name, headers) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
    Logger.log('Sheet "' + name + '" dibuat baru.');
  }

  // Cek apakah header sudah ada
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    // Style header
    const hdr = sh.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight(HEADER_STYLE.bold ? 'bold' : 'normal');
    hdr.setBackground(HEADER_STYLE.bg);
    hdr.setFontColor(HEADER_STYLE.fg);
    sh.setFrozenRows(1);
    Logger.log('Header sheet "' + name + '" dibuat.');
  }

  return sh;
}

/**
 * Inisialisasi semua sheet sekaligus (auto-create jika belum ada).
 */
function initSheets() {
  Object.keys(SH).forEach(key => getOrCreateSheet(SH[key], HEADERS[key]));
}

/**
 * Format nilai tanggal dari Google Sheets ke string ISO "YYYY-MM-DDTHH:mm".
 * Google Sheets mengembalikan sel tanggal sebagai Date object (bukan string),
 * sehingga String() langsung akan menghasilkan format yang tidak bisa dibaca
 * oleh datetime-local input maupun slice(0,10) di frontend.
 */
function formatDateForApp(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    // Gunakan timezone script, bukan UTC, agar jam lokal tetap benar
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  }
  const s = String(val).trim();
  if (!s || s === 'undefined') return '';
  return s;
}

/**
 * Konversi rows spreadsheet → array of objects.
 */
function sheetToObjects(sh) {
  if (!sh || sh.getLastRow() <= 1) return [];
  const vals    = sh.getDataRange().getValues();
  const headers = vals[0].map(String);
  return vals.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/**
 * Hapus semua baris data (baris ke-2 dst), pertahankan header.
 */
function clearDataRows(sh) {
  const last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}

// ══════════════════════════════════════════════════════════
//  READ ALL — dipanggil saat app pertama kali load
// ══════════════════════════════════════════════════════════

function getAllData() {
  initSheets(); // Auto-buat sheet jika belum ada
  const ss = getSS();

  // ── JURNAL ──────────────────────────────────────────────
  const jSh = ss.getSheetByName(SH.JURNAL);
  const trades = sheetToObjects(jSh).map(r => ({
    id     : parseInt(r['ID'])             || 0,
    date   : formatDateForApp(r['Tanggal']),
    akun   : String(r['Akun'])             || '',
    pair   : String(r['Pair'])             || '',
    dir    : String(r['Arah'])             || 'BUY',
    lot    : parseFloat(r['Lot'])          || 0,
    entry  : parseFloat(r['Entry'])        || 0,
    sl     : parseFloat(r['SL'])           || 0,
    exit   : parseFloat(r['Exit/TP'])      || 0,
    pnlUSD : parseFloat(r['PnL USD'])      || 0,
    pnlRp  : parseInt(r['PnL Rp'])         || 0,
    fee    : parseInt(r['Fee (Rp)'])       || 0,
    rr     : parseFloat(r['RR'])           || 0,
    result : String(r['Hasil'])            || 'WIN',
    setup  : String(r['Setup'])            || '',
    note   : String(r['Catatan'])          || ''
  })).filter(t => t.id > 0).reverse(); // newest first

  // ── KURS ────────────────────────────────────────────────
  const kSh = ss.getSheetByName(SH.KURS);
  const kursHistory = sheetToObjects(kSh)
    .map(r => ({
      date : String(r['Tanggal']),
      val  : parseInt(r['Nilai']) || 0
    }))
    .filter(k => k.val > 0)
    .reverse(); // newest first
  const kurs = kursHistory.length ? kursHistory[0].val : 17223;

  // ── PAIRS ────────────────────────────────────────────────
  const pSh = ss.getSheetByName(SH.PAIRS);
  const pairs = sheetToObjects(pSh).map(r => ({
    name  : String(r['Nama']),
    type  : String(r['Tipe']),
    mult  : parseFloat(r['Multiplier']) || 1,
    pip   : parseFloat(r['Pip'])        || 0.0001,
    color : String(r['Warna']),
    desc  : String(r['Deskripsi'])      || ''
  })).filter(p => p.name && p.name !== 'undefined');

  // ── SETUPS ───────────────────────────────────────────────
  const sSh = ss.getSheetByName(SH.SETUPS);
  const setups = sheetToObjects(sSh)
    .map(r => String(r['Nama']))
    .filter(s => s && s !== 'undefined');

  // ── AKUN ─────────────────────────────────────────────────
  const aSh = ss.getSheetByName(SH.AKUN);
  const akuns = sheetToObjects(aSh).map(r => ({
    name   : String(r['Nama']),
    broker : String(r['Broker']),
    modal  : parseInt(r['Modal']) || 0,
    type   : String(r['Tipe']),
    status : true
  })).filter(a => a.name && a.name !== 'undefined');

  return { ok: true, trades, kurs, kursHistory, pairs, setups, akuns };
}

// ══════════════════════════════════════════════════════════
//  TRADE OPERATIONS
// ══════════════════════════════════════════════════════════

function saveTrade(trade) {
  const sh   = getOrCreateSheet(SH.JURNAL, HEADERS.JURNAL);
  const last = sh.getLastRow();
  const data = last > 0 ? sh.getDataRange().getValues() : [HEADERS.JURNAL];

  const row = [
    parseInt(trade.id),
    trade.date,
    trade.akun,
    trade.pair,
    trade.dir,
    parseFloat(trade.lot)       || 0,
    parseFloat(trade.entry)     || 0,
    parseFloat(trade.sl)        || 0,
    parseFloat(trade.exit)      || 0,
    parseFloat(trade.pnlUSD)    || 0,
    parseInt(trade.pnlRp)       || 0,
    parseInt(trade.fee)         || 0,
    parseFloat(trade.rr)        || 0,
    trade.result,
    trade.setup,
    trade.note || ''
  ];

  // Cek apakah trade sudah ada (update)
  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === parseInt(trade.id)) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true, action: 'updated', id: trade.id };
    }
  }

  // Baru: tambahkan di baris baru
  sh.appendRow(row);
  return { ok: true, action: 'added', id: trade.id };
}

function deleteTrade(id) {
  const sh   = getOrCreateSheet(SH.JURNAL, HEADERS.JURNAL);
  const last = sh.getLastRow();
  if (last <= 1) return { ok: true, note: 'Sheet kosong' };

  const data = sh.getDataRange().getValues();
  // Iterasi dari bawah supaya index tidak geser saat delete
  for (let i = data.length - 1; i >= 1; i--) {
    if (parseInt(data[i][0]) === parseInt(id)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Trade #' + id + ' tidak ditemukan' };
}

function deleteAllTrades() {
  const sh = getOrCreateSheet(SH.JURNAL, HEADERS.JURNAL);
  clearDataRows(sh);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════
//  KURS OPERATIONS
// ══════════════════════════════════════════════════════════

function saveKurs(kurs) {
  const sh = getOrCreateSheet(SH.KURS, HEADERS.KURS);
  sh.appendRow([kurs.date, parseInt(kurs.val)]);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════
//  SETTINGS OPERATIONS (replace-all approach)
// ══════════════════════════════════════════════════════════

function savePairs(pairs) {
  const sh = getOrCreateSheet(SH.PAIRS, HEADERS.PAIRS);
  clearDataRows(sh);
  if (pairs && pairs.length > 0) {
    sh.getRange(2, 1, pairs.length, 6).setValues(
      pairs.map(p => [
        p.name,
        p.type,
        parseFloat(p.mult)  || 1,
        parseFloat(p.pip)   || 0.0001,
        p.color,
        p.desc || ''
      ])
    );
  }
  return { ok: true };
}

function saveSetups(setups) {
  const sh = getOrCreateSheet(SH.SETUPS, HEADERS.SETUPS);
  clearDataRows(sh);
  if (setups && setups.length > 0) {
    sh.getRange(2, 1, setups.length, 1).setValues(setups.map(s => [s]));
  }
  return { ok: true };
}

function saveAkuns(akuns) {
  const sh = getOrCreateSheet(SH.AKUN, HEADERS.AKUN);
  clearDataRows(sh);
  if (akuns && akuns.length > 0) {
    sh.getRange(2, 1, akuns.length, 4).setValues(
      akuns.map(a => [
        a.name,
        a.broker,
        parseInt(a.modal) || 0,
        a.type
      ])
    );
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════════════
//  IMPORT / REPLACE ALL (untuk fitur Import JSON)
// ══════════════════════════════════════════════════════════

function replaceAll(data) {
  initSheets();

  // Trades
  if (data.trades) {
    deleteAllTrades();
    // Simpan dari yang terlama supaya urutan di sheet benar
    const sorted = data.trades.slice().sort((a, b) => a.id - b.id);
    sorted.forEach(t => saveTrade(t));
  }

  // Kurs History
  if (data.kurs || data.kursHistory) {
    const sh = getOrCreateSheet(SH.KURS, HEADERS.KURS);
    clearDataRows(sh);
    const history = data.kursHistory && data.kursHistory.length
      ? data.kursHistory.slice().reverse() // oldest first ke sheet
      : [{ date: new Date().toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}), val: data.kurs || 17223 }];
    history.forEach(k => sh.appendRow([k.date, parseInt(k.val)]));
  }

  if (data.pairs)  savePairs(data.pairs);
  if (data.setups) saveSetups(data.setups);
  if (data.akuns)  saveAkuns(data.akuns);

  return { ok: true, message: 'Semua data berhasil di-replace' };
}