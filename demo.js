/* ===== AKUN DEMO (PAPER TRADING) IDR =====
   Uang virtual, harga REAL-TIME: Binance WebSocket (koin CEX), PumpPortal WebSocket (token pump.fun,
   tidak resmi), DexScreener (memecoin Solana di DEX). Saldo disimpan di localStorage browser.
   Fee + slippage disimulasikan. TP/SL hanya berjalan saat halaman terbuka. */
(()=>{
'use strict';
if(window.__wdDemo)return;window.__wdDemo=1;
const KEY='wd_demo_v1',MIN=10000,FEE={c:.001,s:.01},DEX='https://api.dexscreener.com/';
const BN=['https://data-api.binance.vision/api/v3/','https://api.binance.com/api/v3/'];
const WSB=['wss://data-stream.binance.vision/stream','wss://stream.binance.com:9443/stream'];
const WSP='wss://pumpportal.fun/api/data';
const B58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,CX=/^[A-Z0-9]{2,12}$/;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,o)=>v.toLocaleString('id-ID',o);
const rp=v=>(v<0?'-':'')+'Rp '+nf(Math.abs(v),{maximumFractionDigits:0});
const px=v=>v>=1000?nf(v,{maximumFractionDigits:0}):v>=1?nf(v,{maximumFractionDigits:2}):nf(v,{maximumSignificantDigits:4});
const usd=v=>'$'+(v>=1?v.toLocaleString('en-US',{maximumFractionDigits:2}):v.toLocaleString('en-US',{maximumSignificantDigits:4}));
const cmp=v=>'$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const sg=v=>(v>=0?'+':'')+v.toFixed(2)+'%';
const getJ=async(u,ms=8000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};

/* ---------- akun ---------- */
const NAMES={BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',BNB:'BNB',XRP:'XRP',DOGE:'Dogecoin',PEPE:'Pepe'};
const fresh=s=>({cash:s,start:s,pos:{},hist:[],rl:0,w:0,n:0,sel:{id:'c:BTC',sym:'BTC',name:'Bitcoin',kind:'c'}});
let A;try{A=JSON.parse(localStorage.getItem(KEY));if(!A||!A.pos)A=null}catch(e){A=null}
if(!A)A=fresh(10000000);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(A))}catch(e){}};
let fx=0,solUsd=0,sel=A.sel,isOpen=false,busy=0;
const P={},H={},feed=[],st={bn:0,pump:0,dex:0};let results=[];
const fee=id=>FEE[id[0]],stale=id=>!P[id]||Date.now()-P[id].t>(id[0]==='c'?45e3:3e4);
const pidr=id=>P[id]&&fx?P[id].u*fx:null;
function imp(id,v){if(id[0]==='c')return .0005;const R=(P[id]&&P[id].R||0)*fx;return R>0?v/(R+v):null}
function net(q,qty){const p=pidr(q.id);if(p==null)return null;const v=qty*p,i=imp(q.id,v);return i==null?null:v*(1-i)*(1-fee(q.id))}

/* ---------- harga masuk ---------- */
function tick(id,u,o){
  if(!(u>0))return;const p=P[id]||(P[id]={});
  if(p.u!=null&&u!==p.u)p.dir=u>p.u?1:-1;
  p.u=u;p.t=Date.now();if(o){if(o.R!=null)p.R=o.R;if(o.src)p.src=o.src}
  const h=H[id]||(H[id]=[]);if(!h.length||p.t-h[h.length-1][0]>400){h.push([p.t,u]);if(h.length>150)h.shift()}
  chk(id);sched()}
function chk(id){const q=A.pos[id];if(!q||(q.tp==null&&q.sl==null))return;
  const v=net(q,q.qty);if(v==null)return;const pc=(v/q.cost-1)*100;
  if(q.tp!=null&&pc>=q.tp)sell(id,1,'TP');else if(q.sl!=null&&pc<=-q.sl)sell(id,1,'SL')}
const chkAll=()=>Object.keys(A.pos).forEach(chk);

/* ---------- trading ---------- */
function calcBuy(id,amt){
  const p=pidr(id),pp=P[id];
  if(!fx)return{e:'Menunggu kurs USDT/IDR…'};if(p==null)return{e:'Menunggu harga live…'};
  if(stale(id))return{e:'Harga tidak update, tunggu koneksi pulih'};
  if(id[0]==='s'&&(pp.R||0)*2<1000)return{e:'Likuiditas di bawah $1.000: buy diblokir'};
  amt=Math.min(amt,A.cash);if(amt<MIN)return{e:A.cash<MIN?'Saldo kurang dari Rp 10.000':'Minimal order Rp 10.000'};
  const f=amt*fee(id),n=amt-f,i=imp(id,n);if(i==null)return{e:'Likuiditas tidak diketahui'};
  const fill=p*(1+i);return{amt,f,i,fill,qty:n/fill}}
function log(s,q,qty,price,v,f,pnl,w){A.hist.unshift({t:Date.now(),s,sym:q.sym,qty,p:price,v,f,pnl,w});if(A.hist.length>200)A.hist.length=200}
function buy(id,amt,tp,sl){
  const m=A.pos[id]||(sel&&sel.id===id?sel:null);if(!m)return;
  const c=calcBuy(id,amt);if(c.e)return say(c.e,'dn');
  A.cash-=c.amt;
  const q=A.pos[id]||(A.pos[id]={id,sym:m.sym,name:m.name,kind:m.kind,mint:m.mint,qty:0,cost:0,tp:null,sl:null,t:Date.now()});
  q.qty+=c.qty;q.cost+=c.amt;if(tp!=null)q.tp=tp;if(sl!=null)q.sl=sl;
  log('BUY',q,c.qty,c.fill,c.amt,c.f,0,'manual');save();sync();say(`Beli ${q.sym} ${rp(c.amt)} @ Rp ${px(c.fill)}`,'up');sched(1)}
function sell(id,frac,why){
  const q=A.pos[id];if(!q)return;const p=pidr(id);if(p==null)return say('Harga belum tersedia','dn');
  const qty=frac>=.999?q.qty:q.qty*frac,v=qty*p,i=imp(id,v);if(i==null)return say('Likuiditas tidak diketahui','dn');
  const gross=v*(1-i),f=gross*fee(id),got=gross-f,cp=q.cost*(qty/q.qty),pnl=got-cp;
  A.cash+=got;A.rl+=pnl;A.n++;if(pnl>0)A.w++;q.qty-=qty;q.cost-=cp;
  log('SELL',q,qty,p*(1-i),got,f,pnl,why||'manual');
  if(frac>=.999||q.qty<=1e-12)delete A.pos[id];
  save();sync();say(`${why&&why!=='manual'?why+' kena: ':'Jual '}${q.sym} ${rp(got)} (${pnl>=0?'+':''}${rp(pnl)})`,pnl>=0?'up':'dn');sched(1)}

/* ---------- koneksi: Binance WS ---------- */
let bw=null,bwI=0,bwD=1000,bwT=0,bwCur=new Set(),pw=null,pwD=1000,pwT=0,pwCur=new Set(),pollT=0,fxT=0;
const active=()=>isOpen||Object.keys(A.pos).length>0;
function bnWant(){const s=new Set(['usdtidr@miniTicker','solusdt@aggTrade']);
  const add=a=>{if(a&&a.kind==='c')s.add(a.sym.toLowerCase()+'usdt@aggTrade')};add(sel);Object.values(A.pos).forEach(add);return s}
function bnSync(){if(!bw||bw.readyState!==1)return;const w=bnWant(),a=[...w].filter(x=>!bwCur.has(x)),d=[...bwCur].filter(x=>!w.has(x));
  if(a.length)bw.send(JSON.stringify({method:'SUBSCRIBE',params:a,id:1}));
  if(d.length)bw.send(JSON.stringify({method:'UNSUBSCRIBE',params:d,id:2}));bwCur=w}
function bnConnect(){
  if(bw)return;let w;try{w=new WebSocket(WSB[bwI%2]+'?streams=usdtidr@miniTicker')}catch(e){return bnRetry()}
  bw=w;
  w.onopen=()=>{bwD=1000;st.bn=1;bwCur=new Set(['usdtidr@miniTicker']);bnSync();sched()};
  w.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}const d=m.data||m;if(!d||!d.s)return;
    if(d.e==='24hrMiniTicker'){if(d.s==='USDTIDR'&&+d.c>0){fx=+d.c;chkAll();sched()}return}
    if(d.e==='aggTrade'){const u=+d.p;if(d.s==='SOLUSDT')solUsd=u;if(d.s.endsWith('USDT'))tick('c:'+d.s.slice(0,-4),u,{src:'bn'})}};
  w.onclose=()=>{if(bw!==w)return;bw=null;st.bn=0;sched();bnRetry()}}
function bnRetry(){clearTimeout(bwT);if(!active())return;bwI++;bwT=setTimeout(bnConnect,bwD=Math.min(bwD*1.8,3e4))}

/* ---------- koneksi: PumpPortal WS (pump.fun, tidak resmi) ---------- */
function pumpWant(){const s=new Set();if(sel&&sel.kind==='s')s.add(sel.mint);Object.values(A.pos).forEach(q=>q.kind==='s'&&s.add(q.mint));return s}
function pumpSync(){if(!pw||pw.readyState!==1)return;const w=pumpWant(),a=[...w].filter(x=>!pwCur.has(x)),d=[...pwCur].filter(x=>!w.has(x));
  if(a.length)pw.send(JSON.stringify({method:'subscribeTokenTrade',keys:a}));
  if(d.length)pw.send(JSON.stringify({method:'unsubscribeTokenTrade',keys:d}));pwCur=w}
function pumpConnect(){
  if(pw)return;let w;try{w=new WebSocket(WSP)}catch(e){return pumpRetry()}
  pw=w;
  w.onopen=()=>{pwD=1000;st.pump=1;pwCur=new Set();if(isOpen)w.send(JSON.stringify({method:'subscribeNewToken'}));pumpSync();sched()};
  w.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch(x){return}if(!d||!d.mint||!B58.test(d.mint))return;
    const sv=+d.vSolInBondingCurve,tk=+d.vTokensInBondingCurve;if(!(sv>0&&tk>0&&solUsd>0))return;
    const u=sv/tk*solUsd;
    if(d.name&&d.symbol){feed.unshift({mint:d.mint,sym:String(d.symbol).slice(0,12),name:String(d.name).slice(0,40),u,R:sv*solUsd,mc:(+d.marketCapSol||sv/tk*1e9)*solUsd,t:Date.now()});if(feed.length>12)feed.pop();sched()}
    else{const f=feed.find(x=>x.mint===d.mint);if(f){f.u=u;f.R=sv*solUsd;f.mc=u*1e9}}
    if(pwCur.has(d.mint))tick('s:'+d.mint,u,{R:sv*solUsd,src:'pump'})};
  w.onclose=()=>{if(pw!==w)return;pw=null;st.pump=0;sched();pumpRetry()}}
function pumpRetry(){clearTimeout(pwT);if(!active())return;pwT=setTimeout(pumpConnect,pwD=Math.min(pwD*1.8,3e4))}

/* ---------- DexScreener (polling 2 detik) ---------- */
async function dexTokens(m){const out={};
  for(let i=0;i<m.length;i+=30){const j=await getJ(DEX+'tokens/v1/solana/'+m.slice(i,i+30).join(','));
    (Array.isArray(j)?j:[]).forEach(x=>{const a=x.baseToken&&x.baseToken.address;if(!a||!m.includes(a))return;
      if(!out[a]||((x.liquidity&&x.liquidity.usd)||0)>((out[a].liquidity&&out[a].liquidity.usd)||0))out[a]=x})}
  return out}
async function poll(){
  const m=[...pumpWant()];if(!m.length)return;
  try{const b=await dexTokens(m);st.dex=1;
    m.forEach(a=>{const x=b[a];if(!x)return;const id='s:'+a,p=P[id],liq=(x.liquidity&&x.liquidity.usd)||0;
      const f=p&&p.src==='pump'&&Date.now()-p.t<15e3;
      if(!f)tick(id,+x.priceUsd,{R:liq/2,src:'dex'});
      const q=P[id];if(q){q.liq=liq;q.mc=x.marketCap||x.fdv;q.c1=x.priceChange&&x.priceChange.h1;q.c24=x.priceChange&&x.priceChange.h24}})
  }catch(e){st.dex=0}sched()}
async function initFx(){
  for(const b of BN){try{const[a,s]=await Promise.all([getJ(b+'ticker/price?symbol=USDTIDR'),getJ(b+'ticker/price?symbol=SOLUSDT')]);
    fx=+a.price||fx;solUsd=+s.price||solUsd;chkAll();sched();return}catch(e){}}}
async function cexInit(sym){for(const b of BN){try{const j=await getJ(b+'ticker/price?symbol='+sym+'USDT');tick('c:'+sym,+j.price,{src:'bn'});return}catch(e){}}}
function sync(){bnSync();pumpSync();poll()}
function start(){bnConnect();pumpConnect();initFx();if(!pollT)pollT=setInterval(poll,2000);if(!fxT)fxT=setInterval(()=>{if(!fx||!st.bn)initFx()},3e4)}
function stop(){clearInterval(pollT);clearInterval(fxT);pollT=fxT=0;clearTimeout(bwT);clearTimeout(pwT);
  const a=bw,b=pw;bw=pw=null;st.bn=st.pump=st.dex=0;try{a&&a.close()}catch(e){}try{b&&b.close()}catch(e){}}

/* ---------- pilih aset & pencarian ---------- */
function pick(m){
  if(m.kind==='s'&&!B58.test(m.mint))return;if(m.kind==='c'&&!CX.test(m.sym))return;
  sel=A.sel={id:m.id,sym:m.sym,name:m.name,kind:m.kind,mint:m.mint};
  if(m.u>0)tick(m.id,m.u,{R:m.R,src:m.src||'dex'});else if(m.kind==='c'&&!P[m.id])cexInit(m.sym);
  save();sync();paintSel();sched(1)}
const solItem=x=>({id:'s:'+x.baseToken.address,sym:x.baseToken.symbol,name:x.baseToken.name,kind:'s',mint:x.baseToken.address,
  u:+x.priceUsd,R:((x.liquidity&&x.liquidity.usd)||0)/2,liq:(x.liquidity&&x.liquidity.usd)||0,mc:x.marketCap||x.fdv});
async function search(qs){
  const q=qs.trim();if(!q)return;E.res.innerHTML='<p class="dm-nd">Mencari…</p>';const out=[];
  try{
    if(B58.test(q)){const b=await dexTokens([q]);if(b[q])out.push(solItem(b[q]))}
    else{const s=q.toUpperCase().replace(/USDT$/,'');
      if(CX.test(s)){for(const b of BN){try{const j=await getJ(b+'ticker/price?symbol='+s+'USDT');
        out.push({id:'c:'+s,sym:s,name:(NAMES[s]||s)+' · Binance',kind:'c',u:+j.price,src:'bn'});break}catch(e){}}}
      const j=await getJ(DEX+'latest/dex/search?q='+encodeURIComponent(q)),seen=new Set();
      (j.pairs||[]).filter(x=>x.chainId==='solana'&&x.baseToken&&B58.test(x.baseToken.address))
        .sort((a,b)=>((b.liquidity&&b.liquidity.usd)||0)-((a.liquidity&&a.liquidity.usd)||0))
        .forEach(x=>{if(seen.has(x.baseToken.address))return;seen.add(x.baseToken.address);out.push(solItem(x))})}
  }catch(e){}
  results=out.slice(0,10);
  E.res.innerHTML=results.length?results.map((r,i)=>`<button type="button" class="dm-row" data-res="${i}"><span class="av">${esc((r.sym||'?')[0])}</span><span class="sc-n"><b>${esc(r.sym)}</b><small>${esc(r.name)}</small></span><span class="dm-r"><b>${usd(r.u)}</b><small>${r.kind==='s'?'Likuid. '+cmp(r.liq):'CEX'}</small></span></button>`).join(''):'<p class="dm-nd">Tidak ketemu. Coba simbol lain atau tempel alamat mint Solana.</p>'}

/* ---------- UI ---------- */
const css=document.createElement('style');css.textContent=`
.dm-st{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:.8rem;margin:-4px 0 16px}
.dm-st i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5c6c;margin-right:6px}.dm-st i.on{background:#2ee59d}
.dm-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.dm-c{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04);padding:14px;min-width:0}
.dm-c small,.dm-r small,.dm-meta{color:var(--muted);font-size:.78rem}.dm-c small{display:block}
.dm-c b{font-size:1.1rem;font-weight:600;font-variant-numeric:tabular-nums;word-break:break-word}
.dm-cols{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:16px;align-items:start}
.dm-p{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.04);padding:16px;margin-bottom:16px}
.dm-p h3,.dm-h3{font-size:1rem;font-weight:500;margin:0 0 10px}.dm-h3{margin-top:8px}
.dm-up{color:#2ee59d}.dm-dn{color:#ff5c6c}
.dm-bar{display:flex;gap:8px}.dm-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.dm-b{height:44px;border-radius:999px;border:1px solid var(--line);padding:0 16px;font-size:.88rem;white-space:nowrap;color:#fff}
.dm-b:hover{background:rgba(255,255,255,.12)}.dm-b.s{height:34px;padding:0 12px;font-size:.8rem}
.dm-buy{background:#2ee59d;color:#000;font-weight:600;width:100%;border-color:#2ee59d}.dm-buy:hover{background:#5df0b8}.dm-buy[disabled]{opacity:.4;cursor:not-allowed}
.dm-sell{background:#ff5c6c;color:#000;border-color:#ff5c6c}.dm-sell:hover{background:#ff8591}
.dm-in{height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#fff;font:inherit;font-size:16px;width:100%;min-width:0;outline:0}
.dm-in:focus{border-color:#fff}.dm-in.dm-s{height:34px;font-size:14px;padding:0 8px;width:70px}
.dm-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 4px;border-top:1px solid rgba(255,255,255,.08)}
.dm-row:hover{background:rgba(255,255,255,.06)}.dm-row .av,.dm-pos .av{width:36px;height:36px;font-size:.85rem}
.dm-r{text-align:right;display:flex;flex-direction:column;flex-shrink:0}.dm-r b{font-size:.9rem;font-variant-numeric:tabular-nums}
.sc-n small{display:block;color:var(--muted);font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-px{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:12px 0 4px}
.dm-px b{font-size:clamp(1.5rem,4vw,2rem);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.dm-bdg{font-size:.7rem;padding:3px 10px;border-radius:999px;border:1px solid var(--line);flex-shrink:0}
.dm-sp{width:100%;height:80px;display:block;margin:6px 0}
.dm-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.dm-2 .dm-in{width:100%}
.dm-q{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}
.dm-est{font-size:.82rem;color:var(--muted);margin:8px 0 12px;min-height:2.6em}.dm-est.e{color:#ffd166}
.dm-pos{border-top:1px solid rgba(255,255,255,.08);padding:12px 0}
.dm-ph{display:flex;align-items:center;gap:10px;cursor:pointer}
.dm-pa{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:.78rem;color:var(--muted)}
.dm-pa label{display:flex;align-items:center;gap:6px}
.dm-nd{color:var(--muted);font-size:.88rem;padding:8px 0}
.dm-tw{overflow-x:auto}.dm-t{width:100%;border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums}
.dm-t th{color:var(--muted);font-weight:400;text-align:left;padding:6px 8px}.dm-t td{padding:8px;border-top:1px solid rgba(255,255,255,.08);white-space:nowrap}
.dm-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dm-top select{height:34px;border-radius:999px;border:1px solid var(--line);background:#111;color:#fff;padding:0 10px;font:inherit;font-size:.8rem}
.dm-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translate(-50%,20px);z-index:400;padding:12px 20px;border-radius:999px;background:#111;border:1px solid var(--line);font-size:.88rem;opacity:0;pointer-events:none;transition:.25s;max-width:92vw;text-align:center}
.dm-toast.on{opacity:1;transform:translate(-50%,0)}.dm-toast.up{border-color:#2ee59d}.dm-toast.dn{border-color:#ff5c6c}
@media(max-width:860px){.dm-sum{grid-template-columns:repeat(2,1fr)}.dm-cols{grid-template-columns:1fr}}`;
document.head.append(css);

const root=document.createElement('div');root.id='dm';root.className='scr';root.hidden=true;
root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Akun Demo');
root.innerHTML=`<div class="scr-in">
<div class="scr-top"><div><p class="btc-tag"><i class="live"></i>Akun Demo · Rupiah · Harga realtime</p><h2>Paper Trading</h2></div><button class="scr-x" id="dmX" type="button" aria-label="Tutup">&times;</button></div>
<div class="dm-st" id="dmSt"></div>
<div class="dm-sum" id="dmSum"></div>
<div class="dm-cols">
 <div>
  <div class="dm-p"><h3>Cari aset</h3>
   <div class="dm-bar"><input class="scr-q dm-in" id="dmQ" type="search" enterkeyhint="search" placeholder="BTC, PEPE, nama token, atau alamat mint Solana" autocomplete="off" autocapitalize="off" spellcheck="false" style="border-radius:999px"><button class="dm-b" id="dmGo" type="button">Cari</button></div>
   <div class="dm-chips" id="dmChips"></div><div id="dmRes"></div></div>
  <div class="dm-p"><h3>Token baru pump.fun <small class="dm-meta">· live dari PumpPortal</small></h3><div id="dmFeed"><p class="dm-nd">Menunggu token baru…</p></div></div>
 </div>
 <div>
  <div class="dm-p">
   <div class="dm-ph" style="cursor:default"><span class="av" id="dmAv"></span><div class="sc-n"><b id="dmNm"></b><small id="dmSy"></small></div><span class="dm-bdg" id="dmBd"></span></div>
   <div class="dm-px"><b id="dmPx">—</b><span class="dm-meta" id="dmUsd"></span></div>
   <svg class="dm-sp" id="dmSp" viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true"></svg>
   <p class="dm-meta" id="dmMeta"></p>
   <p class="dm-meta" style="margin:14px 0 6px">Nominal beli (Rp)</p>
   <input class="dm-in" id="dmAmt" inputmode="numeric" placeholder="mis. 1000000" autocomplete="off">
   <div class="dm-q"><button class="dm-b s" type="button" data-pct=".1">10%</button><button class="dm-b s" type="button" data-pct=".25">25%</button><button class="dm-b s" type="button" data-pct=".5">50%</button><button class="dm-b s" type="button" data-pct="1">Max</button></div>
   <div class="dm-2"><input class="dm-in" id="dmTp" inputmode="decimal" placeholder="Take Profit % (opsional)"><input class="dm-in" id="dmSl" inputmode="decimal" placeholder="Stop Loss % (opsional)"></div>
   <p class="dm-est" id="dmEst"></p>
   <button class="dm-b dm-buy" id="dmBuy" type="button">Beli</button>
  </div>
 </div>
</div>
<h3 class="dm-h3">Posisi terbuka</h3><div class="dm-p" id="dmPos"></div>
<div class="dm-top" style="justify-content:space-between;margin-bottom:10px"><h3 class="dm-h3" style="margin:0">Riwayat</h3>
 <div class="dm-top"><select id="dmStart" aria-label="Saldo awal"><option value="10000000">Rp 10 juta</option><option value="50000000">Rp 50 juta</option><option value="100000000">Rp 100 juta</option><option value="1000000000">Rp 1 miliar</option></select><button class="dm-b s" id="dmReset" type="button">Reset akun</button></div></div>
<div class="dm-p dm-tw" id="dmHist"></div>
<p class="scr-note" style="color:var(--muted);font-size:.8rem;line-height:1.6;margin-top:8px"><b>Catatan.</b> Ini akun simulasi dengan uang virtual, bukan transaksi sungguhan dan bukan saran investasi. Harga: Binance (koin CEX), PumpPortal (token pump.fun, API tidak resmi, bisa berubah), DexScreener (memecoin Solana di DEX, diperbarui tiap 2 detik). Fee disimulasikan 0,1% (CEX) dan 1% (memecoin), ditambah price impact dari likuiditas. Nilai posisi dihitung bersih seandainya dijual sekarang. <b>TP/SL hanya berjalan selama halaman ini terbuka.</b> Saldo tersimpan di browser ini saja. Memecoin sangat berisiko; di dunia nyata token bisa jatuh drastis atau tidak bisa dijual.</p>
</div>`;
document.body.append(root);
const E={};root.querySelectorAll('[id]').forEach(e=>E[e.id.replace(/^dm/,'').toLowerCase()||e.id]=e);
E.x=E.x||root.querySelector('#dmX');
const tz=document.createElement('div');tz.className='dm-toast';document.body.append(tz);
let tzT=0;function say(m,c){tz.textContent=m;tz.className='dm-toast on '+(c||'');clearTimeout(tzT);tzT=setTimeout(()=>tz.className='dm-toast',4500)}

E.chips.innerHTML=Object.keys(NAMES).map(s=>`<button type="button" class="dm-b s" data-chip="${s}">${s}</button>`).join('');
const avatar=(el,s)=>{el.textContent=(s||'?')[0]};

function paintSel(){
  avatar(E.av,sel.sym);E.nm.textContent=sel.name||sel.sym;
  E.sy.textContent=sel.sym+(sel.kind==='s'?' · Solana · '+sel.mint.slice(0,4)+'…'+sel.mint.slice(-4):' · Binance spot')}
function spark(id){
  const h=(H[id]||[]).slice(-120);if(h.length<2)return'';const v=h.map(x=>x[1]),mn=Math.min(...v),mx=Math.max(...v),r=(mx-mn)||mx*1e-6||1;
  return`<polyline fill="none" stroke="${v[v.length-1]>=v[0]?'#2ee59d':'#ff5c6c'}" stroke-width="2" vector-effect="non-scaling-stroke" points="${v.map((y,i)=>(i/(v.length-1)*300).toFixed(1)+','+(76-(y-mn)/r*72).toFixed(1)).join(' ')}"/>`}
function paintLive(){
  const id=sel.id,p=P[id],i=pidr(id);
  E.px.textContent=i==null?'—':'Rp '+px(i);E.px.className=p&&p.dir?(p.dir>0?'dm-up':'dm-dn'):'';
  E.usd.textContent=p?usd(p.u):'';
  const ok=p&&!stale(id);E.bd.textContent=ok?'● LIVE '+(p.src==='pump'?'pump.fun':p.src==='dex'?'DEX':'Binance'):'○ MENUNGGU';E.bd.className='dm-bdg '+(ok?'dm-up':'');
  E.sp.innerHTML=spark(id);
  let m='';if(p&&sel.kind==='s'){const a=[];if(p.R)a.push('Likuiditas '+cmp(p.R*2));if(p.mc)a.push('MC '+cmp(p.mc));
    if(p.c1!=null)a.push('1j '+sg(+p.c1));if(p.c24!=null)a.push('24j '+sg(+p.c24));m=a.join(' · ')}
  else if(sel.kind==='c')m='Kurs USDT/IDR '+(fx?'Rp '+nf(fx,{maximumFractionDigits:0}):'—');
  E.meta.textContent=m;paintEst()}
function paintEst(){
  const amt=+(E.amt.value.replace(/\D/g,''))||0;let t='',e=0;
  if(!amt)t='Masukkan nominal beli. Saldo tunai '+rp(A.cash)+'.';
  else{const c=calcBuy(sel.id,amt);if(c.e){t=c.e;e=1;E.buy.disabled=true}
    else{t=`Beli ${rp(c.amt)} → ±${nf(c.qty,{maximumSignificantDigits:6})} ${sel.sym} @ Rp ${px(c.fill)} · fee ${rp(c.f)} · slippage ${(c.i*100).toFixed(2)}%`+(c.i>.03?' ⚠ price impact besar':'');E.buy.disabled=false}}
  if(!amt)E.buy.disabled=true;E.est.textContent=t;E.est.className='dm-est'+(e?' e':'')}
function paintAcct(){
  let eq=A.cash;Object.values(A.pos).forEach(q=>{const v=net(q,q.qty);eq+=v==null?q.cost:v});
  const pl=eq-A.start,c=pl>=0?'dm-up':'dm-dn';
  E.sum.innerHTML=`<div class="dm-c"><small>Ekuitas</small><b>${rp(eq)}</b></div><div class="dm-c"><small>Saldo tunai</small><b>${rp(A.cash)}</b></div>
   <div class="dm-c"><small>Total PnL</small><b class="${c}">${rp(pl)} (${sg(pl/A.start*100)})</b></div>
   <div class="dm-c"><small>Win rate · PnL terealisasi</small><b>${A.n?Math.round(A.w/A.n*100)+'%':'—'} · <span class="${A.rl>=0?'dm-up':'dm-dn'}">${rp(A.rl)}</span></b></div>`;
  const ae=document.activeElement;
  if(!(ae&&ae.tagName==='INPUT'&&E.pos.contains(ae))){
    const a=Object.values(A.pos);
    E.pos.innerHTML=a.length?a.map(q=>{const v=net(q,q.qty),l=v==null?null:v-q.cost,p=l==null?null:l/q.cost*100,k=l>=0?'dm-up':'dm-dn';
      return`<div class="dm-pos" data-id="${esc(q.id)}"><div class="dm-ph" data-pick><span class="av">${esc((q.sym||'?')[0])}</span><div class="sc-n"><b>${esc(q.sym)}</b><small>${nf(q.qty,{maximumSignificantDigits:6})} · modal ${rp(q.cost)} · nilai ${v==null?'—':rp(v)}</small></div><div class="dm-r"><b class="${k}">${l==null?'—':rp(l)}</b><small class="${k}">${p==null?'':sg(p)}</small></div></div>
      <div class="dm-pa"><label>TP %<input class="dm-in dm-s" data-k="tp" inputmode="decimal" value="${q.tp==null?'':q.tp}" placeholder="—"></label><label>SL %<input class="dm-in dm-s" data-k="sl" inputmode="decimal" value="${q.sl==null?'':q.sl}" placeholder="—"></label>
      <button class="dm-b s" type="button" data-sell=".5">Jual 50%</button><button class="dm-b s dm-sell" type="button" data-sell="1">Jual semua</button></div></div>`}).join('')
      :'<p class="dm-nd">Belum ada posisi. Pilih aset, isi nominal, lalu tekan Beli.</p>'}
  const d=t=>new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  E.hist.innerHTML=A.hist.length?`<table class="dm-t"><tr><th>Waktu</th><th>Aksi</th><th>Aset</th><th>Nilai</th><th>Harga</th><th>PnL</th><th>Ket.</th></tr>${A.hist.slice(0,40).map(h=>`<tr><td>${d(h.t)}</td><td class="${h.s==='BUY'?'dm-up':'dm-dn'}">${h.s}</td><td>${esc(h.sym)}</td><td>${rp(h.v)}</td><td>Rp ${px(h.p)}</td><td class="${h.pnl>=0?'dm-up':'dm-dn'}">${h.s==='SELL'?rp(h.pnl):'—'}</td><td>${esc(h.w)}</td></tr>`).join('')}</table>`:'<p class="dm-nd">Belum ada transaksi.</p>';
  E.feed.innerHTML=feed.length?feed.map((f,i)=>`<button type="button" class="dm-row" data-feed="${i}"><span class="av">${esc(f.sym[0]||'?')}</span><span class="sc-n"><b>${esc(f.sym)}</b><small>${esc(f.name)}</small></span><span class="dm-r"><b>${cmp(f.mc)}</b><small>MC</small></span></button>`).join(''):'<p class="dm-nd">Menunggu token baru…</p>';
  E.st.innerHTML=`<span><i class="${st.bn?'on':''}"></i>Binance WS</span><span><i class="${st.pump?'on':''}"></i>PumpPortal WS</span><span><i class="${st.dex?'on':''}"></i>DexScreener</span><span>Kurs USDT/IDR ${fx?'Rp '+nf(fx,{maximumFractionDigits:0}):'…'}</span>`}

let tm=0;
function go(){paintLive();paintAcct()}
function sched(f){if(!isOpen)return;if(f){clearTimeout(tm);tm=0;go();return}if(tm)return;tm=setTimeout(()=>{tm=0;go()},250)}
const render=go;

root.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-pick]');if(!t)return;const d=t.dataset;
  if(t.id==='dmX')return close();
  if(t.id==='dmGo')return search(E.q.value);
  if(t.id==='dmBuy'){const amt=+(E.amt.value.replace(/\D/g,''))||0,tp=parseFloat(E.tp.value),sl=parseFloat(E.sl.value);
    buy(sel.id,amt,tp>0?tp:null,sl>0?sl:null);E.amt.value='';return}
  if(t.id==='dmReset'){if(confirm('Reset akun demo? Semua posisi dan riwayat dihapus.')){const s=+E.start.value||10000000;
    A=fresh(s);A.sel=sel;save();sync();say('Akun direset: '+rp(s),'up');sched(1)}return}
  if(d.pct){E.amt.value=String(Math.floor(A.cash*+d.pct));paintEst();return}
  if(d.chip){pick({id:'c:'+d.chip,sym:d.chip,name:NAMES[d.chip]||d.chip,kind:'c'});return}
  if(d.res!=null){const r=results[+d.res];if(r)pick(r);return}
  if(d.feed!=null){const f=feed[+d.feed];if(f)pick({id:'s:'+f.mint,sym:f.sym,name:f.name,kind:'s',mint:f.mint,u:f.u,R:f.R,src:'pump'});return}
  const pos=t.closest('[data-id]');
  if(d.sell&&pos){sell(pos.dataset.id,+d.sell);return}
  if(d.pick!=null&&pos){const q=A.pos[pos.dataset.id];if(q)pick({id:q.id,sym:q.sym,name:q.name,kind:q.kind,mint:q.mint})}});
root.addEventListener('change',e=>{const i=e.target;if(!i.dataset||!i.dataset.k)return;const pos=i.closest('[data-id]'),q=pos&&A.pos[pos.dataset.id];
  if(!q)return;const v=parseFloat(i.value);q[i.dataset.k]=v>0?v:null;if(!(v>0))i.value='';save();chk(q.id)});
E.amt.addEventListener('input',paintEst);
E.q.addEventListener('keydown',e=>{if(e.key==='Enter')search(E.q.value)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen)close()});

let prevOv='';
function open(){
  isOpen=true;root.hidden=false;prevOv=document.body.style.overflow;document.body.style.overflow='hidden';
  start();if(pw&&pw.readyState===1)pw.send(JSON.stringify({method:'subscribeNewToken'}));
  paintSel();sync();if(sel.kind==='c'&&!P[sel.id])cexInit(sel.sym);render()}
function close(){
  isOpen=false;root.hidden=true;document.body.style.overflow=prevOv;
  if(pw&&pw.readyState===1)pw.send(JSON.stringify({method:'unsubscribeNewToken'}));
  if(!active())stop()}

/* tombol menu: navbar + hero */
const ICO='<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h15a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V7zM3 7l12-4v4M17 14h.01"/></svg>';
const mk=(cls,ref)=>{if(!ref)return;const b=document.createElement('button');b.type='button';b.className=cls;b.innerHTML=ICO+'Demo';b.onclick=open;ref.after(b)};
mk('mb',document.querySelector('#menu .mb[data-mk="stock"]'));
mk('btn btn-ghost mkb',document.querySelector('.cta .mkb[data-mk="stock"]'));

if(Object.keys(A.pos).length){start()}   /* posisi terbuka: TP/SL tetap dipantau selama halaman terbuka */
window.WDDemo={open,close};
if(window.WD_DEMO_TEST)window.WDDemo._t={buy,sell,tick,A:()=>A,setFx:v=>{fx=v},setSol:v=>{solUsd=v},pick,calcBuy,net};
})();
