function calcPnLAuto(){
  const pair=getPair(document.getElementById('fm-pair').value);
  const entry=parseFloat(document.getElementById('fm-entry').value)||0;
  const exit_=parseFloat(document.getElementById('fm-exit').value)||0;
  if(!entry||!exit_)return 0; // posisi masih OPEN — belum ada Exit, PnL belum bisa dihitung
  const lot=parseFloat(document.getElementById('fm-lot').value)||0;
  const dir=document.getElementById('fm-dir').value;
  const diff=dir==='BUY'?(exit_-entry):(entry-exit_);
  return diff*lot*pair.mult;
}

function getFeeVal(){return parseInt(document.getElementById('fm-fee').value)||0;}

function updateFeePreview(pnlRp){
  const fee=getFeeVal();
  const netRp=pnlRp-fee;
  const netCol=netRp>=0?'var(--c-green2)':'var(--c-red2)';
  document.getElementById('feePreview').textContent=fee>0?'Rp '+fmt(fee):'Rp 0';
  if(fee>0){document.getElementById('pnlNetPreview').textContent='Net: '+(netRp>=0?'+':'-')+'Rp '+fmt(Math.abs(netRp));document.getElementById('pnlNetPreview').style.color=netCol;}
  else{document.getElementById('pnlNetPreview').textContent='';}
}

function setResultDisplay(result){
  const val=result||'BE';
  document.getElementById('fm-result').value=val;
  const badge=document.getElementById('fm-result-badge');
  if(!badge)return;
  badge.className=val==='WIN'?'res-win':val==='LOSS'?'res-loss':val==='OPEN'?'res-open':'res-be';
  badge.textContent=val;
  const hint=badge.nextElementSibling;
  if(hint)hint.style.display=val?'none':'inline';
}

function calcAutoRRAndResult(){
  const entry=parseFloat(document.getElementById('fm-entry').value);
  const sl=parseFloat(document.getElementById('fm-sl').value);
  const tp=parseFloat(document.getElementById('fm-tp').value);
  const exit_=parseFloat(document.getElementById('fm-exit').value);
  const dir=document.getElementById('fm-dir').value;

  // AUTO RR — pakai EXIT jika sudah terisi, kalau belum pakai TP sebagai rencana
  const rrTarget=exit_||tp;
  if(entry&&sl&&sl!==entry&&rrTarget&&rrTarget!==entry){
    const risk=Math.abs(entry-sl);
    const reward=Math.abs(rrTarget-entry); // Exit dipakai jika ada, jika tidak pakai TP
    const rr=reward/risk;
    document.getElementById('fm-rr-display').value=rr.toFixed(2)+'R';
    document.getElementById('fm-rr').value=rr.toFixed(2);
  } else if(!entry){
    document.getElementById('fm-rr-display').value='—';
    document.getElementById('fm-rr').value='';
  } else if(!rrTarget||rrTarget===entry){
    document.getElementById('fm-rr-display').value='— (isi TP/Exit)';
    document.getElementById('fm-rr').value='';
  } else {
    document.getElementById('fm-rr-display').value='— (isi SL)';
    document.getElementById('fm-rr').value='';
  }

  // AUTO RESULT — jika ENTRY sudah diisi tapi EXIT masih kosong, posisi dianggap OPEN
  if(!entry) return;
  if(!exit_){ setResultDisplay('OPEN'); return; }
  const moved=dir==='BUY'?(exit_-entry):(entry-exit_);
  const eps=entry*0.000001; // tiny epsilon for BE detection
  let result=Math.abs(moved)<eps?'BE':moved>0?'WIN':'LOSS';
  setResultDisplay(result);
}

function calcPnL(){
  const manual=document.getElementById('fm-pnl-usd').value;
  if(manual!==''){onManualPnL();return;}
  const pnlUSD=calcPnLAuto();
  const pnlRp=Math.round(pnlUSD*APP.kurs);
  const col=pnlUSD>=0?'var(--c-green2)':'var(--c-red2)';
  document.getElementById('pnlUSDPreview').textContent=(pnlUSD>=0?'+':'')+'$'+pnlUSD.toFixed(2);
  document.getElementById('pnlUSDPreview').style.color=col;
  document.getElementById('pnlRpPreview').textContent=(pnlRp>=0?'+':'-')+'Rp '+fmt(Math.abs(pnlRp));
  document.getElementById('pnlRpPreview').style.color=col;
  updateFeePreview(pnlRp);
  calcAutoRRAndResult();
}

function onManualPnL(){
  const val=parseFloat(document.getElementById('fm-pnl-usd').value)||0;
  const pnlRp=Math.round(val*APP.kurs);
  const col=val>=0?'var(--c-green2)':'var(--c-red2)';
  document.getElementById('pnlUSDPreview').textContent=(val>=0?'+':'')+'$'+val.toFixed(2);
  document.getElementById('pnlUSDPreview').style.color=col;
  document.getElementById('pnlRpPreview').textContent=(pnlRp>=0?'+':'-')+'Rp '+fmt(Math.abs(pnlRp));
  document.getElementById('pnlRpPreview').style.color=col;
  updateFeePreview(pnlRp);
  // Auto hasil dari sign PnL USD
  const result=Math.abs(val)<0.001?'BE':val>0?'WIN':'LOSS';
  setResultDisplay(result);
}

function onPairChange(){
  const pair=getPair(document.getElementById('fm-pair').value);
  const typeMap={forex:'Forex Major',commodity100:'Commodity ×100',commodity1000:'Commodity ×1.000',jpy:'JPY Pair (×1.000)',custom:'Custom'};
  document.getElementById('pnlInfoBox').innerHTML=`ℹ️ <b>${pair.name}</b> — ${pair.desc||''} | Tipe: <b>${typeMap[pair.type]||pair.type}</b> | Pip: <b>${pair.pip}</b> | Formula: PnL = (Exit−Entry) × Lot × <b>${pair.mult.toLocaleString()}</b>`;
  calcPnL();
}

function onPairTypeChange(){
  const type=document.getElementById('pm-type').value;
  const multMap={forex:100000,commodity100:100,commodity1000:1000,jpy:1000,custom:1};
  const pipMap={forex:0.0001,commodity100:0.01,commodity1000:0.01,jpy:0.01,custom:0.0001};
  document.getElementById('pm-mult').value=multMap[type]||100000;
  document.getElementById('pm-pip').value=pipMap[type]||0.0001;
}

// PAGE NAV
