/* =====================================================================
   autotrade.js - BOT AUTO TRADE (AKUN DEMO / UANG VIRTUAL)
   Satu tombol ON/OFF di panel Akun Demo. Saat ON, bot memindai pool baru (pump.fun & Solana, Base, BSC) lewat
   GeckoTerminal, menilai pakai skor sniper yang sama dengan kartu screener, lalu otomatis entry LONG sebesar
   10% ekuitas. Keluar otomatis oleh mesin demo: SL -20%, TP +30% (posisi ditutup penuh), atau TIME-STOP 90 mnt.
   Bot hanya berjalan selama halaman terbuka. Tidak menyentuh dompet/uang asli. Ubah angka di CFG bila perlu.
   ===================================================================== */
(()=>{
'use strict';
const D=window.WDDemo&&window.WDDemo.bot,S=window.SNS;
if(!D||!S||window.__wdBot)return;window.__wdBot=1;
const CFG={sl:.20,tp1:.30,tp2:.50,maxPos:5,minLiq:15000,minAge:3,maxAge:180,holdMin:90,scanMs:12000,tries:3};
const NETS=[['solana','Solana · pump.fun'],['base','Base'],['bsc','BSC']];
const ADDR={solana:/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,base:/^0x[0-9a-fA-F]{40}$/,bsc:/^0x[0-9a-fA-F]{40}$/};
const KEY='wd_bot';
let B;try{B=JSON.parse(localStorage.getItem(KEY))}catch(e){}
B=Object.assign({on:0,pct:10,nets:['solana','base','bsc'],done:{},log:[]},B||{});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(B))}catch(e){}};
const getJ=async(u,ms=9000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};
const rp=v=>(v<0?'-':'')+'Rp '+Math.abs(Math.round(v)).toLocaleString('id-ID');
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const hm=t=>new Date(t).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const note=m=>{B.log.unshift({t:Date.now(),m});B.log.length=Math.min(B.log.length,6);save();paint()};

/* ---------- tampilan ---------- */
const css=document.createElement('style');
css.textContent=`.bt-go{height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--line);color:#fff;font-weight:600;font-size:.9rem;white-space:nowrap;transition:background .2s}
.bt-go.on{background:#2ee59d;border-color:#2ee59d;color:#000}
.bt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
.bt-row button{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line);color:var(--muted);font-size:.8rem}
.bt-row button[aria-pressed=true]{color:#2ee59d;border-color:#2ee59d;background:rgba(46,229,157,.1)}
.bt-lg{margin:10px 0 0;padding:0;list-style:none;color:var(--muted);font-size:.78rem;line-height:1.7}.bt-lg b{color:#fff;font-weight:500}`;
document.head.append(css);
const dm=document.getElementById('dm'),col=dm&&dm.querySelector('.dm-col'),run=dm&&dm.querySelector('.dm-run');
if(!col||!run)return;
const go=document.createElement('button');go.type='button';go.className='bt-go';go.id='btGo';
run.insertBefore(go,run.querySelector('.dm-chip'));
const card=document.createElement('div');card.className='dm-card';
card.innerHTML=`<div class="dm-hd"><h3 class="dm-h3">🤖 Auto Trade (demo)</h3><small id="btSt"></small></div>
<p class="dm-wr" style="margin:0">Bot membeli otomatis token baru yang <b>lolos filter sniper</b>, sebesar <b id="btP"></b> ekuitas per trade. Keluar otomatis di <b>SL −20%</b>, <b>TP +30%</b>, atau time-stop 90 menit. Maks ${CFG.maxPos} posisi bot.</p>
<div class="bt-row" id="btNets"></div>
<div class="bt-row" id="btPct"><small style="color:var(--muted)">Modal per trade:</small></div>
<ul class="bt-lg" id="btLg"></ul>`;
col.insertBefore(card,col.children[1]||null);
const $=id=>card.querySelector('#'+id);
$('btNets').innerHTML=NETS.map(n=>`<button type="button" data-n="${n[0]}">${n[1]}</button>`).join('');
$('btPct').insertAdjacentHTML('beforeend',[5,10,20].map(p=>`<button type="button" data-p="${p}">${p}%</button>`).join(''));
card.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.n){const n=b.dataset.n;B.nets=B.nets.includes(n)?B.nets.filter(x=>x!==n):B.nets.concat(n);save();paint()}
  if(b.dataset.p){B.pct=+b.dataset.p;save();paint()}});
go.onclick=()=>toggle();

function stats(){let n=0,w=0,p=0;D.A().hist.forEach(h=>{if(h.b&&h.s==='JUAL'){n++;p+=h.pnl;if(h.pnl>0)w++}});return{n,w,p}}
function paint(){
  go.textContent='🤖 Auto Trade: '+(B.on?'ON':'OFF');go.className='bt-go'+(B.on?' on':'');
  $('btP').textContent=B.pct+'%';
  card.querySelectorAll('[data-n]').forEach(b=>b.setAttribute('aria-pressed',B.nets.includes(b.dataset.n)));
  card.querySelectorAll('[data-p]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.p===B.pct));
  const A=D.A(),open=Object.values(A.pos).filter(q=>q.auto).length,s=stats();
  $('btSt').textContent=B.on?`aktif · ${open}/${CFG.maxPos} posisi`:'nonaktif';
  $('btLg').innerHTML=(s.n?`<li><b>${s.n}</b> trade selesai · menang <b>${Math.round(s.w/s.n*100)}%</b> · PnL bot <b style="color:${s.p>=0?'#2ee59d':'#ff5c6c'}">${rp(s.p)}</b></li>`:'')
    +B.log.map(l=>`<li>${hm(l.t)} · ${l.m}</li>`).join('')||'<li>Belum ada aktivitas. Tekan tombol Auto Trade untuk mulai.</li>'}

/* ---------- mesin bot ---------- */
let ni=0,busy=0,tm=0,wt=0;const tries={};
const key=(n,a)=>n==='solana'?a:a.toLowerCase();
async function scan(){
  if(busy||!B.on||!B.nets.length)return;busy=1;
  const net=B.nets[ni++%B.nets.length];
  try{
    const j=await getJ(`https://api.geckoterminal.com/api/v2/networks/${net}/new_pools?include=base_token&page=1`,10000),list=[];
    (j.data||[]).forEach(d=>{try{const x=S.gt(d);if(x&&x.t0&&x.p>0)list.push(x)}catch(e){}});
    for(const x of list.sort((a,b)=>S.score(b).sc-S.score(a).sc)){if(!B.on)break;if(await consider(net,x))break}
  }catch(e){if(B.on&&!/abort/i.test(String(e)))note('Data '+net+' belum bisa dimuat (rate limit?), mencoba lagi')}
  busy=0}
async function consider(net,x){
  if(!ADDR[net].test(x.tok||''))return;
  const k=key(net,x.tok),id='d:'+k,A=D.A(),age=(Date.now()-x.t0)/6e4;
  if(B.done[id]||A.pos[id]||(tries[id]||0)>=CFG.tries)return;
  const r=S.score(x);
  if(!r.ok||x.liq<CFG.minLiq||age<CFG.minAge||age>CFG.maxAge)return;
  if(Object.values(A.pos).filter(q=>q.auto).length>=CFG.maxPos)return;
  const amt=Math.floor(Math.min(D.equity()*B.pct/100,A.cash));
  if(amt<10000){note('Saldo tunai kurang untuk entry berikutnya');return 1}
  tries[id]=(tries[id]||0)+1;
  /* konfirmasi harga & likuiditas live sebelum beli */
  let p=0,liq=0;
  try{const j=await getJ(`https://api.dexscreener.com/latest/dex/pairs/${net}/${x.a}`,6000),q=j.pairs&&j.pairs[0];
    p=+(q&&q.priceUsd)||0;liq=+(q&&q.liquidity&&q.liquidity.usd)||0}catch(e){}
  if(!(p>0)||liq<CFG.minLiq)return;
  const a={id,kind:'d',chain:net,addr:k,sym:String(x.n).slice(0,24),name:x.n,side:'L',e:p,sl:p*(1-CFG.sl),t1:p*(1+CFG.tp1),t2:p*(1+CFG.tp2),auto:1,src:'bot'};
  if(!D.buy(a,amt,p,liq))return;
  B.done[id]=Date.now();for(const i in B.done)if(Date.now()-B.done[i]>864e5)delete B.done[i];
  note(`<b>BUY</b> ${esc(a.sym)} (${net==='solana'&&x.dex.startsWith('pump')?'pump.fun':net}) ${rp(amt)} · skor ${r.sc.toFixed(1)}/10`);
  return 1}
/* time-stop: posisi bot yang tidak kena TP/SL ditutup setelah holdMin menit (harga terakhir) */
function watch(){const A=D.A();Object.values(A.pos).forEach(q=>{if(q.auto&&Date.now()-q.t>CFG.holdMin*6e4){note(`<b>TIME-STOP</b> ${esc(q.sym)} ditutup`);D.close(q.id,'TIME')}});paint()}
function start(){clearInterval(tm);clearInterval(wt);tm=setInterval(scan,CFG.scanMs);wt=setInterval(watch,15000);scan()}
function stop(){clearInterval(tm);clearInterval(wt);tm=wt=0}
function toggle(on){
  B.on=on==null?!B.on:on?1:0;save();paint();
  if(B.on){note('Bot <b>ON</b>: memindai pool baru tiap '+CFG.scanMs/1000+' dtk (bergilir antar jaringan)');start()}
  else{stop();note('Bot <b>OFF</b>: posisi yang sudah terbuka tetap dipantau TP/SL')}}
paint();setInterval(()=>{if(!dm.hidden)paint()},2000);
if(B.on)setTimeout(start,3000);
window.WDBot={toggle,cfg:CFG,state:()=>B};
})();
