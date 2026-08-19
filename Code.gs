// ============================================================
//  FOREX JOURNAL PRO — Google Apps Script Backend v3.2
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
  AKUN   : 'AKUN',
  RISK   : 'RISK'
};

// ─── Header Kolom ─────────────────────────────────────────
// JURNAL v3.1: EXIT dan TP dipisah
// JURNAL v3.3: tambah kolom TF (Timeframe) di akhir — posisi ditaruh di akhir
//              supaya migrasi kolom baru (auto-append) tidak menggeser data lama
// AKUN   v3.2: tambah Currency dan Balance
const HEADERS = {
  JURNAL  : ['ID','Tanggal','Akun','Pair','Arah','Lot','Entry','SL','TP','Exit','PnL USD','PnL Rp','Fee (Rp)','RR','Hasil','Setup','Catatan','TF'],
  KURS    : ['Tanggal','Nilai'],
  PAIRS   : ['Nama','Tipe','Multiplier','Pip','Warna','Deskripsi'],
  SETUPS  : ['Nama'],
  AKUN    : ['Nama','Broker','Currency','Balance','Modal','Tipe','Status'],
  RISK    : ['Key','Value']
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
      case 'saveRisk'        : result = saveRisk(req.risk);       break;
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
 * MIGRASI SCHEMA JURNAL v3.0 → v3.1
 * Kolom 'Exit/TP' → TP + Exit
 */
function migrateJurnalSchema(sh) {
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const exitTpIdx = headerRow.indexOf('Exit/TP');
  if (exitTpIdx === -1) {
    Logger.log('migrateJurnalSchema: Tidak ditemukan kolom "Exit/TP" — sudah termigrasi.');
    return;
  }
  const exitTpCol = exitTpIdx + 1;
  sh.insertColumnBefore(exitTpCol);
  const tpHeaderCell = sh.getRange(1, exitTpCol);
  tpHeaderCell.setValue('TP'); // TP = Rencana Take Profit
  tpHeaderCell.setFontWeight('bold');
  tpHeaderCell.setBackground(HEADER_STYLE.bg);
  tpHeaderCell.setFontColor(HEADER_STYLE.fg);
  sh.getRange(1, exitTpCol + 1).setValue('Exit');
  Logger.log('migrateJurnalSchema: Berhasil! Kolom TP ditambahkan.');
}

/**
 * MIGRASI SCHEMA AKUN v3.1 → v3.2
 *
 * Schema lama : ['Nama','Broker','Modal','Tipe','Status']
 * Schema baru : ['Nama','Broker','Currency','Balance','Modal','Tipe','Status']
 *
 * Langkah migrasi:
 * 1. Cek apakah kolom 'Currency' sudah ada → sudah migrasi, skip
 * 2. Cek apakah kolom ke-3 adalah 'Modal' (schema lama) → lakukan migrasi
 *    - Insert 2 kolom baru sebelum kolom 'Modal' (kolom 3)
 *    - Set header 'Currency' di kolom 3, 'Balance' di kolom 4
 *    - Isi default: Currency = 'IDR', Balance = nilai Modal lama
 *    - Kolom Modal (sekarang kolom 5) tetap berisi nilai aslinya
 */
function migrateAkunSchema(sh) {
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;

  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  // Sudah ada 'Currency' → schema baru, tidak perlu migrasi
  if (headerRow.indexOf('Currency') !== -1) {
    Logger.log('migrateAkunSchema: Schema AKUN sudah v3.2 — tidak perlu migrasi.');
    return;
  }

  // Cek schema lama: kolom ke-3 (index 2) adalah 'Modal'
  const modalOldIdx = headerRow.indexOf('Modal');
  if (modalOldIdx === -1) {
    Logger.log('migrateAkunSchema: Kolom "Modal" tidak ditemukan — schema tidak dikenali, skip.');
    return;
  }

  const modalOldCol = modalOldIdx + 1; // 1-based

  // Baca semua data sebelum insert kolom (untuk isi default Balance)
  const lastRow = sh.getLastRow();

  // Insert 2 kolom baru sebelum kolom Modal
  sh.insertColumnsBefore(modalOldCol, 2);

  // Set header Currency (kolom modalOldCol) dan Balance (kolom modalOldCol+1)
  const currencyHdr = sh.getRange(1, modalOldCol);
  currencyHdr.setValue('Currency');
  currencyHdr.setFontWeight('bold');
  currencyHdr.setBackground(HEADER_STYLE.bg);
  currencyHdr.setFontColor(HEADER_STYLE.fg);

  const balanceHdr = sh.getRange(1, modalOldCol + 1);
  balanceHdr.setValue('Balance');
  balanceHdr.setFontWeight('bold');
  balanceHdr.setBackground(HEADER_STYLE.bg);
  balanceHdr.setFontColor(HEADER_STYLE.fg);

  // Isi data default untuk setiap baris data (baris ke-2 dst)
  // Currency = 'IDR', Balance = nilai Modal (kolom Modal sekarang bergeser ke modalOldCol+2)
  if (lastRow > 1) {
    const modalNewCol = modalOldCol + 2; // Modal sekarang ada di kolom ini setelah insert 2 kolom
    for (let row = 2; row <= lastRow; row++) {
      const rowData = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
      // Pastikan baris tidak kosong
      if (rowData.some(cell => cell !== '' && cell !== null && cell !== undefined)) {
        const modalVal = sh.getRange(row, modalNewCol).getValue();
        sh.getRange(row, modalOldCol).setValue('IDR');      // Currency default = IDR
        sh.getRange(row, modalOldCol + 1).setValue(modalVal); // Balance = Modal lama
      }
    }
  }

  Logger.log('migrateAkunSchema: Berhasil! Kolom Currency & Balance ditambahkan. Data lama: Currency=IDR, Balance=Modal.');
}

/**
 * Ambil sheet, buat jika belum ada, pastikan header ada.
 * Kolom header baru yang belum ada di sheet lama (mis. 'TF') akan otomatis
 * ditambahkan di kolom paling akhir, supaya posisi kolom data lama tidak bergeser.
 */
function getOrCreateSheet(name, headers) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
    Logger.log('Sheet "' + name + '" dibuat baru.');
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    const hdr = sh.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight(HEADER_STYLE.bold ? 'bold' : 'normal');
    hdr.setBackground(HEADER_STYLE.bg);
    hdr.setFontColor(HEADER_STYLE.fg);
    sh.setFrozenRows(1);
    Logger.log('Header sheet "' + name + '" dibuat.');
  } else {
    const existingCols = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (existingCols.length < headers.length) {
      const missingHeaders = headers.slice(existingCols.length);
      const startCol = existingCols.length + 1;
      const newHdr = sh.getRange(1, startCol, 1, missingHeaders.length);
      newHdr.setValues([missingHeaders]);
      newHdr.setFontWeight(HEADER_STYLE.bold ? 'bold' : 'normal');
      newHdr.setBackground(HEADER_STYLE.bg);
      newHdr.setFontColor(HEADER_STYLE.fg);
      Logger.log('Header "' + missingHeaders.join(',') + '" ditambahkan ke sheet "' + name + '".');
    }
  }

  return sh;
}

/**
 * Inisialisasi semua sheet + jalankan migrasi schema.
 */
function initSheets() {
  const ss = getSS();

  // ── Migrasi JURNAL v3.0 → v3.1 (Exit/TP → TP + Exit) ──
  const jShExisting = ss.getSheetByName(SH.JURNAL);
  if (jShExisting) migrateJurnalSchema(jShExisting);

  // ── Migrasi AKUN v3.1 → v3.2 (tambah Currency & Balance) ──
  const aShExisting = ss.getSheetByName(SH.AKUN);
  if (aShExisting) migrateAkunSchema(aShExisting);

  // ── Pastikan semua sheet ada & header lengkap (termasuk auto-tambah kolom TF) ──
  Object.keys(SH).forEach(key => getOrCreateSheet(SH[key], HEADERS[key]));
}

/**
 * Format nilai tanggal dari Google Sheets ke string ISO "YYYY-MM-DDTHH:mm".
 */
function formatDateForApp(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
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
  initSheets(); // Auto-buat sheet & jalankan migrasi schema jika diperlukan
  const ss = getSS();

  // ── JURNAL ──────────────────────────────────────────────
  const jSh = ss.getSheetByName(SH.JURNAL);
  const trades = sheetToObjects(jSh).map(r => ({
    id     : parseInt(r['ID'])             || 0,
    date   : formatDateForApp(r['Tanggal']),
    akun   : String(r['Akun'])             || '',
    pair   : String(r['Pair'])             || '',
    tf     : String(r['TF'] || ''),
    dir    : String(r['Arah'])             || 'BUY',
    lot    : parseFloat(r['Lot'])          || 0,
    entry  : parseFloat(r['Entry'])        || 0,
    sl     : parseFloat(r['SL'])           || 0,
    tp     : parseFloat(r['TP'])           || 0,  // TP = Rencana Take Profit
    exit   : parseFloat(r['Exit'])         || 0,  // Exit = harga keluar aktual, dasar RR jika terisi
    pnlUSD : parseFloat(r['PnL USD'])      || 0,
    pnlRp  : parseInt(r['PnL Rp'])         || 0,
    fee    : parseInt(r['Fee (Rp)'])       || 0,
    rr     : parseFloat(r['RR'])           || 0,  // dihitung di client: pakai Exit jika ada, kalau tidak pakai TP
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
    .reverse();
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

  // ── AKUN v3.2 ────────────────────────────────────────────
  // Schema baru: Nama, Broker, Currency, Balance, Modal, Tipe, Status
  const aSh = ss.getSheetByName(SH.AKUN);
  const akunRaw = (aSh && aSh.getLastRow() > 1)
    ? sheetToObjects(aSh) : [];
  const akuns = akunRaw
    .filter(r => r['Nama'] && String(r['Nama']).trim() !== '' && String(r['Nama']) !== 'undefined')
    .map(r => ({
      name     : String(r['Nama']     || ''),
      broker   : String(r['Broker']   || ''),
      currency : String(r['Currency'] || 'IDR'),      // ← baru
      balance  : parseFloat(r['Balance']) || 0,       // ← baru
      modal    : parseInt(r['Modal'])    || 0,
      type     : String(r['Tipe']     || ''),
      status   : (r['Status'] && String(r['Status']).toLowerCase() === 'inactive') ? 'inactive' : 'active'
    }));

  // ── RISK ─────────────────────────────────────────────────
  const rSh = ss.getSheetByName(SH.RISK);
  const riskRows = sheetToObjects(rSh);
  const riskMap  = {};
  riskRows.forEach(r => { if (r['Key']) riskMap[String(r['Key'])] = r['Value']; });
  const risk = {
    maxDailyLoss : parseInt(riskMap['maxDailyLoss'])  || 500000,
    maxTradeLoss : parseInt(riskMap['maxTradeLoss'])  || 200000,
    maxTrades    : parseInt(riskMap['maxTrades'])     || 10
  };

  return { ok: true, trades, kurs, kursHistory, pairs, setups, akuns, risk };
}

// ══════════════════════════════════════════════════════════
//  TRADE OPERATIONS
// ══════════════════════════════════════════════════════════

function saveTrade(trade) {
  const sh   = getOrCreateSheet(SH.JURNAL, HEADERS.JURNAL);
  const last = sh.getLastRow();
  const data = last > 0 ? sh.getDataRange().getValues() : [HEADERS.JURNAL];

  // RR (trade.rr) sudah dihitung di client: pakai Exit jika diisi, kalau kosong pakai TP (rencana)
  const row = [
    parseInt(trade.id),
    trade.date,
    trade.akun,
    trade.pair,
    trade.dir,
    parseFloat(trade.lot)       || 0,
    parseFloat(trade.entry)     || 0,
    parseFloat(trade.sl)        || 0,
    parseFloat(trade.tp)        || 0,
    parseFloat(trade.exit)      || 0,
    parseFloat(trade.pnlUSD)    || 0,
    parseInt(trade.pnlRp)       || 0,
    parseInt(trade.fee)         || 0,
    parseFloat(trade.rr)        || 0,
    trade.result,
    Array.isArray(trade.setup) ? trade.setup.filter(Boolean).join(', ') : (trade.setup || ''),
    trade.note || '',
    trade.tf || ''
  ];

  for (let i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === parseInt(trade.id)) {
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { ok: true, action: 'updated', id: trade.id };
    }
  }

  sh.appendRow(row);
  return { ok: true, action: 'added', id: trade.id };
}

function deleteTrade(id) {
  const sh   = getOrCreateSheet(SH.JURNAL, HEADERS.JURNAL);
  const last = sh.getLastRow();
  if (last <= 1) return { ok: true, note: 'Sheet kosong' };

  const data = sh.getDataRange().getValues();
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

/**
 * Save akuns v3.2 — schema baru: Nama, Broker, Currency, Balance, Modal, Tipe, Status
 */
function saveAkuns(akuns) {
  const sh = getOrCreateSheet(SH.AKUN, HEADERS.AKUN);
  clearDataRows(sh);
  if (akuns && akuns.length > 0) {
    sh.getRange(2, 1, akuns.length, 7).setValues(
      akuns.map(a => [
        a.name,
        a.broker,
        a.currency  || 'IDR',           // ← baru
        parseFloat(a.balance) || 0,     // ← baru
        parseInt(a.modal)   || 0,
        a.type,
        a.status === 'inactive' ? 'inactive' : 'active'
      ])
    );
  }
  return { ok: true };
}

function saveRisk(risk) {
  const sh = getOrCreateSheet(SH.RISK, HEADERS.RISK);
  clearDataRows(sh);
  const rows = [
    ['maxDailyLoss', parseInt(risk.maxDailyLoss) || 500000],
    ['maxTradeLoss', parseInt(risk.maxTradeLoss) || 200000],
    ['maxTrades',    parseInt(risk.maxTrades)    || 10]
  ];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════
//  IMPORT / REPLACE ALL (untuk fitur Import JSON)
// ══════════════════════════════════════════════════════════

function replaceAll(data) {
  initSheets();

  if (data.trades) {
    deleteAllTrades();
    const sorted = data.trades.slice().sort((a, b) => a.id - b.id);
    sorted.forEach(t => saveTrade(t));
  }

  if (data.kurs || data.kursHistory) {
    const sh = getOrCreateSheet(SH.KURS, HEADERS.KURS);
    clearDataRows(sh);
    const history = data.kursHistory && data.kursHistory.length
      ? data.kursHistory.slice().reverse()
      : [{ date: new Date().toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}), val: data.kurs || 17223 }];
    history.forEach(k => sh.appendRow([k.date, parseInt(k.val)]));
  }

  if (data.pairs)  savePairs(data.pairs);
  if (data.setups) saveSetups(data.setups);
  if (data.akuns)  saveAkuns(data.akuns);
  if (data.risk)   saveRisk(data.risk);

  return { ok: true, message: 'Semua data berhasil di-replace' };
}