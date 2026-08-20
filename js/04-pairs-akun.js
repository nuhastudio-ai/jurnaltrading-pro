function openAddPairModal(){
  APP.editPairIdx=null;
  document.getElementById('pairModalTitle').textContent='🔧 Tambah Pair Baru';
  ['pm-name','pm-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pm-type').value='forex';
  document.getElementById('pm-mult').value=100000;
  document.getElementById('pm-pip').value=0.0001;
  document.getElementById('pm-color').value='chip-blue';
  openModal('pairModal');
}
function openEditPairModal(idx){
  APP.editPairIdx=idx;const p=APP.pairs[idx];
  document.getElementById('pairModalTitle').textContent='✏️ Edit Pair: '+p.name;
  document.getElementById('pm-name').value=p.name;
  document.getElementById('pm-type').value=p.type;
  document.getElementById('pm-mult').value=p.mult;
  document.getElementById('pm-pip').value=p.pip;
  document.getElementById('pm-color').value=p.color;
  document.getElementById('pm-desc').value=p.desc||'';
  openModal('pairModal');
}
function savePair(){
  const data={name:document.getElementById('pm-name').value.trim().toUpperCase(),type:document.getElementById('pm-type').value,mult:parseFloat(document.getElementById('pm-mult').value)||100000,pip:parseFloat(document.getElementById('pm-pip').value)||0.0001,color:document.getElementById('pm-color').value,desc:document.getElementById('pm-desc').value.trim()};
  if(!data.name)return showToast('❌ Nama pair tidak boleh kosong','error');
  if(APP.editPairIdx!==null){APP.pairs[APP.editPairIdx]=data;showToast('✅ Pair diperbarui!');}
  else{APP.pairs.push(data);showToast('✅ Pair ditambahkan!');}
  closeModal('pairModal');renderPairManager();cloudSync('savePairs',{pairs:APP.pairs});
}
function deletePair(idx){if(!confirm('Hapus pair '+APP.pairs[idx].name+'?'))return;APP.pairs.splice(idx,1);renderPairManager();cloudSync('savePairs',{pairs:APP.pairs});}

// AKUN MODAL
// ── CURRENCY helpers ──────────────────────────────────────
function currencySymbol(cur){return cur==='USD'?'US$':cur==='USC'?'US¢':'Rp';}
function currencyLabel(cur){return cur==='USD'?'USD (US$)':cur==='USC'?'USC (US¢)':'IDR (Rp)';}
/** Konversi balance ke Rp berdasarkan currency */
function calcAkunModalVal(currency, balance){
  const k=APP.kurs||17223;
  if(currency==='USD') return Math.round(balance*k);
  if(currency==='USC') return Math.round((balance/100)*k);
  return Math.round(balance); // IDR
}
/** Hitung & tampilkan modal ekuivalen di form modal */
function calcAkunModal(){
  const currency=document.getElementById('am-currency')?.value||'IDR';
  const balance=parseFloat(document.getElementById('am-balance')?.value)||0;
  const sym=currencySymbol(currency);
  const lbl=document.getElementById('am-balance-lbl');
  if(lbl)lbl.textContent='Balance ('+sym+')';
  const modal=calcAkunModalVal(currency,balance);
  const el=document.getElementById('am-modal');
  if(el)el.value=modal;
}
/** Format net PnL sesuai currency akun (menggunakan pnlUSD dari trades) */
function fmtAkunPnl(currency, pnlUSD, pnlRp){
  if(currency==='USD') return (pnlUSD>=0?'+':'')+'US$'+(pnlUSD).toFixed(2);
  if(currency==='USC'){const usc=pnlUSD*100;return (usc>=0?'+':'')+'US¢'+(usc).toFixed(2);}
  return (pnlRp>=0?'+':'-')+'Rp '+fmt(Math.abs(pnlRp));
}
/** Format balance/equity sesuai currency */
function fmtAkunVal(currency, valUSD, valRp){
  if(currency==='USD') return 'US$'+valUSD.toFixed(2);
  if(currency==='USC') return 'US¢'+(valUSD*100).toFixed(2);
  return 'Rp '+fmt(valRp);
}
function openAddAkunModal(){
  APP.editAkunIdx=null;
  document.getElementById('akunModalTitle').textContent='👤 Tambah Akun';
  ['am-name','am-broker'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('am-currency').value='IDR';
  document.getElementById('am-balance').value=800000;
  document.getElementById('am-modal').value=800000;
  document.getElementById('am-type').value='live';
  calcAkunModal();
  openModal('akunModal');
}
function openEditAkunModal(idx){
  APP.editAkunIdx=idx;const a=APP.akuns[idx];
  document.getElementById('akunModalTitle').textContent='✏️ Edit: '+a.name;
  document.getElementById('am-name').value=a.name;
  document.getElementById('am-broker').value=a.broker;
  document.getElementById('am-currency').value=a.currency||'IDR';
  document.getElementById('am-balance').value=a.balance!==undefined?a.balance:a.modal;
  document.getElementById('am-modal').value=a.modal;
  document.getElementById('am-type').value=a.type;
  calcAkunModal();
  openModal('akunModal');
}
function saveAkun(){
  // Pertahankan status akun yang sudah ada saat edit (jangan reset akun arsip ke aktif)
  const existingStatus = APP.editAkunIdx !== null ? APP.akuns[APP.editAkunIdx].status : 'active';
  const currency = document.getElementById('am-currency').value||'IDR';
  const balance  = parseFloat(document.getElementById('am-balance').value)||0;
  const modal    = calcAkunModalVal(currency, balance);
  const data={name:document.getElementById('am-name').value.trim(),broker:document.getElementById('am-broker').value.trim(),currency,balance,modal,type:document.getElementById('am-type').value,status:existingStatus};
  if(!data.name)return showToast('❌ Nama akun tidak boleh kosong','error');
  if(APP.editAkunIdx!==null){APP.akuns[APP.editAkunIdx]=data;showToast('✅ Akun diperbarui!');}
  else{APP.akuns.push(data);showToast('✅ Akun ditambahkan!');}
  closeModal('akunModal');renderAkunManager();renderArchivedAkuns();populateCtrlAkun();updateAll();cloudSync('saveAkuns',{akuns:APP.akuns});
}
function deleteAkun(idx){
  const a=APP.akuns[idx];
  APP._deleteAkunIdx=idx;
  document.getElementById('deleteAkunName').textContent=a.name;
  document.getElementById('deleteAkunBroker').textContent=a.broker+' · '+(a.type||'').toUpperCase();
  goToDelStep1();
  document.getElementById('deleteAkunModal').classList.add('active');
}
function goToDelStep1(){
  document.getElementById('delStep1').style.display='block';
  document.getElementById('delStep2').style.display='none';
}
function goToDelStep2(){
  const idx=APP._deleteAkunIdx;
  if(idx===null||idx===undefined)return;
  const a=APP.akuns[idx];
  const tradeCount=APP.trades.filter(t=>t.akun===a.name).length;
  document.getElementById('delStep2AkunName').textContent=a.name;
  document.getElementById('delStep2TradeCount').textContent=tradeCount;
  document.getElementById('delStep1').style.display='none';
  document.getElementById('delStep2').style.display='block';
}
function showDelLoading(title, sub){
  document.getElementById('delLoadingTitle').innerHTML=title+'<span class="del-loading-dots"><span>.</span><span>.</span><span>.</span></span>';
  document.getElementById('delLoadingSub').textContent=sub||'Mohon tunggu, jangan tutup halaman ini';
  document.getElementById('delProgressBar').style.width='0%';
  document.getElementById('delProgressLabel').textContent='Memproses...';
  document.getElementById('delLoadingOverlay').classList.add('active');
}
function setDelProgress(pct, label){
  document.getElementById('delProgressBar').style.width=pct+'%';
  document.getElementById('delProgressLabel').textContent=label||'';
}
function hideDelLoading(){
  document.getElementById('delLoadingOverlay').classList.remove('active');
}
async function confirmDeleteAkun(mode, deleteTradesAlso){
  const idx=APP._deleteAkunIdx;
  if(idx===null||idx===undefined)return;
  const a=APP.akuns[idx];
  document.getElementById('deleteAkunModal').classList.remove('active');
  if(mode==='permanent'){
    if(deleteTradesAlso){
      const tradeIds=APP.trades.filter(t=>t.akun===a.name).map(t=>t.id);
      showDelLoading('Menghapus Data', `Menghapus akun & ${tradeIds.length} trade terkait`);
      setDelProgress(5,'Menghapus akun...');
      await new Promise(r=>setTimeout(r,300));
      // Hapus trade satu per satu dengan progress
      for(let i=0;i<tradeIds.length;i++){
        try{ await api('deleteTrade',{id:tradeIds[i]}); }catch(e){}
        const pct=Math.round(10+(i+1)/Math.max(tradeIds.length,1)*75);
        setDelProgress(pct,`Menghapus trade ${i+1} dari ${tradeIds.length}...`);
        // Throttle sedikit agar tidak flood GAS
        if(i%3===2)await new Promise(r=>setTimeout(r,120));
      }
      APP.trades=APP.trades.filter(t=>t.akun!==a.name);
      setDelProgress(88,'Memperbarui akun...');
      APP.akuns.splice(idx,1);
      await new Promise(r=>setTimeout(r,200));
      setDelProgress(96,'Sinkronisasi...');
      cloudSync('saveAkuns',{akuns:APP.akuns});
      setDelProgress(100,'Selesai!');
      await new Promise(r=>setTimeout(r,600));
      hideDelLoading();
      showToast(`🗑️ Akun "${a.name}" + ${tradeIds.length} trade dihapus permanen`,'info');
    } else {
      showDelLoading('Menghapus Akun','Menghapus data akun dari cloud');
      setDelProgress(30,'Menghapus akun...');
      await new Promise(r=>setTimeout(r,300));
      APP.akuns.splice(idx,1);
      setDelProgress(80,'Sinkronisasi...');
      cloudSync('saveAkuns',{akuns:APP.akuns});
      setDelProgress(100,'Selesai!');
      await new Promise(r=>setTimeout(r,600));
      hideDelLoading();
      showToast(`🗑️ Akun "${a.name}" dihapus permanen (jurnal dipertahankan)`,'info');
    }
  } else {
    showDelLoading('Mengarsipkan Akun','Menyimpan status akun ke cloud');
    setDelProgress(40,'Mengarsipkan...');
    await new Promise(r=>setTimeout(r,300));
    APP.akuns[idx].status='inactive';
    setDelProgress(85,'Sinkronisasi...');
    cloudSync('saveAkuns',{akuns:APP.akuns});
    setDelProgress(100,'Selesai!');
    await new Promise(r=>setTimeout(r,500));
    hideDelLoading();
    showToast(`🗄️ Akun "${a.name}" berhasil diarsipkan`,'info');
  }
  APP._deleteAkunIdx=null;
  renderAkunManager();renderArchivedAkuns();populateCtrlAkun();updateAll();
}
function unarsipAkun(idx){
  APP.akuns[idx].status='active';
  showToast(`✅ Akun "${APP.akuns[idx].name}" diaktifkan kembali`,'info');
  renderAkunManager();renderArchivedAkuns();populateCtrlAkun();updateAll();
  cloudSync('saveAkuns',{akuns:APP.akuns});
}
function toggleArsipView(on){
  APP.showArsip=on;
  // Sync kedua toggle (settings & jurnal) supaya selalu sinkron
  const t1=document.getElementById('arsipToggle');if(t1)t1.checked=on;
  const t2=document.getElementById('jArsipToggle');if(t2)t2.checked=on;
  populateCtrlAkun();updateAll();renderJournal();
}

// FILTER
