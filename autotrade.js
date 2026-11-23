/* =====================================================================
   autotrade.js - BOT TRADING (paper trading, uang virtual). TANPA Firebase / Firestore / server.
   Seluruh bot jalan di browser: data pasar dari DexScreener (publik, tanpa API key), state disimpan di localStorage.
   Bot bekerja selama halaman web terbuka (tab boleh di-background; panel boleh ditutup). Tab ditutup = bot berhenti.
   ===================================================================== */
(()=>{
'use strict';
if(window.WDBot)return;
const MAXPOS=20,KEY='wdbot2',START=100000000;
const MODES=[[2,'Gas','Umur ≤ 6 jam, likuiditas ≥ $3rb, skor ≥ 3. Buang hanya honeypot / dump'],[1,'Agresif','Umur ≤ 24 jam, skor ≥ 5, likuiditas ≥ $8rb'],[0,'Ketat','Umur ≤ 3 hari, skor ≥ 6,5 tanpa tanda risiko, likuiditas ≥ $15rb']];
const NETS=[['solana','Solana · pump.fun'],['base','Base'],['bsc','BSC']];
let ST=null,isOpen=false,err='',tick=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const rp=v=>(v<0?'-':'')+'Rp '+Math.abs(v).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const sr=v=>(v>=0?'+':'')+rp(v),sg=v=>(v>=0?'+':'')+v.toFixed(2)+'%',cl=v=>v>=0?'bt-up':'bt-dn';
const fpm=p=>!(p>0)?'—':p>=1?'$'+p.toLocaleString('en-US',{maximumFractionDigits:4}):'$'+p.toFixed(Math.min(12,Math.ceil(-Math.log10(p))+3));
const ago=t=>{const s=Math.max(0,(Date.now()-t)/1e3);return s<60?Math.floor(s)+' dtk':s<3600?Math.floor(s/60)+' mnt':(s/3600).toFixed(1)+' jam'};
const hm=t=>new Date(t).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
const WHY={TP:['TP','up'],TRAIL:['Trailing','up'],BE:['Impas','n'],SL:['Stop loss','dn'],RUG:['Rug / likuid. turun','dn'],TIME:['Time-stop','n'],NOFEED:['Harga hilang','dn']};

/* ---------- gaya ---------- */
const css=document.createElement('style');
css.textContent=`
.bt-open{white-space:nowrap}
#bt .scr-in{max-width:1240px}
.bt-up{color:#2ee59d}.bt-dn{color:#ff5c6c}
.bt-hero{position:sticky;top:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 14px;padding:14px 18px;border:1px solid var(--line);border-radius:22px;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.bt-sw{display:flex;align-items:center;gap:14px}
.bt-sw>button{position:relative;width:64px;height:36px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.08);flex-shrink:0;transition:background .25s,border-color .25s}
.bt-sw>button span{position:absolute;top:3px;left:3px;width:28px;height:28px;border-radius:50%;background:#fff;transition:transform .25s}
.bt-sw>button[aria-checked=true]{background:#2ee59d;border-color:#2ee59d}
.bt-sw>button[aria-checked=true] span{transform:translateX(28px);background:#000}
.bt-sw>button:disabled{opacity:.5}
.bt-sw b{display:block;font-size:1.05rem;font-weight:600;letter-spacing:.02em}
.bt-sw small{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:.78rem;margin-top:2px}
.bt-dot{width:8px;height:8px;border-radius:50%;background:#888;flex-shrink:0}.bt-dot.on{background:#2ee59d;box-shadow:0 0 0 4px rgba(46,229,157,.18)}.bt-dot.off{background:#ff5c6c}
.bt-eq{text-align:right}.bt-eq small{display:block;color:var(--muted);font-size:.76rem}
.bt-eq b{transition:color .5s;display:block;font-size:clamp(1.4rem,5vw,2rem);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.bt-chip{display:inline-block;margin-top:2px;padding:3px 12px;border-radius:999px;font-size:.84rem;font-variant-numeric:tabular-nums;background:rgba(255,255,255,.08)}
.bt-alert{border:1px solid rgba(255,209,102,.45);background:rgba(255,209,102,.07);color:#ffd166;border-radius:18px;padding:14px 18px;margin:0 0 14px;font-size:.86rem;line-height:1.6}
.bt-alert b{color:#fff;font-weight:500}.bt-alert code{background:rgba(255,255,255,.1);padding:1px 7px;border-radius:6px;color:#fff;font-size:.8rem}
.bt-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:0 0 18px}
.bt-st{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04);padding:13px 15px;min-width:0}
.bt-st small{display:block;color:var(--muted);font-size:.74rem;margin-bottom:2px}
.bt-st b{display:block;font-size:1rem;font-weight:600;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:start}
.bt-col{display:flex;flex-direction:column;gap:16px;min-width:0}
.bt-card{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.04);padding:16px;min-width:0}
.bt-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px}
.bt-hd h3{font-size:1.02rem;font-weight:500}.bt-hd small{color:var(--muted);font-size:.8rem}
.bt-lbl{display:block;color:var(--muted);font-size:.76rem;margin:14px 0 7px}.bt-lbl:first-of-type{margin-top:0}
.bt-seg{display:flex;gap:6px;flex-wrap:wrap}
.bt-seg button{height:38px;padding:0 15px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:.84rem;transition:.2s}
.bt-seg button:hover{color:#fff}
.bt-seg button[aria-pressed=true]{color:#2ee59d;background:rgba(46,229,157,.1);border-color:#2ee59d;font-weight:500}
.bt-hint{color:var(--muted);font-size:.78rem;line-height:1.5;margin:8px 0 0}
.bt-list{display:flex;flex-direction:column;gap:12px}
.bt-pos{border:1px solid var(--line);border-left:3px solid #2ee59d;border-radius:20px;background:rgba(255,255,255,.04);padding:14px 16px;min-width:0}
.bt-pos.neg{border-left-color:#ff5c6c}
.bt-ph{display:flex;align-items:center;gap:12px}
.bt-ph .av{width:40px;height:40px;font-size:.9rem}
.bt-pn{flex:1;min-width:0}.bt-pn b{font-size:1rem;font-weight:600}
.bt-pn small{display:block;color:var(--muted);font-size:.74rem;margin-top:1px}
.bt-tag{display:inline-block;font-size:.66rem;padding:1px 8px;border-radius:999px;border:1px solid var(--line);margin-left:7px;color:var(--muted);vertical-align:middle}
.bt-pr{text-align:right;flex-shrink:0}.bt-pr b{display:block;font-size:1rem;font-variant-numeric:tabular-nums}.bt-pr small{font-size:.78rem;font-variant-numeric:tabular-nums}
.bt-bar{position:relative;height:8px;border-radius:8px;background:linear-gradient(90deg,rgba(255,92,108,.5),rgba(255,255,255,.1) 40%,rgba(46,229,157,.5));margin:16px 6px 24px}
.bt-bar i{position:absolute;top:-3px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #000;box-shadow:0 0 0 1px rgba(255,255,255,.6);transform:translateX(-7px);transition:left .4s}
.bt-bar s{position:absolute;top:-3px;width:2px;height:14px;background:rgba(255,255,255,.7);text-decoration:none}
.bt-bar em{position:absolute;top:15px;font-style:normal;font-size:.64rem;color:var(--muted);transform:translateX(-50%);white-space:nowrap}
.bt-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bt-tiles div{padding:7px 10px;border:1px solid var(--line);border-radius:12px;min-width:0}
.bt-tiles small{display:block;color:var(--muted);font-size:.66rem}.bt-tiles b{display:block;font-size:.8rem;font-weight:500;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-empty{border:1px dashed var(--line);border-radius:22px;padding:28px 18px;text-align:center;color:var(--muted);font-size:.9rem;line-height:1.6}
.bt-eqc svg{width:100%;height:130px;display:block}
.bt-rows{display:flex;flex-direction:column;max-height:420px;overflow-y:auto;margin:0 -4px;padding:0 4px;-webkit-overflow-scrolling:touch}
.bt-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)}
.bt-row:first-child{border-top:0}
.bt-row b{font-weight:500;font-size:.88rem}.bt-row small{display:block;color:var(--muted);font-size:.74rem;margin-top:1px}
.bt-row .r{text-align:right;font-variant-numeric:tabular-nums;flex-shrink:0}
.bt-b{font-size:.66rem;padding:1px 8px;border-radius:999px;border:1px solid var(--line);margin-left:6px;color:var(--muted)}
.bt-b.up{color:#2ee59d;border-color:rgba(46,229,157,.5)}.bt-b.dn{color:#ff5c6c;border-color:rgba(255,92,108,.5)}
.bt-ev{font-size:.8rem;line-height:1.55;color:var(--muted);padding:3px 0}.bt-ev b{color:#fff;font-weight:500}.bt-ev time{color:#777;margin-right:8px;font-variant-numeric:tabular-nums}
.bt-scan{font-size:.78rem;color:var(--muted);margin:0 0 8px;line-height:1.5}
.bt-note{color:var(--muted);font-size:.78rem;line-height:1.65;margin-top:22px;max-width:92ch}.bt-note b{color:#fff;font-weight:500}
@media(max-width:1000px){.bt-grid{grid-template-columns:1fr}.bt-stats{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.bt-hero{padding:12px 14px;border-radius:18px;top:6px}.bt-stats{grid-template-columns:repeat(2,1fr)}.bt-tiles{grid-template-columns:repeat(2,1fr)}.bt-card,.bt-pos{padding:14px}.bt-eq{text-align:left}}`;
document.head.append(css);

/* ---------- kerangka panel ---------- */
const root=document.createElement('div');root.id='bt';root.className='scr';root.hidden=true;
root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Bot Trading');
root.innerHTML=`<div class="scr-in">
<div class="scr-top"><div><p class="btc-tag"><i class="live"></i>Bot Trading · jalan di browser · uang virtual</p><h2>Auto Trade Bot</h2></div><button class="scr-x" id="btX" type="button" aria-label="Tutup">&times;</button></div>
<div class="bt-hero">
 <div class="bt-sw"><button id="btSw" type="button" role="switch" aria-checked="false" aria-label="Auto trade"><span></span></button>
  <div><b id="btSwT">AUTO TRADE: OFF</b><small><i class="bt-dot" id="btDot"></i><span id="btConn">Siap</span></small></div></div>
 <div class="bt-eq"><small>Ekuitas bot (live)</small><b id="btEq">—</b><span class="bt-chip" id="btPl">—</span></div>
</div>
<div id="btAl"></div>
<div class="bt-stats" id="btStats"></div>
<div class="bt-grid">
 <div class="bt-col"><div><div class="bt-hd"><h3>Posisi aktif</h3><small id="btNp"></small></div><div class="bt-list" id="btPos"></div></div></div>
 <div class="bt-col">
  <div class="bt-card"><div class="bt-hd"><h3>Pengaturan</h3></div>
   <span class="bt-lbl">Mode filter</span><div class="bt-seg" id="btMode"></div><p class="bt-hint" id="btModeH"></p>
   <span class="bt-lbl">Modal per trade (dari ekuitas)</span><div class="bt-seg" id="btPct"><button type="button" data-p="5">5%</button><button type="button" data-p="10">10%</button><button type="button" data-p="20">20%</button></div>
   <p class="bt-hint">Bot memegang maks ${MAXPOS} posisi (8 per jaringan). Pakai 5% agar 20 posisi muat.</p>
   <span class="bt-lbl">Jaringan yang dipindai</span><div class="bt-seg" id="btNets"></div>
   <button type="button" id="btRst" class="bt-open btn btn-ghost btn-sm" style="margin-top:16px">Reset simulasi</button></div>
  <div class="bt-card"><div class="bt-hd"><h3>Grafik ekuitas</h3><small id="btEqN"></small></div><div class="bt-eqc" id="btEqc"></div></div>
  <div class="bt-card"><div class="bt-hd"><h3>Aktivitas bot</h3></div><p class="bt-scan" id="btScan"></p><div class="bt-rows" id="btEv"></div></div>
  <div class="bt-card"><div class="bt-hd"><h3>Riwayat trade</h3></div><div class="bt-rows" id="btHist"></div></div>
 </div>
</div>
<p class="bt-note"><b>Cara kerja.</b> Bot berjalan <b>di browser ini</b> (tanpa server dan tanpa database): data harga dari DexScreener, saldo dan riwayat tersimpan di perangkat. Bot hanya bekerja <b>selama halaman web terbuka</b>; panel boleh ditutup. Setiap ±60 detik bot memindai koin baru (Solana/pump.fun, Base, BSC), menilai skor 0–10 dari likuiditas, volume, tekanan beli dan momentum, lalu masuk LONG sebesar modal per trade. Keluar otomatis: <b>SL −20%</b>; saat naik +20% SL pindah ke titik impas; saat +30% <b>trailing 15%</b> dari puncak; <b>TP +50%</b>; <b>time-stop 90 mnt</b>; keluar darurat bila likuiditas turun &gt; 50%. Pengaman: bot OFF otomatis bila rugi harian mencapai 10%, dan jeda 30 mnt setelah 3 SL beruntun. Ini <b>akun simulasi dengan uang virtual</b>, tanpa fee dan slippage, jadi hasil nyata akan lebih buruk. Token baru sangat berisiko (rug pull, honeypot). Bukan saran investasi.</p>
</div>`;
document.body.append(root);
$('btMode').innerHTML=MODES.map(m=>`<button type="button" data-m="${m[0]}">${m[1]}</button>`).join('');
$('btNets').innerHTML=NETS.map(n=>`<button type="button" data-n="${n[0]}">${n[1]}</button>`).join('');

/* ---------- angka ekuitas bergerak halus ---------- */
let tgt=null,disp=null,raf=0,flashT=0;
function renderNum(){const pl=disp-ST.start;$('btEq').textContent=rp(disp);$('btPl').textContent=sr(pl)+' ('+sg(pl/ST.start*100)+')';$('btPl').className='bt-chip '+cl(pl)}
function frame(){raf=0;if(!isOpen)return;const d=tgt-disp;disp=Math.abs(d)<.005?tgt:disp+d*.12;renderNum();if(disp!==tgt)raf=requestAnimationFrame(frame)}
function setTgt(v){const prev=tgt==null?v:tgt;tgt=v;if(disp==null)disp=v;
  if(Math.abs(v-prev)>.004){const e=$('btEq');e.style.color=v>=prev?'#2ee59d':'#ff5c6c';clearTimeout(flashT);flashT=setTimeout(()=>{e.style.color=''},900)}
  if(Math.abs(v-disp)>.004){if(!raf)raf=requestAnimationFrame(frame)}else{disp=v;renderNum()}}

/* ---------- render ---------- */
const cfg=()=>ST;
function av(p){const L=esc((p.sym||'?')[0].toUpperCase()),u=`https://dd.dexscreener.com/ds-data/tokens/${p.ch}/${p.a}.png`;
  return `<div class="av" data-l="${L}" data-ch="${esc(p.ch)}" data-tok="${esc(p.a)}"><span class="lt">${L}</span><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`}
function posHtml(p){
  const r=p.px/p.ep-1,pl=p.cost*r,lo=p.sl,hi=p.tp,at=v=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100)).toFixed(1);
  return `<article class="bt-pos${r<0?' neg':''}"><div class="bt-ph">${av(p)}<div class="bt-pn"><b>${esc(p.sym)}</b><span class="bt-tag">${p.ch==='solana'&&/^pump/.test(p.dex||'')?'pump.fun':esc(p.ch)}</span><small>umur ${ago(p.t)} · skor ${p.sc||'—'}/10 · modal ${rp(p.cost)}</small></div>
  <div class="bt-pr"><b class="${cl(pl)}">${sr(pl)}</b><small class="${cl(r)}">${sg(r*100)}</small></div></div>
  <div class="bt-bar"><i style="left:${at(p.px)}%"></i><s style="left:${at(p.ep)}%"></s><em style="left:0">SL</em><em style="left:${at(p.ep)}%">Entry</em><em style="left:100%">TP</em></div>
  <div class="bt-tiles"><div><small>Entry</small><b>${fpm(p.ep)}</b></div><div><small>Sekarang</small><b>${fpm(p.px)}</b></div><div><small>Stop (trailing)</small><b class="bt-dn">${fpm(p.sl)}</b></div><div><small>Take profit</small><b class="bt-up">${fpm(p.tp)}</b></div></div></article>`}
function eqSvg(){
  const d=ST.eq||[];if(d.length<2)return '<p class="bt-hint">Grafik terbentuk seiring waktu (1 titik per 10 detik).</p>';
  const W=320,H=120,vs=d.map(x=>x.v).concat(ST.start);let mn=Math.min(...vs),mx=Math.max(...vs);const pd=(mx-mn)*.12||mx*.001;mn-=pd;mx+=pd;
  const t0=d[0].t,sp=d[d.length-1].t-t0||1,X=t=>(t-t0)/sp*W,Y=v=>H-(v-mn)/(mx-mn)*H,up=d[d.length-1].v>=ST.start,c=up?'#2ee59d':'#ff5c6c';
  const ln=d.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Grafik ekuitas"><defs><linearGradient id="btg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><line x1="0" x2="${W}" y1="${Y(ST.start).toFixed(1)}" y2="${Y(ST.start).toFixed(1)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><path d="${ln}L${W} ${H}L0 ${H}Z" fill="url(#btg)"/><path d="${ln}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`}
function paint(){
  const c=cfg(),on=!!c.on;
  $('btSw').setAttribute('aria-checked',on);$('btSwT').textContent=on?'AUTO TRADE: ON':'AUTO TRADE: OFF';$('btSwT').style.color=on?'#2ee59d':'';
    $('btDot').className='bt-dot '+(err?'off':on?'on':'');
  $('btConn').textContent=err?'Gangguan data':on?(ST.ts?'Bot aktif · update '+ago(ST.ts)+' lalu':'Bot aktif'):'Bot OFF';
  $('btAl').innerHTML=err?`<div class="bt-alert"><b>${esc(err)}</b> Bot mencoba lagi otomatis. Posisi yang terbuka tidak dijual sampai harga berhasil diambil.</div>`:'';
  $('btMode').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.m===c.agg));
  $('btModeH').textContent=(MODES.find(m=>m[0]===c.agg)||MODES[0])[2];
  $('btPct').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.p===c.pct));
  $('btNets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',c.nets.includes(b.dataset.n)));
  if(!ST){$('btStats').innerHTML='';$('btPos').innerHTML='<div class="bt-empty">Menunggu data dari server…</div>';return}
  const eq=ST.eqNow||ST.cash,pl=eq-ST.start,np=Object.keys(ST.pos||{}).length,wr=ST.n?Math.round(ST.w/ST.n*100)+'%':'—',day=eq-(ST.dayEq||ST.start);
  setTgt(eq);
  $('btStats').innerHTML=[['PnL total',sr(pl),cl(pl)],['PnL hari ini',sr(day),cl(day)],['PnL terealisasi',ST.n?sr(ST.rl):'—',ST.n?cl(ST.rl):''],['Win rate',wr+(ST.n?` (${ST.w}/${ST.n})`:''),''],['Posisi aktif',np+' / '+MAXPOS,''],['Saldo tunai',rp(ST.cash),'']]
    .map(s=>`<div class="bt-st"><small>${s[0]}</small><b class="${s[2]}">${s[1]}</b></div>`).join('');
  const ps=Object.values(ST.pos||{}).sort((a,b)=>b.t-a.t);$('btNp').textContent=np?np+' posisi':'';
  $('btPos').innerHTML=ps.length?ps.map(posHtml).join(''):`<div class="bt-empty">Belum ada posisi.<br>${on?'Bot sedang memindai pool baru…':'Nyalakan <b>Auto Trade</b> untuk mulai.'}</div>`;
  $('btEqc').innerHTML=eqSvg();$('btEqN').textContent=ST.eq&&ST.eq.length>1?'modal awal '+rp(ST.start):'';
  $('btScan').textContent=on&&ST.scan?'Scan terakhir: '+ST.scan:on?'':'Bot OFF. Posisi yang masih terbuka tetap dipantau TP/SL.';
  $('btEv').innerHTML=(ST.evt||[]).length?ST.evt.slice(0,20).map(e=>`<div class="bt-ev"><time>${hm(e.t)}</time>${e.m}</div>`).join(''):'<p class="bt-hint">Belum ada aktivitas.</p>';
  $('btHist').innerHTML=(ST.hist||[]).length?ST.hist.slice(0,40).map(h=>{const w=WHY[h.why]||[h.why,'n'];
    return `<div class="bt-row"><div><b>${esc(h.sym)}<span class="bt-b ${w[1]}">${esc(w[0])}</span></b><small>${new Date(h.t).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${h.hold} mnt · ${esc(h.ch)}</small></div><div class="r"><b class="${cl(h.pnl)}">${sr(h.pnl)}</b><small>${sg(h.pct)}</small></div></div>`}).join(''):'<p class="bt-hint">Belum ada trade selesai.</p>'}

/* ---------- penyimpanan lokal ---------- */
const fresh=()=>({on:0,agg:2,pct:5,nets:NETS.map(n=>n[0]),start:START,cash:START,eqNow:START,pos:{},hist:[],evt:[],eq:[],n:0,w:0,rl:0,sls:0,pauseUntil:0,seen:{},day:'',dayEq:START,ts:0,scan:''});
function load(){try{const j=JSON.parse(localStorage.getItem(KEY)||'null');if(j&&j.pos&&typeof j.cash==='number')return Object.assign(fresh(),j)}catch(e){}return fresh()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ST))}catch(e){}}
ST=load();
const equity=()=>Object.values(ST.pos).reduce((a,p)=>a+p.cost*(p.px/p.ep),ST.cash);
const ev=m=>{ST.evt.unshift({t:Date.now(),m});if(ST.evt.length>50)ST.evt.length=50};

/* ---------- data pasar (DexScreener, publik) ---------- */
const DX='https://api.dexscreener.com/',key=(ch,a)=>ch+':'+String(a).toLowerCase();
let cool=0;
async function jget(u){
  if(Date.now()<cool)throw new Error('Rate limit, menunggu sebentar');
  const c=new AbortController(),to=setTimeout(()=>c.abort(),10000);
  try{const r=await fetch(u,{signal:c.signal,cache:'no-store'});
    if(r.status===429){cool=Date.now()+30000;throw new Error('Terlalu banyak permintaan (429)')}
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json()}
  catch(e){throw e.name==='AbortError'?new Error('Koneksi timeout'):e}
  finally{clearTimeout(to)}}
const liqOf=p=>(p.liquidity&&p.liquidity.usd)||0;
async function pairsFor(addrs){
  const m=new Map(),u=[...new Set(addrs)];
  for(let i=0;i<u.length;i+=30){
    const j=await jget(DX+'latest/dex/tokens/'+u.slice(i,i+30).map(encodeURIComponent).join(','));
    (j.pairs||[]).forEach(p=>{const b=p.baseToken;if(!b||!b.address||!(+p.priceUsd>0))return;
      const k=key(p.chainId,b.address),o=m.get(k);if(!o||liqOf(p)>liqOf(o))m.set(k,p)})}
  return m}

/* ---------- penilaian koin ---------- */
const RULE={2:{age:360,liq:3000,sc:3,strict:0},1:{age:1440,liq:8000,sc:5,strict:0},0:{age:4320,liq:15000,sc:6.5,strict:1}};
function judge(p,agg){
  const R=RULE[agg]||RULE[2],now=Date.now(),age=p.pairCreatedAt?(now-p.pairCreatedAt)/60000:-1,liq=liqOf(p),
    v1=(p.volume&&p.volume.h1)||0,t1=(p.txns&&p.txns.h1)||{buys:0,sells:0},b=t1.buys||0,sl=t1.sells||0,tt=b+sl,
    c5=(p.priceChange&&p.priceChange.m5)||0,c1=(p.priceChange&&p.priceChange.h1)||0,fdv=p.fdv||0;
  if(age<1||age>R.age)return{ok:0};
  if(liq<R.liq)return{ok:0};
  const honey=b>=15&&sl===0,dump=(tt>=20&&sl>b*2.5)||c1<-40||c5<-10,risk=(liq>0&&fdv/liq>300)||c5<-5;
  if(honey||dump||(R.strict&&risk))return{ok:0};
  let sc=0;
  sc+=liq>=50000?2:liq>=15000?1.5:liq>=8000?1:liq>=3000?.5:0;
  const r=liq?v1/liq:0;sc+=r>=2?2:r>=.7?1.5:r>=.2?1:r>=.05?.5:0;
  const bp=tt?b/tt:0;if(tt>=10)sc+=bp>=.6?2:bp>=.52?1:bp>=.45?.5:0;
  sc+=c5>0&&c1>0?2:(c5>0||c1>0)?1:0;if(c1>300)sc-=1;
  sc+=tt>=200?1:tt>=50?.5:0;
  sc+=age>=5&&age<=180?1:age<=720?.5:0;
  sc=Math.max(0,Math.min(10,Math.round(sc*10)/10));
  return{ok:sc>=R.sc,sc}}

/* ---------- eksekusi trade (virtual) ---------- */
function enter(k,pr,sc){
  const ps=Object.values(ST.pos);
  if(ps.length>=MAXPOS||ps.filter(p=>p.ch===pr.chainId).length>=8)return 0;
  const cost=equity()*ST.pct/100;if(!(cost>0)||ST.cash<cost)return 0;
  const px=+pr.priceUsd,sym=String(pr.baseToken.symbol||'?').slice(0,14);
  ST.cash-=cost;
  ST.pos[k]={id:k,sym,a:pr.baseToken.address,ch:pr.chainId,dex:pr.dexId||'',t:Date.now(),ep:px,px,peak:px,sl:px*.8,tp:px*1.5,cost,sc,liq0:liqOf(pr),liq:liqOf(pr),miss:0};
  ST.seen[k]=Date.now()+6*36e5;
  ev(`Beli <b>${esc(sym)}</b> (${esc(pr.chainId)}) · skor ${sc} · modal ${rp(cost)}`);return 1}
function exit(p,why){
  const val=p.cost*(p.px/p.ep),pnl=val-p.cost;
  ST.cash+=val;delete ST.pos[p.id];ST.n++;if(pnl>0)ST.w++;ST.rl+=pnl;
  ST.hist.unshift({sym:p.sym,ch:p.ch,t:Date.now(),why,pnl,pct:(p.px/p.ep-1)*100,hold:Math.round((Date.now()-p.t)/60000)});
  if(ST.hist.length>100)ST.hist.length=100;
  ev(`Jual <b>${esc(p.sym)}</b> · ${esc((WHY[why]||[why])[0])} · <span class="${cl(pnl)}">${sr(pnl)}</span>`);
  if(why==='SL'){if(++ST.sls>=3){ST.sls=0;ST.pauseUntil=Date.now()+30*6e4;ev('3 stop loss beruntun: jeda entri 30 menit')}}else if(pnl>0)ST.sls=0}
function manage(p){
  const r=p.px/p.ep;if(p.px>p.peak)p.peak=p.px;
  if(r>=1.2)p.sl=Math.max(p.sl,p.ep);
  if(p.peak/p.ep>=1.3){p.tr=1;p.sl=Math.max(p.sl,p.peak*.85)}
  let w=null;
  if(p.miss>=10)w='NOFEED';
  else if(p.liq0&&p.liq<p.liq0*.5)w='RUG';
  else if(p.px>=p.tp)w='TP';
  else if(p.px<=p.sl)w=p.tr?'TRAIL':p.sl>=p.ep?'BE':'SL';
  else if(Date.now()-p.t>=90*6e4)w='TIME';
  if(w)exit(p,w)}
async function updatePrices(){
  const ps=Object.values(ST.pos);if(!ps.length)return;
  const m=await pairsFor(ps.map(p=>p.a));
  ps.forEach(p=>{const pr=m.get(p.id);
    if(pr){p.px=+pr.priceUsd;p.liq=liqOf(pr);p.miss=0}else p.miss=(p.miss||0)+1;
    manage(p)})}
async function scan(){
  const t=Date.now();
  if(t<ST.pauseUntil){ST.scan=hm(t)+' · jeda sampai '+hm(ST.pauseUntil);return}
  if(Object.keys(ST.pos).length>=MAXPOS){ST.scan=hm(t)+' · posisi penuh ('+MAXPOS+')';return}
  for(const k in ST.seen)if(ST.seen[k]<t)delete ST.seen[k];
  const rs=await Promise.allSettled([jget(DX+'token-profiles/latest/v1'),jget(DX+'token-boosts/latest/v1')]);
  if(rs.every(r=>r.status==='rejected'))throw rs[0].reason;
  const seen=new Set(),use=[];
  rs.forEach(r=>{if(r.status==='fulfilled'&&Array.isArray(r.value))r.value.forEach(x=>{
    if(!x||!x.tokenAddress||!ST.nets.includes(x.chainId))return;
    const k=key(x.chainId,x.tokenAddress);if(seen.has(k)||ST.seen[k]||ST.pos[k])return;seen.add(k);use.push([k,x.tokenAddress])})});
  const L=use.slice(0,30);
  if(!L.length){ST.scan=hm(t)+' · belum ada koin baru';return}
  const m=await pairsFor(L.map(x=>x[1]));let buy=0;
  for(const [k] of L){ST.seen[k]=t+30*6e4;const pr=m.get(k);if(!pr)continue;
    const j=judge(pr,ST.agg);if(j.ok)buy+=enter(k,pr,j.sc)}
  ST.scan=hm(t)+' · '+L.length+' koin dinilai · '+buy+' dibeli'}

/* ---------- loop utama ---------- */
let busy=0,lastPx=0,lastScan=0,lastEq=0;
async function loop(){
  if(busy)return;
  if(!ST.on&&!Object.keys(ST.pos).length)return;   /* idle total: tidak ada permintaan jaringan */
  busy=1;const t=Date.now();let e='';
  try{
    const d=new Date().toDateString();if(ST.day!==d){ST.day=d;ST.dayEq=equity()}
    if(Object.keys(ST.pos).length&&t-lastPx>=4000){lastPx=t;try{await updatePrices()}catch(x){e=x.message||String(x)}}
    if(ST.on&&t-lastScan>=60000){lastScan=t;try{await scan()}catch(x){e=x.message||String(x)}}
    err=e;
    if(ST.on&&equity()<=ST.dayEq*.9){ST.on=0;ev('Rugi harian 10% tercapai: Auto Trade dimatikan otomatis')}
  }finally{
    ST.ts=Date.now();ST.eqNow=equity();
    if(ST.ts-lastEq>=10000){lastEq=ST.ts;ST.eq.push({t:ST.ts,v:ST.eqNow});if(ST.eq.length>1080)ST.eq.shift()}
    save();busy=0;if(isOpen)paint()}}
setInterval(loop,2000);
window.addEventListener('storage',e=>{if(e.key===KEY&&!busy){ST=load();if(isOpen)paint()}});   /* sinkron antar tab */
function send(o){
  if('on' in o){ev(o.on?'Auto Trade <b>ON</b>':'Auto Trade <b>OFF</b>');
    if(o.on){lastScan=0;lastPx=0;if(equity()<=ST.dayEq*.9)ST.dayEq=equity()}}
  Object.assign(ST,o);save();paint();loop()}
function reset(){
  if(!confirm('Reset saldo ke Rp 100.000.000 dan hapus semua posisi & riwayat?'))return;
  const k={agg:ST.agg,pct:ST.pct,nets:ST.nets};ST=Object.assign(fresh(),k);lastEq=0;err='';save();paint()}
if(ST.on||Object.keys(ST.pos).length)loop();

root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='btX')return close();
  if(b.id==='btSw')return send({on:ST.on?0:1});
  if(b.id==='btRst')return reset();
  if(b.dataset.m!=null)return send({agg:+b.dataset.m});
  if(b.dataset.p)return send({pct:+b.dataset.p});
  if(b.dataset.n){const c=cfg().nets,n=c.includes(b.dataset.n)?c.filter(x=>x!==b.dataset.n):c.concat(b.dataset.n);if(n.length)send({nets:n})}});

/* ---------- buka / tutup ---------- */
let prevOv='';
function open(){if(isOpen)return;isOpen=true;if(window.setMenu)window.setMenu(false);root.hidden=false;prevOv=document.body.style.overflow;document.body.style.overflow='hidden';paint();loop();tick=setInterval(()=>{if(!document.hidden)paint()},700)}
function close(){if(!isOpen)return;isOpen=false;root.hidden=true;document.body.style.overflow=prevOv;clearInterval(tick)}   /* tutup panel: bot tetap jalan di latar selama halaman terbuka */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen)close()});

/* tombol masuk: bar screener + tab Market (sebelah tombol Akun Demo) */
const ref=$('scrRef'),mt=$('mkTabs');
[[ref&&(b=>{(document.getElementById('dmOpen')||ref).after(b)}),'btOpen'],[mt&&(b=>mt.append(b)),'btTab']].forEach(([put,id])=>{if(!put)return;
  const b=document.createElement('button');b.type='button';b.id=id;b.className='bt-open'+(id==='btOpen'?' btn btn-ghost btn-sm':'');b.textContent='🤖 Bot Trading';put(b);b.onclick=open});
window.WDBot={open,close};
})();
