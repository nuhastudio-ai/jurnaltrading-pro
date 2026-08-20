function getFilteredTrades(){
  const akun=document.getElementById('ctrlAkun').value;
  const from=document.getElementById('dateFrom').value;
  const to=document.getElementById('dateTo').value;
  // Kumpulkan nama akun yang diarsipkan
  const arsipNames=new Set(APP.akuns.filter(a=>a.status==='inactive').map(a=>a.name));
  return APP.trades.filter(t=>{
    // Sembunyikan trade dari akun arsip jika toggle off
    if(!APP.showArsip&&arsipNames.has(t.akun))return false;
    const td=t.date.slice(0,10);
    // Jika filter akun = "(arsip)" match, strip suffix
    const filterAkun=akun==='all'?'all':akun.replace(' (arsip)','');
    if(filterAkun!=='all'&&t.akun!==filterAkun)return false;
    if(from&&td<from)return false;
    if(to&&td>to)return false;
    return true;
  });
}

function calcStats(trades){
  const opens=trades.filter(t=>t.result==='OPEN');
  const closed=trades.filter(t=>t.result!=='OPEN');
  const wins=closed.filter(t=>t.result==='WIN');
  const losses=closed.filter(t=>t.result==='LOSS');
  const bes=closed.filter(t=>t.result==='BE');
  const totalFee=trades.reduce((s,t)=>s+(t.fee||0),0);
  const netPnl=trades.reduce((s,t)=>s+t.pnlRp,0);
  const winPnl=wins.reduce((s,t)=>s+t.pnlRp,0);
  const lossPnl=Math.abs(losses.reduce((s,t)=>s+t.pnlRp,0));
  const pf=lossPnl>0?winPnl/lossPnl:wins.length>0?Infinity:0;
  const avgWin=wins.length?winPnl/wins.length:0;
  const avgLoss=losses.length?lossPnl/losses.length:0;
  const wlRatio=avgLoss>0?avgWin/avgLoss:Infinity;
  const wr=closed.length?wins.length/closed.length*100:0;
  return{wins:wins.length,losses:losses.length,bes:bes.length,open:opens.length,total:closed.length,netPnl,winPnl,lossPnl,pf,avgWin,avgLoss,wlRatio,wr,totalFee};
}

function updateWLCard(stats){
  const total=stats.total||1;
  const circ=389.6;// 2πr = 2*π*62
  const winPct=stats.wins/total;
  const lossPct=stats.losses/total;
  const bePct=stats.bes/total;
  // arc win
  document.getElementById('wlArcWin').style.strokeDasharray=`${circ*winPct} ${circ*(1-winPct)}`;
  // arc loss (offset by win)
  const lossEl=document.getElementById('wlArcLoss');
  lossEl.style.strokeDasharray=`${circ*lossPct} ${circ*(1-lossPct)}`;
  lossEl.style.strokeDashoffset=97.4-(circ*winPct);
  lossEl.style.opacity=stats.losses>0?'0.6':'0';
  // arc BE (offset by win+loss)
  const beEl=document.getElementById('wlArcBE');
  beEl.style.strokeDasharray=`${circ*bePct} ${circ*(1-bePct)}`;
  beEl.style.strokeDashoffset=97.4-(circ*(winPct+lossPct));
  beEl.style.opacity=stats.bes>0?'1':'0';
  // center pct
  g('wlPct',fmtPct(stats.wr));
  g('wlTotalBadge',stats.total+' trade');
  // bars
  g('wlWinCnt',stats.wins+' trade');
  g('wlLossCnt',stats.losses+' trade');
  g('wlBECnt',stats.bes+' trade');
  document.getElementById('wlWinBar').style.width=(stats.wins/total*100).toFixed(1)+'%';
  document.getElementById('wlLossBar').style.width=(stats.losses/total*100).toFixed(1)+'%';
  document.getElementById('wlBEBar').style.width=(stats.bes/total*100).toFixed(1)+'%';
  // stat cards
  const bestT=APP.trades.length?Math.max(...APP.trades.map(t=>t.pnlRp)):-Infinity;
  const worstT=APP.trades.length?Math.min(...APP.trades.map(t=>t.pnlRp)):Infinity;
  g('wlAvgWin',stats.avgWin>0?'Rp '+fmt(stats.avgWin):'—');
  g('wlAvgLoss',stats.avgLoss>0?'-Rp '+fmt(stats.avgLoss):'—');
  g('wlBest',bestT>-Infinity?'Rp '+fmt(bestT):'—');
  g('wlWorst',worstT<Infinity?'-Rp '+fmt(Math.abs(worstT)):'—');
}

// DASHBOARD
function updateAll(){
  const trades=getFilteredTrades();
  const stats=calcStats(trades);
  const akunName=document.getElementById('ctrlAkun').value;
  const activeAkuns=APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=='inactive');
  const modal=akunName==='all'?activeAkuns.reduce((s,a)=>s+a.modal,0):(getAkun(akunName)?.modal||0);
  const equity=modal+stats.netPnl;
  const ret=modal>0?stats.netPnl/modal*100:0;
  g('kEquity',fmtRp(equity));g('kPnl',fmtRp(stats.netPnl));
  // Dynamic color for KPI values
  const kPnlEl=document.getElementById('kPnl');if(kPnlEl)kPnlEl.style.color=stats.netPnl>=0?'var(--c-green2)':'var(--c-red2)';
  const kEqEl=document.getElementById('kEquity');if(kEqEl)kEqEl.style.color=equity>=0?'#60a5fa':'var(--c-red2)';
  g('kPnlSub','Avg: '+fmtRp(stats.total?stats.netPnl/stats.total:0));
  g('kWR',fmtPct(stats.wr));g('kWRsub',stats.wins+' win / '+stats.total+' trade');
  g('kPF',stats.pf===Infinity?'∞':stats.pf.toFixed(2));g('kTotal',stats.total);g('kOpen',stats.open);
  g('kWL',stats.wlRatio===Infinity?'∞':stats.wlRatio.toFixed(2));
  g('kReturn',(ret>=0?'+':'')+fmtPct(ret));g('kModal',fmtRp(modal));
  g('st-win',stats.wins);g('st-loss',stats.losses);g('st-be',stats.bes);
  g('st-wr',fmtPct(stats.wr));g('st-lr',fmtPct(100-stats.wr));
  g('st-pf',stats.pf===Infinity?'∞':stats.pf.toFixed(2));
  g('st-aw','Rp '+fmt(stats.avgWin));g('st-al','-Rp '+fmt(stats.avgLoss));
  g('st-wl',stats.wlRatio===Infinity?'∞':stats.wlRatio.toFixed(2));
  g('st-fee',stats.totalFee>0?'-Rp '+fmt(stats.totalFee):'Rp 0');
  g('st-pnl',fmtRp(stats.netPnl));
  const stPnlEl=document.getElementById('st-pnl');if(stPnlEl){stPnlEl.className=(stats.netPnl>=0?'v-green':'v-red')+' st-val';}
  updateWLCard(stats);
  renderTopPairs(trades);renderAkunTable();renderHariGrid(trades);renderPerfMetrics(stats,trades);renderEquityChart(trades);renderGrowthChart();renderRekap();
  // Update analisis jika sedang aktif (fix filter akun)
  if(document.getElementById('page-analysis').classList.contains('active'))renderAnalysis();
}

function renderTopPairs(trades){
  const bp={};
  trades.forEach(t=>{if(!bp[t.pair])bp[t.pair]={pair:t.pair,trades:0,win:0,loss:0,pnl:0};bp[t.pair].trades++;if(t.result==='WIN')bp[t.pair].win++;else if(t.result==='LOSS')bp[t.pair].loss++;bp[t.pair].pnl+=t.pnlRp;});
  const sorted=Object.values(bp).sort((a,b)=>b.pnl-a.pnl);
  document.getElementById('topPairsBody').innerHTML=sorted.slice(0,8).map((r,i)=>{
    const wr=r.trades?r.win/r.trades*100:0;
    const p=getPair(r.pair);
    const rankBg=i===0?'linear-gradient(135deg,var(--c-gold),var(--c-orange))':i===1?'linear-gradient(135deg,#94a3b8,#64748b)':'linear-gradient(135deg,#c97c3a,#92400e)';
    const rankCol=i===0?'#1a0a00':'white';
    return`<tr><td class="td-c"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:10px;font-weight:800;background:${rankBg};color:${rankCol}">${i+1}</span></td>
    <td><span class="chip ${p.color}">${r.pair}</span></td>
    <td class="td-c td-m">${r.trades}</td><td class="td-c v-green td-m">${r.win}</td><td class="td-c v-red td-m">${r.loss}</td>
    <td class="td-r td-m ${r.pnl>=0?'v-green':'v-red'}">${r.pnl>=0?'+':'-'}Rp ${fmt(r.pnl)}</td>
    <td class="td-r"><div class="wr-bar-wrap"><div class="wr-bar-bg"><div class="wr-bar-fill" style="width:${wr.toFixed(0)}%"></div></div><span class="v-green" style="font-family:var(--fn-m);font-size:10px;font-weight:700;white-space:nowrap;">${fmtPct(wr)}</span></div></td></tr>`;
  }).join('');
}

function renderAkunTable(){
  const visibleAkuns=APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=='inactive');
  document.getElementById('akunTableBody').innerHTML=visibleAkuns.map(a=>{
    const trd=APP.trades.filter(t=>t.akun===a.name);
    const s=calcStats(trd);
    const cur=a.currency||'IDR';
    const sym=currencySymbol(cur);
    // Net PnL sesuai currency
    const netPnlUSD=trd.reduce((acc,t)=>acc+(t.pnlUSD||0),0);
    const netPnlDisp=(cur==='USD')?netPnlUSD:(cur==='USC')?netPnlUSD*100:null;
    const netPnlRp=s.netPnl;
    const netPnlStr=netPnlDisp!==null?((netPnlDisp>=0?'+':'')+sym+Math.abs(netPnlDisp).toFixed(2)):((netPnlRp>=0?'+':'-')+'Rp '+fmt(Math.abs(netPnlRp)));
    const netPnlClass=((netPnlDisp!==null?netPnlDisp:netPnlRp)>=0)?'v-green':'v-red';
    // Balance
    const balanceVal=a.balance!==undefined?a.balance:(cur==='IDR'?a.modal:0);
    const balanceStr=sym+(cur==='IDR'?fmt(balanceVal):balanceVal.toFixed(2));
    // Equity = balance + net pnl (dalam currency yg sama)
    const eqUSD=(cur==='USD'?balanceVal:cur==='USC'?balanceVal/100:0)+netPnlUSD;
    const eqRp=a.modal+netPnlRp;
    const eqStr=(cur==='USD')?'US$'+eqUSD.toFixed(2):(cur==='USC')?'US¢'+(eqUSD*100).toFixed(2):'Rp '+fmt(eqRp);
    // Return % berdasarkan balance
    const baseVal=(cur==='USD'||cur==='USC')?balanceVal:a.modal;
    const returnPnl=(cur==='USD')?netPnlUSD:(cur==='USC')?netPnlUSD*100:netPnlRp;
    const ret=baseVal>0?returnPnl/baseVal*100:0;
    const isArsip=a.status==='inactive';
    return`<tr style="background:${a.type==='live'&&!isArsip?'rgba(79,142,247,.04)':'rgba(167,139,250,.03)'};${isArsip?'opacity:.7;':''}">
    <td style="font-weight:700;color:${isArsip?'var(--c-purple)':a.type==='live'?'var(--c-gold)':'#60a5fa'};">${a.name}${isArsip?'<span style="font-size:9px;background:var(--c-purple-d);color:var(--c-purple);padding:1px 5px;border-radius:4px;margin-left:5px;">ARSIP</span>':''}</td>
    <td class="td-c"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${cur==='USD'?'rgba(34,211,238,.12)':cur==='USC'?'rgba(167,139,250,.12)':'rgba(245,197,24,.1)'};color:${cur==='USD'?'var(--c-cyan)':cur==='USC'?'var(--c-purple)':'var(--c-gold)'};">${sym} ${cur}</span></td>
    <td class="td-c td-m" style="color:var(--c-gold);">${balanceStr}</td>
    <td class="td-c td-m" style="color:var(--txt2);">Rp ${fmt(a.modal)}</td>
    <td class="td-c td-m ${netPnlClass}" style="font-family:var(--fn-m);">${netPnlStr}</td>
    <td class="td-c"><span class="${ret>=0?'v-green':'v-red'}" style="font-family:var(--fn-m);">${ret>=0?'+':''}${ret.toFixed(2)}%</span></td>
    <td class="td-c v-green" style="font-family:var(--fn-m);">${fmtPct(s.wr)}</td>
    <td class="td-c td-m">${s.total}</td><td class="td-c td-m">${s.pf===Infinity?'∞':s.pf.toFixed(2)}</td>
    <td class="td-c td-m v-cyan" style="font-family:var(--fn-m);">${eqStr}</td></tr>`;
  }).join('');
}

function renderHariGrid(trades){
  const days=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const dayMap={1:0,2:1,3:2,4:3,5:4,6:5,0:6};
  const byDay=Array(7).fill(null).map(()=>({pnl:0,trades:0,win:0}));
  trades.forEach(t=>{const idx=dayMap[new Date(t.date).getDay()];byDay[idx].pnl+=t.pnlRp;byDay[idx].trades++;if(t.result==='WIN')byDay[idx].win++;});
  const tPnl=byDay.reduce((s,d)=>s+d.pnl,0);
  const tT=byDay.reduce((s,d)=>s+d.trades,0);
  const tW=byDay.reduce((s,d)=>s+d.win,0);
  let html=`<div class="hari-grid"><div class="hari-hd" style="text-align:left;padding-left:14px;">Metrik</div>${days.map(d=>`<div class="hari-hd">${d}</div>`).join('')}<div class="hari-hd">Total</div></div>
  <div class="hari-grid"><div class="hari-cell">PnL (Rp)</div>${byDay.map(d=>`<div class="hari-cell ${d.pnl>0?'v-green':d.pnl<0?'v-red':'v-muted'}">${d.pnl!==0?(d.pnl>0?'+':d.pnl<0?'-':'')+fmt(d.pnl):'—'}</div>`).join('')}<div class="hari-cell ${tPnl>0?'v-green':tPnl<0?'v-red':''}">${tPnl>0?'+':(tPnl<0?'-':'')}${fmt(tPnl)}</div></div>
  <div class="hari-grid"><div class="hari-cell">Trades</div>${byDay.map(d=>`<div class="hari-cell v-blue">${d.trades||'—'}</div>`).join('')}<div class="hari-cell">${tT}</div></div>
  <div class="hari-grid"><div class="hari-cell">Win Rate</div>${byDay.map(d=>`<div class="hari-cell v-green">${d.trades>0?fmtPct(d.win/d.trades*100):'—'}</div>`).join('')}<div class="hari-cell">${tT>0?fmtPct(tW/tT*100):'—'}</div></div>`;
  document.getElementById('hariGrid').innerHTML=html;
}

function renderPerfMetrics(stats,trades){
  // Gunakan `trades` (sudah difilter, tanpa akun arsip) — bukan APP.trades
  const activeTrades=trades||[];
  const metrics=[
    {name:'Win Rate',val:stats.wr,vStr:fmtPct(stats.wr),col:'var(--c-green),var(--c-green2)'},
    {name:'Profit Factor (dari 10)',val:Math.min(stats.pf===Infinity?100:stats.pf*10,100),vStr:stats.pf===Infinity?'∞':stats.pf.toFixed(2),col:'var(--c-gold),var(--c-orange)'},
    {name:'Return on Capital',val:Math.min(stats.wr,100),vStr:'+'+fmtPct(stats.wr),col:'var(--c-cyan),var(--c-blue)'},
    {name:'W/L Ratio (dari 5)',val:Math.min(stats.wlRatio===Infinity?100:stats.wlRatio*20,100),vStr:stats.wlRatio===Infinity?'∞':stats.wlRatio.toFixed(2),col:'var(--c-purple),#818cf8'},
  ];
  document.getElementById('perfMetrics').innerHTML=metrics.map(m=>`<div class="prog-row"><div class="prog-hd"><span class="prog-name">${m.name}</span><span class="prog-val" style="color:${m.col.split(',')[0]}">${m.vStr}</span></div><div class="prog-bg"><div class="prog-fill" style="width:${Math.min(m.val,100).toFixed(0)}%;background:linear-gradient(90deg,${m.col})"></div></div></div>`).join('');
  const activeStats=calcStats(activeTrades);
  document.getElementById('miniStats').innerHTML=`
  <div class="mini-card"><div class="mini-lbl">Best Trade</div><div class="mini-val v-green">${activeTrades.length?fmtRp(Math.max(...activeTrades.map(t=>t.pnlRp))):'—'}</div></div>
  <div class="mini-card"><div class="mini-lbl">Worst Trade</div><div class="mini-val v-red">${activeTrades.length?fmtRp(Math.min(...activeTrades.map(t=>t.pnlRp))):'—'}</div></div>
  <div class="mini-card"><div class="mini-lbl">Avg Win</div><div class="mini-val v-green">Rp ${fmt(activeStats.avgWin)}</div></div>
  <div class="mini-card"><div class="mini-lbl">Avg Loss</div><div class="mini-val v-red">-Rp ${fmt(activeStats.avgLoss)}</div></div>`;
}

function renderEquityChart(trades){
  const sorted=[...trades].sort((a,b)=>a.date.localeCompare(b.date));
  const akunName=document.getElementById('ctrlAkun').value;
  const _visAkuns=APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=="inactive");const modal=akunName==="all"?_visAkuns.reduce((s,a)=>s+a.modal,0):(getAkun(akunName)?.modal||0);
  let cum=modal;
  const pts=[{x:'Start',y:modal}];
  sorted.forEach(t=>{cum+=t.pnlRp;pts.push({x:t.date.slice(5,10),y:cum});});
  if(!APP.charts.equity){
    const ctx=document.getElementById('equityChart').getContext('2d');
    APP.charts.equity=new Chart(ctx,{type:'line',data:{labels:pts.map(p=>p.x),datasets:[{label:'Equity',data:pts.map(p=>p.y),borderColor:'#10b981',backgroundColor:(c)=>{const g=c.chart.ctx.createLinearGradient(0,0,0,280);g.addColorStop(0,'rgba(16,185,129,.22)');g.addColorStop(1,'rgba(16,185,129,.01)');return g;},borderWidth:2.5,fill:true,tension:0.35,pointRadius:2,pointHoverRadius:5,pointBackgroundColor:'#10b981',pointBorderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e293b',borderColor:'rgba(255,255,255,.08)',borderWidth:1,callbacks:{label:c=>' Equity: Rp '+fmt(c.raw)}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},maxTicksLimit:14}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},callback:v=>'Rp '+(v/1000000).toFixed(2)+'M'}}}}});
  }else{APP.charts.equity.data.labels=pts.map(p=>p.x);APP.charts.equity.data.datasets[0].data=pts.map(p=>p.y);APP.charts.equity.update('active');}
}
function switchEquityMode(mode,btn){btn.closest('.mode-tabs').querySelectorAll('.mode-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');APP.equityMode=mode;renderGrowthChart(getFilteredTrades());}

// GROWTH PER AKUN CHART
const GROWTH_COLORS=['#4f8ef7','#ef4444','#22d3ee','#a78bfa','#f5c518','#10b981','#f97316','#ec4899'];
function getPeriodKeyGrowth(dateStr,mode){
  const d=new Date(dateStr);
  if(mode==='month')return dateStr.slice(0,7);
  if(mode==='week'){
    const tmp=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=tmp.getUTCDay()||7;
    tmp.setUTCDate(tmp.getUTCDate()+4-day);
    const ys=new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
    const wk=Math.ceil((((tmp-ys)/86400000)+1)/7);
    return d.getFullYear()+'-W'+String(wk).padStart(2,'0');
  }
  return dateStr.slice(0,10);
}
function formatPeriodLabel(p,mode){
  if(mode==='month'){const[yr,mo]=p.split('-');return['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][parseInt(mo)-1]+' '+yr.slice(2);}
  if(mode==='week')return p.replace(/\d{4}-/,'');
  return p.slice(5);
}

const _growthGlowPlugin={
  id:'growthGlow',
  beforeDatasetDraw(chart,args){
    const col=chart.data.datasets[args.index]?.borderColor;
    if(col){chart.ctx.shadowColor=col;chart.ctx.shadowBlur=14;}
  },
  afterDatasetDraw(chart){chart.ctx.shadowBlur=0;chart.ctx.shadowColor='transparent';}
};

function renderGrowthChart(){
  const mode=APP.equityMode;
  const visAkuns=(APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=='inactive'));
  const allTrades=APP.trades;
  // Collect unique period keys from all trades
  const periodSet=new Set();
  allTrades.forEach(t=>{if(t.date)periodSet.add(getPeriodKeyGrowth(t.date,mode));});
  const allPeriods=[...periodSet].sort();
  if(!allPeriods.length){
    const legendEl=document.getElementById('growthLegend');
    if(legendEl)legendEl.innerHTML='<span style="font-size:11px;color:var(--txt2);">Belum ada data trade</span>';
    return;
  }
  // Build dataset per akun
  const datasets=visAkuns.map((akun,i)=>{
    const col=GROWTH_COLORS[i%GROWTH_COLORS.length];
    const akunTrades=allTrades.filter(t=>t.akun===akun.name);
    // Map period → pnl sum
    const pMap={};
    akunTrades.forEach(t=>{const pk=getPeriodKeyGrowth(t.date,mode);pMap[pk]=(pMap[pk]||0)+t.pnlRp;});
    let cum=0;
    const data=allPeriods.map(p=>{cum+=(pMap[p]||0);return akun.modal+cum;});
    // Add start point
    return{
      label:akun.name,
      data,
      borderColor:col,
      backgroundColor:'transparent',
      borderWidth:2.5,
      tension:0.42,
      pointRadius:3,
      pointHoverRadius:7,
      pointBackgroundColor:col,
      pointBorderColor:'rgba(0,0,0,.4)',
      pointBorderWidth:1.5,
      fill:false,
      _col:col
    };
  });
  const labels=allPeriods.map(p=>formatPeriodLabel(p,mode));
  // Render chart
  if(!APP.charts.growth){
    const ctx=document.getElementById('growthChart');
    if(!ctx)return;
    APP.charts.growth=new Chart(ctx.getContext('2d'),{
      type:'line',
      data:{labels,datasets},
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'rgba(11,17,32,.97)',
            borderColor:'rgba(255,255,255,.09)',
            borderWidth:1,
            padding:10,
            titleColor:'#94a3b8',
            titleFont:{size:10,weight:'700'},
            bodyColor:'#f0f4ff',
            bodyFont:{size:11,family:'JetBrains Mono,monospace',weight:'600'},
            callbacks:{
              title:items=>{const p=allPeriods[items[0]?.dataIndex]||'';return formatPeriodLabel(p,mode);},
              label:c=>{const col=GROWTH_COLORS[c.datasetIndex%GROWTH_COLORS.length];return` ${c.dataset.label}: Rp ${fmt(c.raw)}`;}
            }
          }
        },
        scales:{
          x:{grid:{color:'rgba(255,255,255,.035)'},ticks:{color:'#4a5568',font:{size:9},maxTicksLimit:12}},
          y:{grid:{color:'rgba(255,255,255,.035)'},ticks:{color:'#4a5568',font:{size:9},callback:v=>{const m=Math.abs(v);return(v<0?'-':'')+'Rp '+(m>=1000000?(m/1000000).toFixed(1)+'M':fmt(m));}}}
        }
      },
      plugins:[_growthGlowPlugin]
    });
  }else{
    APP.charts.growth.data.labels=labels;
    APP.charts.growth.data.datasets=datasets;
    APP.charts.growth.update('active');
  }
  // Render legend
  const legendEl=document.getElementById('growthLegend');
  if(legendEl){
    legendEl.innerHTML=visAkuns.map((a,i)=>{
      const col=GROWTH_COLORS[i%GROWTH_COLORS.length];
      const trd=allTrades.filter(t=>t.akun===a.name);
      const net=trd.reduce((s,t)=>s+t.pnlRp,0);
      const ret=a.modal>0?net/a.modal*100:0;
      const retStr=(ret>=0?'+':'')+ret.toFixed(1)+'%';
      const retCol=net>=0?'var(--c-green2)':'var(--c-red2)';
      return`<div class="growth-legend-item" title="${a.name} — Net PnL: ${fmtRp(net)} | Return: ${retStr}">
        <div class="growth-legend-dot" style="background:${col};box-shadow:0 0 7px ${col},0 0 16px ${col}66;"></div>
        <span class="growth-legend-name">${a.name}</span>
        <span style="font-size:9.5px;font-family:var(--fn-m);font-weight:700;color:${retCol};margin-left:2px;">${retStr}</span>
      </div>`;
    }).join('');
  }
}

// REKAP
/* ── MONTH NAVIGATION HELPERS ─────────────────────────────── */
const _mNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
function _navMonth(monthElId,yearElId,dir,renderFn){
  const mEl=document.getElementById(monthElId);
  const yEl=document.getElementById(yearElId);
  if(!mEl||!yEl)return;
  let mi=_mNames.indexOf(mEl.value);
  let yr=parseInt(yEl.value)||new Date().getFullYear();
  mi+=dir;
  if(mi<0){mi=11;yr--;}
  else if(mi>11){mi=0;yr++;}
  // ensure year option exists
  const yStr=String(yr);
  if(![...(yEl.options)].some(o=>o.value===yStr)){yEl.add(new Option(yStr,yStr));}
  mEl.value=_mNames[mi];
  yEl.value=yStr;
  renderFn();
}
function navRekapMonth(dir){_navMonth('rekapMonth','rekapYear',dir,renderRekap);}
function navCalMonth(dir){_navMonth('calMonth','calYear',dir,renderCalendar);}

/* ── SWIPE SUPPORT (MOBILE) ──────────────────────────────── */
function _addSwipe(elId,onLeft,onRight){
  const el=document.getElementById(elId);
  if(!el)return;
  let sx=0,sy=0,t0=0;
  let showTimer=null;
  el.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;t0=Date.now();
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(e.touches.length!==1)return;
    const dx=e.touches[0].clientX-sx;
    const dy=e.touches[0].clientY-sy;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>12){
      el.classList.add('swipe-active');
      clearTimeout(showTimer);
      showTimer=setTimeout(()=>el.classList.remove('swipe-active'),1200);
    }
  },{passive:true});
  el.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx;
    const dy=e.changedTouches[0].clientY-sy;
    const dt=Date.now()-t0;
    if(dt<600&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){
      if(dx<0)onLeft();else onRight();
    }
  },{passive:true});
}

function switchRekapMode(mode,btn){btn.closest('.mode-tabs').querySelectorAll('.mode-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');APP.rekapMode=mode;renderRekap();}
function getWeekNum(d){const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-day);const ys=new Date(Date.UTC(date.getUTCFullYear(),0,1));return Math.ceil((((date-ys)/86400000)+1)/7);}
function getWeekOfMonth(d){const first=new Date(d.getFullYear(),d.getMonth(),1);const firstDow=first.getDay()===0?6:first.getDay()-1;return Math.ceil((d.getDate()+firstDow)/7);}

function renderRekap(){
  const mNamesArr=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const selMonth=document.getElementById('rekapMonth')?.value;
  const selYear=parseInt(document.getElementById('rekapYear')?.value)||new Date().getFullYear();
  const mi=mNamesArr.indexOf(selMonth);
  const akun=document.getElementById('ctrlAkun').value;
  const mode=APP.rekapMode;
  const cont=document.getElementById('rekapBody');
  // DAY/WEEK: filter by month+year; MONTH: filter by year only
  const arsipNamesRekap=new Set(APP.akuns.filter(a=>a.status==='inactive').map(a=>a.name));
  let trades=APP.trades.filter(t=>{
    if(!APP.showArsip&&arsipNamesRekap.has(t.akun))return false;
    const d=new Date(t.date);
    if(d.getFullYear()!==selYear)return false;
    if(mode!=='month'&&mi>=0&&d.getMonth()!==mi)return false;
    return true;
  });
  if(akun!=='all')trades=trades.filter(t=>t.akun===akun.replace(' (arsip)',''));
  if(mode==='day'){
    const dayNames=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','TOTAL'];
    const dayMap={1:0,2:1,3:2,4:3,5:4,6:5,0:6};
    const weeks={};
    trades.forEach(t=>{
      const d=new Date(t.date);
      const wom=getWeekOfMonth(d);
      const key=d.getFullYear()+'-'+String(d.getMonth()).padStart(2,'0')+'-W'+String(wom).padStart(2,'0');
      if(!weeks[key])weeks[key]={days:Array(7).fill(0),weekNum:wom};
      weeks[key].days[dayMap[d.getDay()]]+=t.pnlRp;
    });
    const wks=Object.keys(weeks).sort();
    let h=`<table class="rekap-tbl"><thead><tr><td class="rekap-hd" style="text-align:left;padding-left:14px;">Minggu</td>${dayNames.map((d,i)=>`<td class="rekap-hd ${i===7?'total-hd':''}">${d}</td>`).join('')}</tr></thead><tbody>`;
    wks.forEach(wk=>{const row=weeks[wk].days;const tot=row.reduce((s,v)=>s+v,0);h+=`<tr><td class="rekap-week-lbl">W${weeks[wk].weekNum}</td>${row.map(v=>`<td class="rekap-cell"><span class="${v>0?'rekap-pnl-pos':v<0?'rekap-pnl-neg':'rekap-pnl-zero'}">${v!==0?(v>0?'+':v<0?'-':'')+fmt(v):'Rp 0'}</span></td>`).join('')}<td class="rekap-cell total-cell"><span class="${tot>0?'rekap-pnl-pos':tot<0?'rekap-pnl-neg':'rekap-pnl-zero'}">${tot>0?'+':(tot<0?'-':'')}${fmt(tot)}</span></td></tr>`;});
    if(!wks.length)h+=`<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--txt2);">Tidak ada data untuk ${selMonth} ${selYear}</td></tr>`;
    cont.innerHTML=h+'</tbody></table>';
  }else if(mode==='week'){
    const wks={};trades.forEach(t=>{const wom=getWeekOfMonth(new Date(t.date));const wn='W'+wom;if(!wks[wn])wks[wn]=0;wks[wn]+=t.pnlRp;});
    const keys=Object.keys(wks).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1)));
    if(!keys.length){cont.innerHTML=`<div style="padding:20px;text-align:center;color:var(--txt2);">Tidak ada data untuk ${selMonth} ${selYear}</div>`;return;}
    cont.innerHTML=`<table class="rekap-tbl"><thead><tr>${keys.map(w=>`<td class="rekap-hd">${w}</td>`).join('')}<td class="rekap-hd total-hd">TOTAL</td></tr></thead><tbody><tr>${keys.map(w=>`<td class="rekap-cell"><span class="${wks[w]>=0?'rekap-pnl-pos':'rekap-pnl-neg'}">${wks[w]>=0?'+':'-'}${fmt(wks[w])}</span></td>`).join('')}<td class="rekap-cell total-cell"><span class="${keys.reduce((s,k)=>s+wks[k],0)>=0?'rekap-pnl-pos':'rekap-pnl-neg'}">${keys.reduce((s,k)=>s+wks[k],0)>=0?'+':'-'}${fmt(keys.reduce((s,k)=>s+wks[k],0))}</span></td></tr></tbody></table>`;
  }else{
    const mths={};trades.forEach(t=>{const m=t.date.slice(0,7);if(!mths[m])mths[m]=0;mths[m]+=t.pnlRp;});
    const mNamesMap={1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const keys=Object.keys(mths).sort();
    if(!keys.length){cont.innerHTML=`<div style="padding:20px;text-align:center;color:var(--txt2);">Tidak ada data untuk tahun ${selYear}</div>`;return;}
    cont.innerHTML=`<table class="rekap-tbl"><thead><tr>${keys.map(m=>`<td class="rekap-hd">${mNamesMap[parseInt(m.slice(5))]||m} ${m.slice(0,4)}</td>`).join('')}<td class="rekap-hd total-hd">TOTAL</td></tr></thead><tbody><tr>${keys.map(m=>`<td class="rekap-cell"><span class="${mths[m]>=0?'rekap-pnl-pos':'rekap-pnl-neg'}">${mths[m]>=0?'+':'-'}${fmt(mths[m])}</span></td>`).join('')}<td class="rekap-cell total-cell"><span class="${keys.reduce((s,k)=>s+mths[k],0)>=0?'rekap-pnl-pos':'rekap-pnl-neg'}">${keys.reduce((s,k)=>s+mths[k],0)>=0?'+':'-'}${fmt(keys.reduce((s,k)=>s+mths[k],0))}</span></td></tr></tbody></table>`;
  }
}

// JOURNAL
function getJFiltered(){
  // Kumpulkan nama akun yang diarsipkan — trade mereka disembunyikan kecuali showArsip ON
  const arsipNames=new Set(APP.akuns.filter(a=>a.status==='inactive').map(a=>a.name));
  const search=document.getElementById('jSearchPair').value.toLowerCase();
  const akun=document.getElementById('jFilterAkun').value;
  const result=document.getElementById('jFilterResult').value;
  const dir=document.getElementById('jFilterDir').value;
  const setup=document.getElementById('jFilterSetup').value;
  const pair=document.getElementById('jFilterPair').value;
  const from=document.getElementById('jDateFrom').value;
  const to=document.getElementById('jDateTo').value;
  return APP.trades.filter(t=>{
    // Sembunyikan trade dari akun arsip jika toggle Tampilkan Arsip sedang OFF
    if(!APP.showArsip&&arsipNames.has(t.akun))return false;
    if(search&&!t.pair.toLowerCase().includes(search)&&!t.note.toLowerCase().includes(search)&&!t.akun.toLowerCase().includes(search))return false;
    if(akun&&t.akun!==akun)return false;if(result&&t.result!==result)return false;
    if(dir&&t.dir!==dir)return false;if(setup&&!getSetupArr(t).includes(setup))return false;
    if(pair&&t.pair!==pair)return false;
    if(from&&t.date.slice(0,10)<from)return false;if(to&&t.date.slice(0,10)>to)return false;
    return true;
  });
}

function renderJournal(){
  let data=getJFiltered();
  data.sort((a,b)=>{let av=a[APP.jSortKey],bv=b[APP.jSortKey];if(typeof av==='number')return APP.jSortAsc?av-bv:bv-av;return APP.jSortAsc?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));});
  document.getElementById('jCount').textContent=data.length;
  const js=calcStats(data);
  const akunName=document.getElementById('ctrlAkun').value;
  const _visAkuns=APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=="inactive");const modal=akunName==="all"?_visAkuns.reduce((s,a)=>s+a.modal,0):(getAkun(akunName)?.modal||0);
  document.getElementById('journalSummary').innerHTML=[
    {lbl:'Total',val:data.length,col:'v-blue',cls:'kpi-blue'},
    {lbl:'WIN',val:js.wins,col:'v-green',cls:'kpi-green'},
    {lbl:'LOSS',val:js.losses,col:'v-red',cls:'kpi-purple'},
    {lbl:'Win Rate',val:fmtPct(js.wr),col:'v-gold',cls:'kpi-gold'},
    {lbl:'Net PnL (Rp)',val:fmtRp(js.netPnl),col:js.netPnl>=0?'v-green':'v-red',cls:'kpi-cyan'},
    {lbl:'Profit Factor',val:js.pf===Infinity?'∞':js.pf.toFixed(2),col:'v-cyan',cls:'kpi-blue'},
    {lbl:'Avg Win',val:'Rp '+fmt(js.avgWin),col:'v-green',cls:'kpi-green'},
    {lbl:'Avg Loss',val:'-Rp '+fmt(js.avgLoss),col:'v-red',cls:'kpi-purple'},
  ].map(c=>`<div class="kpi ${c.cls}" style="animation:none;"><div class="kpi-lbl">${c.lbl}</div><div class="kpi-val ${c.col}" style="font-size:15px;">${c.val}</div></div>`).join('');
  const total=APP.jPageSize===999?1:Math.ceil(data.length/APP.jPageSize)||1;
  if(APP.jPage>total)APP.jPage=1;
  const start=(APP.jPage-1)*APP.jPageSize;
  const slice=APP.jPageSize===999?data:data.slice(start,start+APP.jPageSize);
  document.getElementById('jPage').textContent=APP.jPage;
  document.getElementById('jTotalPages').textContent=total;
  document.getElementById('journalBody').innerHTML=slice.map(t=>{
    const p=getPair(t.pair);
    const pnlStr=(t.pnlRp>=0?'+':'-')+'Rp '+fmt(Math.abs(t.pnlRp));
    const pnlUSDStr=(t.pnlUSD>=0?'+':'')+'$'+t.pnlUSD.toFixed(2);
    const feeStr=t.fee>0?'-Rp '+fmt(t.fee):'—';
    const rrStr=t.rr>0?t.rr.toFixed(1)+'R':'—';
    const tpStr=t.tp>0?t.tp.toLocaleString('id',{maximumFractionDigits:5}):'—';
    const sel=APP.jSelected.has(t.id);
    return`<tr class="${sel?'row-sel':''}">
    <td><input type="checkbox" ${sel?'checked':''} onchange="toggleJSelect(${t.id},this)"></td>
    <td class="td-m v-muted">${t.id}</td>
    <td style="color:var(--txt1);white-space:nowrap;font-size:10.5px;">${formatDateDisplay(t.date)}</td>
    <td style="font-size:10.5px;color:#a5b4fc;">${t.akun}</td>
    <td><span class="chip ${p.color}">${t.pair}</span></td>
    <td class="td-c">${t.tf?`<span class="chip ${tfChipClass(t.tf)}">${t.tf}</span>`:'—'}</td>
    <td class="td-c"><span class="${t.dir==='BUY'?'dir-buy':'dir-sell'}">${t.dir}</span></td>
    <td class="td-c td-m">${t.lot}</td>
    <td class="td-c td-m v-muted">${t.entry.toLocaleString('id',{maximumFractionDigits:5})}</td>
    <td class="td-c td-m" style="color:var(--c-red2);font-family:var(--fn-m);font-size:10.5px;">${t.sl>0?t.sl.toLocaleString('id',{maximumFractionDigits:5}):'—'}</td>
    <td class="td-c td-m" style="color:var(--c-green2);font-family:var(--fn-m);font-size:10.5px;">${tpStr}</td>
    <td class="td-c td-m v-muted">${t.exit>0?t.exit.toLocaleString('id',{maximumFractionDigits:5}):'—'}</td>
    <td class="td-c td-m ${t.pnlRp>=0?'v-green':'v-red'}">${pnlStr}</td>
    <td class="td-c" style="font-family:var(--fn-m);font-size:10.5px;color:var(--txt2);">${pnlUSDStr}</td>
    <td class="td-c td-m" style="font-family:var(--fn-m);font-size:10.5px;color:${t.fee>0?'var(--c-gold)':'var(--txt2)'};">${feeStr}</td>
    <td class="td-c td-m" style="font-family:var(--fn-m);font-size:10.5px;color:${t.rr>0?'var(--c-cyan)':'var(--txt2)'};">${rrStr}</td>
    <td class="td-c"><span class="${t.result==='WIN'?'res-win':t.result==='LOSS'?'res-loss':t.result==='OPEN'?'res-open':'res-be'}">${t.result}</span></td>
    <td><div class="setup-multi-chips">${getSetupArr(t).length?getSetupArr(t).map(s=>`<span class="setup-multi-chip">${s}</span>`).join(''):'<span style="color:var(--txt2);font-size:10px;">—</span>'}</div></td>
    <td style="font-size:10.5px;color:var(--txt2);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${t.note}">${t.note||'—'}</td>
    <td class="td-c" style="white-space:nowrap;">
      <button class="btn btn-ghost btn-icon btn-sm" onclick="viewDetail(${t.id})" title="Detail">👁</button>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="openEditModal(${t.id})" title="Edit">✏️</button>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="duplicateTrade(${t.id})" title="Duplikat trade ini" style="color:var(--c-cyan);border-color:rgba(34,211,238,.2);">⧉</button>
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteTrade(${t.id})" title="Hapus">🗑</button>
    </td></tr>`;
  }).join('')||`<tr><td colspan="20" style="padding:24px;text-align:center;color:var(--txt2);">Tidak ada data trade</td></tr>`;
  const pgBtns=document.getElementById('jPagination');
  let pgH=`<button class="pg-btn" onclick="goJPage(${APP.jPage-1})" ${APP.jPage===1?'disabled':''}>◀</button>`;
  const s2=Math.max(1,APP.jPage-2),e2=Math.min(total,APP.jPage+2);
  for(let i=s2;i<=e2;i++)pgH+=`<button class="pg-btn${i===APP.jPage?' active':''}" onclick="goJPage(${i})">${i}</button>`;
  pgH+=`<button class="pg-btn" onclick="goJPage(${APP.jPage+1})" ${APP.jPage>=total?'disabled':''}>▶</button>`;
  pgBtns.innerHTML=pgH;
  document.getElementById('selectedCount').textContent=APP.jSelected.size;
  document.getElementById('bulkDeleteBtn').style.display=APP.jSelected.size>0?'inline-flex':'none';
}

function jSort(key){if(APP.jSortKey===key)APP.jSortAsc=!APP.jSortAsc;else{APP.jSortKey=key;APP.jSortAsc=false;}renderJournal();}
function goJPage(p){const max=Math.ceil(getJFiltered().length/APP.jPageSize)||1;APP.jPage=Math.max(1,Math.min(p,max));renderJournal();}
function changeJPageSize(val){APP.jPageSize=parseInt(val);APP.jPage=1;renderJournal();}
function resetJFilter(){['jSearchPair','jDateFrom','jDateTo'].forEach(id=>document.getElementById(id).value='');['jFilterAkun','jFilterResult','jFilterDir','jFilterSetup','jFilterPair'].forEach(id=>document.getElementById(id).value='');renderJournal();}
function toggleJSelect(id,el){if(el.checked)APP.jSelected.add(id);else APP.jSelected.delete(id);renderJournal();}
function toggleSelectAll(el){const data=getJFiltered();if(el.checked)data.forEach(t=>APP.jSelected.add(t.id));else APP.jSelected.clear();renderJournal();}
function bulkDelete(){if(!APP.jSelected.size||!confirm(`Hapus ${APP.jSelected.size} trade?`))return;const ids=[...APP.jSelected];APP.trades=APP.trades.filter(t=>!APP.jSelected.has(t.id));APP.jSelected.clear();renderJournal();updateAll();showToast('🗑️ Trade dihapus!');
  setCloudPill('saving');Promise.all(ids.map(id=>api('deleteTrade',{id}))).then(()=>setCloudPill('idle')).catch(()=>setCloudPill('err'));}
function deleteTrade(id){if(!confirm('Hapus trade #'+id+'?'))return;APP.trades=APP.trades.filter(t=>t.id!==id);renderJournal();updateAll();showToast('🗑️ Trade #'+id+' dihapus!');cloudSync('deleteTrade',{id});}

function duplicateTrade(id){
  const src=APP.trades.find(t=>t.id===id);if(!src)return;
  const newId=Math.max(0,...APP.trades.map(t=>t.id))+1;
  const dup={...src, id:newId};
  const srcIdx=APP.trades.findIndex(t=>t.id===id);
  APP.trades.splice(srcIdx,0,dup);
  renderJournal();updateAll();
  showToast(`⧉ Trade #${id} diduplikat → #${newId}`,'info');
  cloudSync('saveTrade',{trade:dup});
}

function viewDetail(id){
  const t=APP.trades.find(x=>x.id===id);if(!t)return;
  const p=getPair(t.pair);const col=t.pnlRp>=0?'var(--c-green2)':'var(--c-red2)';
  document.getElementById('detailContent').innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
  ${[['Pair',`<span class="chip ${p.color}">${t.pair}</span>`],['Tanggal',`<span style="color:var(--txt1)">${formatDateDisplay(t.date)}</span>`],['Akun',`<span style="color:#a5b4fc">${t.akun}</span>`],['TF',t.tf?`<span class="chip ${tfChipClass(t.tf)}">${t.tf}</span>`:`<span style="color:var(--txt2)">—</span>`],['Arah',`<span class="${t.dir==='BUY'?'dir-buy':'dir-sell'}">${t.dir}</span>`],['Lot',`<span class="td-m">${t.lot}</span>`],['Setup',`<div class="setup-multi-chips" style="flex-wrap:wrap;">${getSetupArr(t).length?getSetupArr(t).map(s=>`<span class="setup-multi-chip">${s}</span>`).join(''):'<span style="color:var(--txt2)">—</span>'}</div>`],['Entry',`<span class="td-m">${t.entry}</span>`],['SL',`<span style="font-family:var(--fn-m);color:var(--c-red2)">${t.sl>0?t.sl:'—'}</span>`],['TP',`<span style="font-family:var(--fn-m);color:var(--c-green2)">${t.tp>0?t.tp:'—'}</span>`],['Exit',`<span class="td-m">${t.exit>0?t.exit:'—'}</span>`],['RR',`<span style="font-family:var(--fn-m);color:var(--c-cyan)">${t.rr>0?t.rr.toFixed(2)+'R':'—'}</span>`],['PnL USD',`<span style="font-family:var(--fn-m);color:${col}">${t.pnlUSD>=0?'+':''}$${t.pnlUSD.toFixed(2)}</span>`],['PnL Rp',`<span style="font-family:var(--fn-m);color:${col};font-weight:800">${t.pnlRp>=0?'+':'-'}Rp ${fmt(Math.abs(t.pnlRp))}</span>`],['Fee (Rp)',`<span style="font-family:var(--fn-m);color:var(--c-gold)">${t.fee>0?'-Rp '+fmt(t.fee):'Rp 0'}</span>`],['Hasil',`<span class="${t.result==='WIN'?'res-win':t.result==='LOSS'?'res-loss':t.result==='OPEN'?'res-open':'res-be'}">${t.result}</span>`]].map(([l,v])=>`<div style="background:rgba(255,255,255,.025);border:1px solid var(--bdr);border-radius:8px;padding:9px 12px;"><div style="font-size:9.5px;color:var(--txt2);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px;">${l}</div>${v}</div>`).join('')}
  </div>
  <div style="background:var(--bg0);border:1px solid var(--bdr);border-radius:var(--r8);padding:11px 13px;margin-bottom:12px;"><div style="font-size:9.5px;color:var(--txt2);font-weight:700;text-transform:uppercase;margin-bottom:5px;">Catatan</div><div style="font-size:12px;color:var(--txt1);">${t.note||'Tidak ada catatan.'}</div></div>
  <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" onclick="openEditModal(${t.id});closeModal('detailModal')">✏️ Edit</button><button class="btn btn-ghost btn-sm" onclick="closeModal('detailModal')">Tutup</button></div>`;
  openModal('detailModal');
}

// ANALYSIS
function renderAnalysis(){
  const trades=getFilteredTrades().sort((a,b)=>a.date.localeCompare(b.date));
  const stats=calcStats(trades);
  const akunName=document.getElementById('ctrlAkun').value;
  const _visAkuns=APP.showArsip?APP.akuns:APP.akuns.filter(a=>a.status!=="inactive");const modal=akunName==="all"?_visAkuns.reduce((s,a)=>s+a.modal,0):(getAkun(akunName)?.modal||0);
  let bW=0,cW=0,bL=0,cL=0;
  trades.forEach(t=>{if(t.result==='WIN'){cW++;bW=Math.max(bW,cW);cL=0;}else if(t.result==='LOSS'){cL++;bL=Math.max(bL,cL);cW=0;}else{cW=0;cL=0;}});
  let peak=modal,eq=modal,maxDD=0;
  trades.forEach(t=>{eq+=t.pnlRp;if(eq>peak)peak=eq;maxDD=Math.max(maxDD,peak-eq);});
  const ret=modal>0?stats.netPnl/modal*100:0;
  document.getElementById('an-return').textContent=(ret>=0?'+':'')+fmtPct(ret);
  document.getElementById('an-best-streak').textContent=bW;
  document.getElementById('an-worst-streak').textContent=bL;
  document.getElementById('an-expectancy').textContent=fmtRp(stats.total?stats.netPnl/stats.total:0);
  document.getElementById('an-maxdd').textContent='-Rp '+fmt(maxDD);
  document.getElementById('an-dd-badge').textContent='-Rp '+fmt(maxDD);
  const metricsData=[
    {icon:'🏆',lbl:'Best Win Streak',val:bW,sub:'Consecutive wins',col:'v-green'},
    {icon:'💔',lbl:'Worst Loss Streak',val:bL,sub:'Consecutive losses',col:'v-red'},
    {icon:'📉',lbl:'Max Drawdown',val:'-Rp '+fmt(maxDD),sub:'Peak to trough',col:'v-red'},
    {icon:'⚡',lbl:'Recovery Factor',val:maxDD>0?(stats.netPnl/maxDD).toFixed(2):'∞',sub:'Net PnL / Max DD',col:'v-gold'},
    {icon:'📊',lbl:'Sharpe (est)',val:(stats.wr/10).toFixed(2),sub:'Risk-adjusted return',col:'v-cyan'},
    {icon:'🎯',lbl:'Expectancy/Trade',val:fmtRp(stats.total?stats.netPnl/stats.total:0),sub:'Average per trade',col:'v-green'},
    {icon:'💎',lbl:'Best Single Trade',val:fmtRp(trades.length?Math.max(...trades.map(t=>t.pnlRp)):0),sub:'Profit terbesar',col:'v-gold'},
    {icon:'🔥',lbl:'Total Volume',val:trades.reduce((s,t)=>s+t.lot,0).toFixed(4)+' lot',sub:'Lots traded total',col:'v-blue'},
  ];
  document.getElementById('analysisMetrics').innerHTML=metricsData.map(m=>`<div class="metric-card"><div class="mc-icon">${m.icon}</div><div class="mc-lbl">${m.lbl}</div><div class="mc-val ${m.col}">${m.val}</div><div class="mc-sub">${m.sub}</div></div>`).join('');
  document.getElementById('streakGrid').innerHTML=trades.map((t,i)=>`<div class="streak-dot ${t.result==='WIN'?'streak-win':'streak-loss'}" title="T${i+1}: ${t.result} ${fmtRp(t.pnlRp)}"></div>`).join('');
  // Equity
  let cum2=modal;const eqPts=[{x:'Start',y:modal}];
  trades.forEach(t=>{cum2+=t.pnlRp;eqPts.push({x:t.date.slice(5,10),y:cum2});});
  if(!APP.charts.anEquity){
    const ctx=document.getElementById('an-equity').getContext('2d');
    APP.charts.anEquity=new Chart(ctx,{type:'line',data:{labels:eqPts.map(p=>p.x),datasets:[{label:'Equity',data:eqPts.map(p=>p.y),borderColor:'#10b981',backgroundColor:(c)=>{const g=c.chart.ctx.createLinearGradient(0,0,0,300);g.addColorStop(0,'rgba(16,185,129,.22)');g.addColorStop(1,'rgba(16,185,129,.01)');return g;},borderWidth:2.5,fill:true,tension:0.35,pointRadius:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e293b',borderWidth:1,borderColor:'rgba(255,255,255,.08)',callbacks:{label:c=>' Eq: Rp '+fmt(c.raw)}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},maxTicksLimit:10}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},callback:v=>'Rp '+(v/1000000).toFixed(2)+'M'}}}}});
  }else{APP.charts.anEquity.data.labels=eqPts.map(p=>p.x);APP.charts.anEquity.data.datasets[0].data=eqPts.map(p=>p.y);APP.charts.anEquity.update();}
  // Dist
  const bins=[[-Infinity,-500000],[-500000,-250000],[-250000,0],[0,250000],[250000,500000],[500000,1000000],[1000000,Infinity]];
  const bLabels=['<-500k','-500~-250k','-250k~0','0~250k','250k~500k','500k~1M','>1M'];
  const bColors=['#7f1d1d','#dc2626','#f87171','#10b981','#059669','#047857','#065f46'];
  const counts=bins.map(([lo,hi])=>trades.filter(t=>t.pnlRp>=lo&&t.pnlRp<hi).length);
  if(!APP.charts.anDist){const ctx2=document.getElementById('an-dist').getContext('2d');APP.charts.anDist=new Chart(ctx2,{type:'bar',data:{labels:bLabels,datasets:[{data:counts,backgroundColor:bColors,borderWidth:0,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} trade`}}},scales:{x:{grid:{display:false},ticks:{color:'#4a5568',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},stepSize:2}}}}});}
  else{APP.charts.anDist.data.datasets[0].data=counts;APP.charts.anDist.update();}
  const [bW2,sW,sL,bL2]=[trades.filter(t=>t.pnlRp>500000).length,trades.filter(t=>t.pnlRp>0&&t.pnlRp<=500000).length,trades.filter(t=>t.pnlRp<0&&t.pnlRp>=-250000).length,trades.filter(t=>t.pnlRp<-250000).length];
  const mx=Math.max(bW2,sW,sL,bL2,1);
  document.getElementById('an-dist-bars').innerHTML=[{lbl:'>500k',cnt:bW2,col:'linear-gradient(90deg,#059669,#10b981)',vc:'var(--c-green2)'},{lbl:'0~500k',cnt:sW,col:'linear-gradient(90deg,#065f46,#10b981)',vc:'var(--c-green2)'},{lbl:'-250k~0',cnt:sL,col:'linear-gradient(90deg,#dc2626,#ef4444)',vc:'var(--c-red2)'},{lbl:'<-250k',cnt:bL2,col:'linear-gradient(90deg,#7f1d1d,#dc2626)',vc:'var(--c-red2)'}].map(r=>`<div class="dist-row"><div class="dist-lbl">${r.lbl}</div><div class="dist-bg"><div class="dist-fill" style="width:${(r.cnt/mx*100).toFixed(0)}%;background:${r.col}"></div></div><div class="dist-val" style="color:${r.vc}">${r.cnt} trade</div></div>`).join('');
  // Setup bars
  const sm={};trades.forEach(t=>{getSetupArr(t).forEach(s=>{if(!s)return;if(!sm[s])sm[s]={win:0,total:0};sm[s].total++;if(t.result==='WIN')sm[s].win++;});});
  const setups=Object.entries(sm).sort((a,b)=>b[1].total-a[1].total);
  document.getElementById('an-setup-bars').innerHTML=setups.length?setups.map(([nm,d])=>{const wr=d.total?d.win/d.total*100:0;return`<div class="dist-row"><div class="dist-lbl">${nm}</div><div class="dist-bg"><div class="dist-fill" style="width:${wr.toFixed(0)}%;background:linear-gradient(90deg,var(--c-blue),var(--c-cyan))"></div></div><div class="dist-val v-blue">${fmtPct(wr)}</div></div>`;}).join(''):'<div style="color:var(--txt2);font-size:11px;padding:8px 0;">Belum ada data setup.</div>';
  // Day chart
  const dm={1:0,2:1,3:2,4:3,5:4,6:5,0:6};const dp=Array(7).fill(0);
  trades.forEach(t=>{dp[dm[new Date(t.date).getDay()]]+=t.pnlRp;});
  const dLabels=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  if(!APP.charts.anDay){const ctx3=document.getElementById('an-day').getContext('2d');APP.charts.anDay=new Chart(ctx3,{type:'bar',data:{labels:dLabels,datasets:[{data:dp,backgroundColor:dp.map(v=>v>=0?'rgba(16,185,129,.55)':'rgba(239,68,68,.55)'),borderColor:dp.map(v=>v>=0?'#10b981':'#ef4444'),borderWidth:1.5,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' Rp '+fmt(c.raw)}}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:9}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},callback:v=>'Rp '+fmt(v)}}}}});}
  else{APP.charts.anDay.data.datasets[0].data=dp;APP.charts.anDay.data.datasets[0].backgroundColor=dp.map(v=>v>=0?'rgba(16,185,129,.55)':'rgba(239,68,68,.55)');APP.charts.anDay.data.datasets[0].borderColor=dp.map(v=>v>=0?'#10b981':'#ef4444');APP.charts.anDay.update();}
  // Drawdown
  let peak3=modal,eq3=modal;const ddPts=[0];
  trades.forEach(t=>{eq3+=t.pnlRp;if(eq3>peak3)peak3=eq3;ddPts.push(Math.min(0,eq3-peak3));});
  if(!APP.charts.anDD){const ctx4=document.getElementById('an-drawdown').getContext('2d');APP.charts.anDD=new Chart(ctx4,{type:'line',data:{labels:Array.from({length:ddPts.length},(_,i)=>i===0?'Start':'T'+i),datasets:[{data:ddPts,borderColor:'#ef4444',backgroundColor:(c)=>{const g=c.chart.ctx.createLinearGradient(0,0,0,280);g.addColorStop(0,'rgba(239,68,68,.35)');g.addColorStop(1,'rgba(239,68,68,.01)');return g;},borderWidth:2,fill:true,tension:0.3,pointRadius:1.5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e293b',borderWidth:1,borderColor:'rgba(255,255,255,.08)',callbacks:{label:c=>' DD: -Rp '+fmt(Math.abs(c.raw))}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},maxTicksLimit:10}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5568',font:{size:9},callback:v=>'-Rp '+fmt(Math.abs(v))}}}}});}
  else{const len=ddPts.length;APP.charts.anDD.data.labels=Array.from({length:len},(_,i)=>i===0?'Start':'T'+i);APP.charts.anDD.data.datasets[0].data=ddPts;APP.charts.anDD.update();}
  renderCalendar();
}

function renderCalendar(){
  const mNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const mIdx=mNames.indexOf(document.getElementById('calMonth')?.value);
  const yr=parseInt(document.getElementById('calYear')?.value)||2026;
  const mi=mIdx>=0?mIdx:2;
  const trades=getFilteredTrades();
  const tbd={};
  trades.forEach(t=>{const dt=t.date.slice(0,10);if(!tbd[dt])tbd[dt]={pnl:0,count:0};tbd[dt].pnl+=t.pnlRp;tbd[dt].count++;});
  const grid=document.getElementById('calendarGrid');
  const dHds=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  let h=dHds.map(d=>`<div class="cal-hd">${d}</div>`).join('');
  const fd=new Date(yr,mi,1).getDay();
  const offset=fd===0?6:fd-1;
  const dim=new Date(yr,mi+1,0).getDate();
  for(let i=0;i<offset;i++)h+=`<div class="cal-day cal-empty"></div>`;
  for(let d=1;d<=dim;d++){
    const ds=`${yr}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const data=tbd[ds];
    if(data){h+=`<div class="cal-day ${data.pnl>=0?'cal-win':'cal-loss'}"><div class="cal-num">${d}</div><div class="cal-pnl ${data.pnl>=0?'v-green':'v-red'}">${data.pnl>=0?'+':''}${(data.pnl/1000).toFixed(0)}k</div><div style="font-size:9px;color:var(--txt2);">${data.count}T</div></div>`;}
    else h+=`<div class="cal-day"><div class="cal-num" style="color:var(--txt2)">${d}</div></div>`;
  }
  grid.innerHTML=h;
}

// SETTINGS
