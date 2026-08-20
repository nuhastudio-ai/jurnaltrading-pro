function showSettingsSec(id,el){ _applySec(id, el, true); }

function renderKursHistory(){document.getElementById('kursHistory').innerHTML=APP.kursHistory.map((k,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-bottom:1px solid var(--bdr);font-size:12px;"><span style="color:var(--txt2);">${k.date}</span><span style="font-family:var(--fn-m);font-weight:700;color:var(--c-gold);">Rp ${k.val.toLocaleString('id')}</span>${i===0?'<span style="background:var(--c-green-d);color:var(--c-green2);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">Aktif</span>':'<span></span>'}</div>`).join('');}
function saveKurs(){
  const val=parseInt(document.getElementById('kursInput').value)||0;
  if(!val)return showToast('❌ Masukkan nilai kurs yang valid','error');
  const tgl=document.getElementById('kursTgl').value;
  const dl=tgl?new Date(tgl).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  APP.kurs=val;APP.kursHistory.unshift({date:dl,val});
  document.getElementById('kursDisplay').textContent='Rp '+val.toLocaleString('id');
  const ds=document.getElementById('kursDisplaySettings');if(ds)ds.textContent='Rp '+val.toLocaleString('id');
  document.getElementById('kursInput').value=val;
  APP.trades.forEach(t=>t.pnlRp=Math.round(t.pnlUSD*APP.kurs));
  renderKursHistory();updateAll();
  showToast('💱 Kurs diperbarui: Rp '+val.toLocaleString('id'));
  cloudSync('saveKurs',{kurs:{date:dl,val}});
  checkKursDiff();
}

// ── LIVE KURS (Google Finance via Open Exchange Rates) ──────
let LIVE_KURS_VAL = null;

async function fetchLiveKurs() {
  const valEl = document.getElementById('liveKursVal');
  const dotEl = document.getElementById('liveKursDot');
  const refreshBtn = document.getElementById('liveKursRefreshBtn');
  const timeEl = document.getElementById('liveKursTime');
  if (!valEl) return;

  // Loading state
  valEl.textContent = 'Memuat...';
  valEl.style.color = 'var(--txt2)';
  valEl.style.fontSize = '12px';
  if (dotEl) { dotEl.className = 'live-kurs-src-dot loading'; }
  if (refreshBtn) refreshBtn.classList.add('spinning');
  LIVE_KURS_VAL = null;
  checkKursDiff();

  try {
    // Try primary source: open.er-api.com
    let rate = null;
    try {
      const r1 = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) });
      const d1 = await r1.json();
      if (d1.rates && d1.rates.IDR) rate = Math.round(d1.rates.IDR);
    } catch(e) {}

    // Fallback: exchangerate-api
    if (!rate) {
      const r2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(6000) });
      const d2 = await r2.json();
      if (d2.rates && d2.rates.IDR) rate = Math.round(d2.rates.IDR);
    }

    if (!rate) throw new Error('Data tidak tersedia');

    LIVE_KURS_VAL = rate;
    valEl.textContent = 'Rp ' + rate.toLocaleString('id');
    valEl.style.color = 'var(--c-gold)';
    valEl.style.fontSize = '14px';
    if (dotEl) { dotEl.className = 'live-kurs-src-dot'; }
    if (timeEl) { const now = new Date(); timeEl.textContent = 'Update: ' + now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
    checkKursDiff();
  } catch (e) {
    valEl.textContent = '⚠️ Gagal memuat';
    valEl.style.color = 'var(--c-red2)';
    valEl.style.fontSize = '11px';
    if (dotEl) dotEl.className = 'live-kurs-src-dot err';
    if (timeEl) timeEl.textContent = 'Coba refresh';
    LIVE_KURS_VAL = null;
    checkKursDiff();
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

function checkKursDiff() {
  const btn = document.getElementById('gunakanKursBtn');
  if (!btn) return;
  if (LIVE_KURS_VAL === null) {
    btn.disabled = true;
    btn.classList.remove('active');
    return;
  }
  const inputVal = parseInt(document.getElementById('kursInput').value) || 0;
  if (LIVE_KURS_VAL !== inputVal) {
    btn.disabled = false;
    btn.classList.add('active');
    btn.textContent = '⬅ Gunakan';
    btn.title = `Terapkan Rp ${LIVE_KURS_VAL.toLocaleString('id')} ke input kurs`;
  } else {
    btn.disabled = true;
    btn.classList.remove('active');
    btn.textContent = '✓ Sama';
  }
}

function gunakanLiveKurs() {
  if (LIVE_KURS_VAL === null) return;
  document.getElementById('kursInput').value = LIVE_KURS_VAL;
  checkKursDiff();
  showToast(`📈 Kurs live Rp ${LIVE_KURS_VAL.toLocaleString('id')} siap — klik Simpan untuk menyimpan!`, 'info');
}
function renderPairManager(){document.getElementById('pairManagerBody').innerHTML=APP.pairs.map((p,i)=>`<tr><td><span class="chip ${p.color}">${p.name}</span> <span style="font-size:10px;color:var(--txt2);">${p.desc||''}</span></td><td style="font-size:11px;color:var(--txt1);">${{forex:'Forex ×100k',commodity100:'Commodity ×100',commodity1000:'Commodity ×1k',jpy:'JPY ×1k',custom:'Custom'}[p.type]||p.type}</td><td class="td-m" style="color:var(--c-gold);">${p.mult.toLocaleString()}</td><td class="td-m" style="color:var(--c-cyan);">${p.pip}</td><td><span class="chip ${p.color}">${p.color.replace('chip-','')}</span></td><td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="openEditPairModal(${i})">✏️ Edit</button> <button class="btn btn-danger btn-sm" onclick="deletePair(${i})">🗑</button></td></tr>`).join('');}
function renderSetupTags(){document.getElementById('setupTags').innerHTML=APP.setups.map((s,i)=>`<div class="setup-tag">${s}<span class="setup-tag-x" onclick="deleteSetup(${i})">✕</span></div>`).join('');const jSel=document.getElementById('jFilterSetup');if(jSel)jSel.innerHTML=`<option value="">Semua Setup</option>`+APP.setups.map(s=>`<option>${s}</option>`).join('');const picker=document.getElementById('fm-setup-picker');if(picker)renderSetupPicker([]);}
function addSetup(){const val=document.getElementById('newSetupInput').value.trim();if(!val)return;if(APP.setups.includes(val))return showToast('❌ Setup sudah ada','error');APP.setups.push(val);document.getElementById('newSetupInput').value='';renderSetupTags();cloudSync('saveSetups',{setups:APP.setups},`✅ Setup "${val}" ditambahkan!`);}
function deleteSetup(idx){APP.setups.splice(idx,1);renderSetupTags();cloudSync('saveSetups',{setups:APP.setups});}
function renderAkunManager(){
  const active=APP.akuns.filter(a=>a.status!=='inactive');
  document.getElementById('akunManagerBody').innerHTML=active.map((a,_i)=>{
    const realIdx=APP.akuns.indexOf(a);
    const cur=a.currency||'IDR';const sym=currencySymbol(cur);
    const balVal=a.balance!==undefined?a.balance:(cur==='IDR'?a.modal:0);
    const balStr=sym+(cur==='IDR'?fmt(balVal):balVal.toFixed(2));
    return`<tr><td style="font-weight:700;color:${a.type==='live'?'var(--c-gold)':'#60a5fa'};">${a.name}</td><td style="color:var(--txt2);font-size:11px;">${a.broker}</td><td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${cur==='USD'?'rgba(34,211,238,.12)':cur==='USC'?'rgba(167,139,250,.12)':'rgba(245,197,24,.1)'};color:${cur==='USD'?'var(--c-cyan)':cur==='USC'?'var(--c-purple)':'var(--c-gold)'};">${sym} ${cur}</span></td><td class="td-m" style="color:var(--c-gold);">${balStr}</td><td class="td-m" style="color:var(--txt2);">Rp ${fmt(a.modal)}</td><td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${a.type==='live'?'var(--c-blue-d)':a.type==='demo'?'var(--c-purple-d)':'var(--c-green-d)'};color:${a.type==='live'?'#60a5fa':a.type==='demo'?'var(--c-purple)':'var(--c-green2)'};">${a.type.toUpperCase()}</span></td><td><span style="background:var(--c-green-d);color:var(--c-green2);padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;">✓ Aktif</span></td><td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="openEditAkunModal(${realIdx})">✏️ Edit</button> <button class="btn btn-danger btn-sm" onclick="deleteAkun(${realIdx})">🗑</button></td></tr>`;
  }).join('');
  renderArchivedAkuns();populateCtrlAkun();
}
function renderArchivedAkuns(){
  const archived=APP.akuns.filter(a=>a.status==='inactive');
  const countEl=document.getElementById('arsipCount');
  const tableEl=document.getElementById('arsipTable');
  const emptyEl=document.getElementById('arsipEmpty');
  const bodyEl=document.getElementById('arsipManagerBody');
  if(countEl)countEl.textContent=archived.length;
  if(!tableEl||!emptyEl||!bodyEl)return;
  if(archived.length===0){tableEl.style.display='none';emptyEl.style.display='block';return;}
  emptyEl.style.display='none';tableEl.style.display='table';
  bodyEl.innerHTML=archived.map((a,_i)=>{
    const realIdx=APP.akuns.indexOf(a);
    const cur=a.currency||'IDR';const sym=currencySymbol(cur);
    const balVal=a.balance!==undefined?a.balance:(cur==='IDR'?a.modal:0);
    const balStr=sym+(cur==='IDR'?fmt(balVal):balVal.toFixed(2));
    return`<tr style="opacity:.85;"><td style="font-weight:700;color:var(--c-purple);">${a.name} <span style="font-size:9px;font-weight:600;background:var(--c-purple-d);color:var(--c-purple);padding:1px 6px;border-radius:4px;margin-left:4px;">ARSIP</span></td><td style="color:var(--txt2);font-size:11px;">${a.broker}</td><td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${cur==='USD'?'rgba(34,211,238,.12)':cur==='USC'?'rgba(167,139,250,.12)':'rgba(245,197,24,.1)'};color:${cur==='USD'?'var(--c-cyan)':cur==='USC'?'var(--c-purple)':'var(--c-gold)'};">${sym} ${cur}</span></td><td class="td-m" style="color:var(--txt1);">${balStr}</td><td class="td-m" style="color:var(--txt2);">Rp ${fmt(a.modal)}</td><td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:${a.type==='live'?'var(--c-blue-d)':a.type==='demo'?'var(--c-purple-d)':'var(--c-green-d)'};color:${a.type==='live'?'#60a5fa':a.type==='demo'?'var(--c-purple)':'var(--c-green2)'};">${a.type.toUpperCase()}</span></td><td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="unarsipAkun(${realIdx})" title="Aktifkan kembali">♻️ Aktifkan</button> <button class="btn btn-danger btn-sm" onclick="deletePermanentArsip(${realIdx})">🗑</button></td></tr>`;
  }).join('');
}
function deletePermanentArsip(idx){
  // Reuse modal yang sama dengan flow step 2 langsung
  APP._deleteAkunIdx=idx;
  const a=APP.akuns[idx];
  document.getElementById('deleteAkunName').textContent=a.name;
  document.getElementById('deleteAkunBroker').textContent=a.broker+' · '+(a.type||'').toUpperCase();
  goToDelStep2();
  document.getElementById('deleteAkunModal').classList.add('active');
}
function populateCtrlAkun(){
  const activeAkuns=APP.akuns.filter(a=>a.status!=='inactive');
  const arsipAkuns=APP.akuns.filter(a=>a.status==='inactive');
  const visibleAkuns=APP.showArsip?APP.akuns:activeAkuns;
  const sel=document.getElementById('ctrlAkun');const cur=sel.value;
  sel.innerHTML=`<option value="all">Semua Akun</option>`+activeAkuns.map(a=>`<option value="${a.name}">${a.name}</option>`).join('')+(APP.showArsip&&arsipAkuns.length?arsipAkuns.map(a=>`<option value="${a.name}">${a.name} (arsip)</option>`).join(''):'');
  if(cur)sel.value=cur;
  const jSel=document.getElementById('jFilterAkun');
  if(jSel)jSel.innerHTML=`<option value="">Semua Akun</option>`+activeAkuns.map(a=>`<option value="${a.name}">${a.name}</option>`).join('')+(APP.showArsip&&arsipAkuns.length?arsipAkuns.map(a=>`<option value="${a.name}">${a.name} (arsip)</option>`).join(''):'');
  const jP=document.getElementById('jFilterPair');
  if(jP){const pairs=[...new Set(APP.trades.map(t=>t.pair))].sort();jP.innerHTML=`<option value="">Semua Pair</option>`+pairs.map(p=>`<option>${p}</option>`).join('');}
}

// EXPORT/IMPORT
function exportCSV(){const trades=getFilteredTrades();const rows=[['ID','Tanggal','Akun','Pair','TF','Arah','Lot','Entry','SL','TP','Exit','PnL USD','PnL Rp','Fee (Rp)','RR','Hasil','Setup','Catatan'],...trades.map(t=>[t.id,t.date,t.akun,t.pair,t.tf||'',t.dir,t.lot,t.entry,t.sl||'',t.tp||'',t.exit,t.pnlUSD,t.pnlRp,t.fee||0,t.rr||'',t.result,getSetupArr(t).join('|'),'"'+t.note+'"'])];const csv=rows.map(r=>r.join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jurnal-trading-'+new Date().toISOString().slice(0,10)+'.csv';a.click();showToast('📤 CSV berhasil di-export!');}
function exportJSON(){const data={version:'3.0',exported:new Date().toISOString(),kurs:APP.kurs,pairs:APP.pairs,setups:APP.setups,akuns:APP.akuns,trades:APP.trades};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='forex-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();showToast('📄 JSON backup berhasil!');}
function importData(input){const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onload=e=>{try{const data=JSON.parse(e.target.result);if(data.trades)APP.trades=data.trades;if(data.pairs)APP.pairs=data.pairs;if(data.setups)APP.setups=data.setups;if(data.akuns)APP.akuns=data.akuns;if(data.kurs)APP.kurs=data.kurs;if(data.kursHistory)APP.kursHistory=data.kursHistory;APP.trades.forEach(t=>{if(!t.pnlRp)t.pnlRp=Math.round(t.pnlUSD*APP.kurs);if(t.tp===undefined||t.tp===null)t.tp=0;});updateAll();renderSettings();showToast('✅ Data berhasil diimport! Menyinkronkan ke cloud...');
  // Push semua ke cloud
  setCloudPill('saving');
  api('replaceAll',{data:{trades:APP.trades,kurs:APP.kurs,kursHistory:APP.kursHistory,pairs:APP.pairs,setups:APP.setups,akuns:APP.akuns}})
    .then(r=>{setCloudPill('idle');showToast('☁️ Data berhasil disinkronkan ke cloud!');})
    .catch(e=>{setCloudPill('err');showToast('❌ Gagal sync ke cloud: '+e.message,'error');});
  }catch(err){showToast('❌ Format file tidak valid','error');}};reader.readAsText(file);}
function resetAllData(){if(!confirm('HAPUS SEMUA DATA? Tidak bisa dibatalkan!'))return;APP.trades=[];updateAll();showToast('🗑️ Semua data direset!','info');cloudSync('deleteAllTrades',{});}

// ── PARSE CSV LINE (handle quoted fields) ──────────────────────────
function parseCSVLine(line){
  const result=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else{cur+=c;}
  }
  result.push(cur.trim());
  return result;
}

// ── IMPORT CSV ─────────────────────────────────────────────────────
function importCSV(input){
  const file=input.files[0];if(!file)return;
  // Reset input agar file yang sama bisa dipilih lagi
  input.value='';
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const lines=e.target.result.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
      if(lines.length<2){showToast('❌ File CSV kosong atau tidak valid','error');return;}
      // Deteksi header (baris 1) — wajib ada kolom 'pair' atau 'id'
      const header=parseCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]/g,''));
      const colIdx={
        id:header.indexOf('id'),
        date:header.findIndex(h=>h.includes('tanggal')||h.includes('date')),
        akun:header.findIndex(h=>h.includes('akun')||h.includes('account')),
        pair:header.findIndex(h=>h.includes('pair')),
        tf:header.findIndex(h=>h==='tf'||h.includes('timeframe')),
        dir:header.findIndex(h=>h.includes('arah')||h.includes('dir')||h.includes('side')),
        lot:header.findIndex(h=>h.includes('lot')),
        entry:header.findIndex(h=>h.includes('entry')),
        sl:header.findIndex(h=>h==='sl'||h.includes('stoploss')||h.includes('stop')),
        tp:header.findIndex(h=>h==='tp'||h.includes('takeprofit')||h.includes('target')),
        exit:header.findIndex(h=>h==='exit'||h.includes('exittp')||h==='exittp'),
        pnlUSD:header.findIndex(h=>h.includes('pnlusd')||h.includes('pnl usd')||h.includes('usd')),
        pnlRp:header.findIndex(h=>h.includes('pnlrp')||h.includes('pnl rp')||h.includes('pnlrpiah')),
        fee:header.findIndex(h=>h.includes('fee')||h.includes('komisi')),
        rr:header.findIndex(h=>h==='rr'||h.includes('riskreward')),
        result:header.findIndex(h=>h.includes('hasil')||h.includes('result')),
        setup:header.findIndex(h=>h.includes('setup')),
        note:header.findIndex(h=>h.includes('catatan')||h.includes('note')||h.includes('komentar')),
      };
      const get=(cols,key,def='')=>colIdx[key]>=0?(cols[colIdx[key]]||def).replace(/^"|"$/g,'').trim():def;
      const newTrades=[];let skipped=0;
      const existingIds=new Set(APP.trades.map(t=>t.id));
      const maxId=APP.trades.length?Math.max(...APP.trades.map(t=>t.id)):0;
      let autoId=maxId;
      for(let i=1;i<lines.length;i++){
        if(!lines[i].trim())continue;
        const cols=parseCSVLine(lines[i]);
        if(cols.length<4){skipped++;continue;}
        const rawPair=get(cols,'pair');
        if(!rawPair){skipped++;continue;}
        // ID — buat baru jika tidak ada atau duplikat
        let id=parseInt(get(cols,'id'))||0;
        if(!id||isNaN(id)){autoId++;id=autoId;}
        const pnlUSD=parseFloat(get(cols,'pnlUSD'))||0;
        const pnlRp=parseInt(get(cols,'pnlRp'))||Math.round(pnlUSD*APP.kurs);
        const fee=parseInt(get(cols,'fee'))||0;
        const rr=parseFloat(get(cols,'rr'))||0;
        const rawResult=get(cols,'result').toUpperCase();
        const exitCSV=parseFloat(get(cols,'exit'))||0;
        const result=['WIN','LOSS','BE','OPEN'].includes(rawResult)?rawResult:(!exitCSV?'OPEN':pnlRp>0?'WIN':pnlRp<0?'LOSS':'BE');
        const rawDir=get(cols,'dir').toUpperCase();
        const dir=['BUY','SELL'].includes(rawDir)?rawDir:'BUY';
        const trade={
          id,
          date:get(cols,'date')||new Date().toISOString().slice(0,16),
          akun:get(cols,'akun')||APP.akuns[0]?.name||'Default',
          pair:rawPair.toUpperCase(),
          tf:get(cols,'tf')||'',
          dir,
          lot:parseFloat(get(cols,'lot'))||0.01,
          entry:parseFloat(get(cols,'entry'))||0,
          sl:parseFloat(get(cols,'sl'))||0,
          tp:parseFloat(get(cols,'tp'))||0,
          exit:parseFloat(get(cols,'exit'))||0,
          pnlUSD,pnlRp,fee,rr,result,
          setup:get(cols,'setup',''),
          note:get(cols,'note',''),
        };
        // Jika ID sudah ada → update, jika baru → tambah
        if(existingIds.has(id)){
          const idx=APP.trades.findIndex(t=>t.id===id);
          if(idx>-1)APP.trades[idx]=trade;
        }else{
          newTrades.push(trade);
          existingIds.add(id);
        }
      }
      APP.trades.push(...newTrades);
      APP.trades.sort((a,b)=>b.id-a.id);
      APP.trades.forEach(t=>{if(!t.pnlRp)t.pnlRp=Math.round(t.pnlUSD*APP.kurs);});
      updateAll();renderSettings();
      const updated=lines.length-1-newTrades.length-skipped;
      showToast(`✅ CSV diimport: ${newTrades.length} trade baru${updated>0?', '+updated+' diperbarui':''}${skipped?' ('+skipped+' dilewati)':''}`);
      // Sync ke cloud
      setCloudPill('saving');
      cloudSync('saveAllTrades',{trades:APP.trades}).catch(()=>setCloudPill('err'));
    }catch(err){
      showToast('❌ Gagal import CSV: '+err.message,'error');
    }
  };
  reader.readAsText(file);
}
