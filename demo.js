/* ===== AKUN DEMO (PAPER TRADING) IDR — terhubung ke kartu Screener =====
   Tombol "Entry via Demo" di tiap kartu screener membuka posisi demo dengan Entry/SL/TP1/TP2 dari kartu itu (TERKUNCI, otomatis).
   User cukup isi nominal modal. Ekuitas & PnL bergerak realtime mengikuti harga live.
   Harga REAL-TIME: Binance WebSocket (+ cadangan REST bila WS terblokir), PumpPortal WebSocket (token pump.fun, tidak resmi),
   DexScreener (token DEX Solana/Base/BSC). Uang virtual, tersimpan di localStorage. TP/SL jalan selama halaman terbuka. */
(()=>{
'use strict';
if(window.__wdDemo)return;window.__wdDemo=1;
const KEY='wd_demo_v2',MIN=10000,FEE={c:.001,d:.01},DEX='https://api.dexscreener.com/';
const BN=['https://data-api.binance.vision/api/v3/','https://api.binance.com/api/v3/'];
const WSB=['wss://data-stream.binance.vision/stream','wss://stream.binance.com:9443/stream'];
const WSP='wss://pumpportal.fun/api/data';
const B58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,EVM=/^0x[0-9a-fA-F]{40}$/,CX=/^[A-Z0-9]{2,12}$/,CH=new Set(['solana','base','bsc']);
const okAddr=(c,a)=>c==='solana'?B58.test(a):EVM.test(a),key=(c,a)=>c==='solana'?a:a.toLowerCase();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(v,o)=>v.toLocaleString('id-ID',o);
const rp=v=>(v<0?'-':'')+'Rp '+nf(Math.abs(v),{maximumFractionDigits:0});
const usd=v=>'$'+(v>=1?v.toLocaleString('en-US',{maximumFractionDigits:v>=100?2:4}):v.toLocaleString('en-US',{maximumSignificantDigits:4}));
const sr=v=>(v>=0?'+':'')+rp(v);
const sg=v=>(v>=0?'+':'')+v.toFixed(2)+'%';
const getJ=async(u,ms=8000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};

/* ---------- akun ---------- */
const fresh=s=>({cash:s,start:s,pos:{},hist:[],rl:0,w:0,n:0});
let A;try{A=JSON.parse(localStorage.getItem(KEY));if(!A||!A.pos)A=null}catch(e){A=null}
if(!A)A=fresh(10000000);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(A))}catch(e){}};
let fx=0,fxAt=0,solUsd=0,cur=null,isOpen=false,entryOpen=false;
const P={},st={bn:0,pump:0,dex:0};
const fee=id=>FEE[id[0]],stale=id=>!P[id]||Date.now()-P[id].t>(id[0]==='c'?45e3:3e4);
const pidr=id=>P[id]&&fx?P[id].u*fx:null;
function imp(id,v){if(id[0]==='c')return .0005;const R=(P[id]&&P[id].R||0)*fx;return R>0?v/(R+v):null}
/* nilai bersih posisi seandainya ditutup sekarang (setelah slippage + fee) */
function net(q,qty){const p=pidr(q.id);if(p==null)return null;const i=imp(q.id,qty*p);if(i==null)return null;
  if(q.side==='S'){const pe=p*(1+i);return Math.max(0,qty*q.ep+qty*(q.ep-pe)-fee(q.id)*qty*pe)}
  return qty*p*(1-i)*(1-fee(q.id))}
function equity(){let e=A.cash;Object.values(A.pos).forEach(q=>{const v=net(q,q.qty);e+=v==null?q.cost:v});return e}
function floating(){let f=0;Object.values(A.pos).forEach(q=>{const v=net(q,q.qty);if(v!=null)f+=v-q.cost});return f}

/* ---------- harga masuk ---------- */
function tick(id,u,o){
  if(!(u>0))return;const p=P[id]||(P[id]={});
  if(p.u!=null&&u!==p.u)p.dir=u>p.u?1:-1;
  p.u=u;p.t=Date.now();if(o){if(o.R!=null)p.R=o.R;if(o.src)p.src=o.src}
  chk(id);sched()}
function chk(id){const q=A.pos[id],p=P[id];if(!q||!p||pidr(id)==null)return;const u=p.u,L=q.side==='L';
  if(q.sl>0&&(L?u<=q.sl:u>=q.sl))return closePos(id,1,'SL');
  if(q.t2>0&&(L?u>=q.t2:u<=q.t2))return closePos(id,1,'TP2');
  if(!q.t1d&&q.t1>0&&(L?u>=q.t1:u<=q.t1)){q.t1d=1;closePos(id,.5,'TP1')}}
const chkAll=()=>Object.keys(A.pos).forEach(chk);

/* ---------- entry & exit ---------- */
function lvlErr(a){const p=P[a.id];if(!p)return'';const u=p.u,L=a.side==='L';
  if(L?u<=a.sl:u>=a.sl)return'Harga sudah menyentuh SL, setup tidak valid lagi';
  if(L?u>=a.t1:u<=a.t1)return'Harga sudah mencapai TP1, entry sekarang tidak masuk akal';return''}
function calcOpen(a,amt){
  const id=a.id,p=pidr(id),pp=P[id];
  if(!fx)return{e:'Menunggu kurs USDT/IDR…'};if(p==null)return{e:'Menunggu harga live…'};
  if(stale(id))return{e:'Harga tidak update, tunggu koneksi pulih'};
  if(a.kind==='d'&&(pp.R||0)*2<1000)return{e:'Likuiditas di bawah $1.000: entry diblokir'};
  amt=Math.min(amt,A.cash);if(amt<MIN)return{e:A.cash<MIN?'Saldo kurang dari Rp 10.000':'Minimal Rp 10.000'};
  const f=amt*fee(id),n=amt-f,i=imp(id,n);if(i==null)return{e:'Likuiditas tidak diketahui'};
  const fill=a.side==='S'?p*(1-i):p*(1+i);return{amt,f,n,i,fill,fillU:pp.u*(fill/p),qty:n/fill}}
function log(s,q,qty,priceU,v,f,pnl,w){A.hist.unshift({t:Date.now(),s,sym:q.sym,qty,p:priceU,v,f,pnl,w});if(A.hist.length>200)A.hist.length=200}
function openPos(a,amt){
  const er=lvlErr(a);if(er)return say(er,'dn');const c=calcOpen(a,amt);if(c.e)return say(c.e,'dn');
  const ex=A.pos[a.id];if(ex&&ex.side!==a.side)return say('Tutup dulu posisi '+(ex.side==='L'?'LONG':'SHORT')+' '+a.sym,'dn');
  A.cash-=c.amt;
  const q=ex||(A.pos[a.id]={id:a.id,sym:a.sym,name:a.name,kind:a.kind,chain:a.chain,addr:a.addr,side:a.side,qty:0,cost:0,ep:0,eu:0,t:Date.now()});
  const tq=q.qty+c.qty;q.ep=(q.ep*q.qty+c.fill*c.qty)/tq;q.eu=(q.eu*q.qty+c.fillU*c.qty)/tq;q.qty=tq;q.cost+=c.amt;
  /* SL/TP SELALU dari kartu screener, bukan input user */
  q.sl=a.sl;q.t1=a.t1;q.t2=a.t2;q.se=a.e;q.t1d=0;
  log(a.side==='L'?'LONG':'SHORT',q,c.qty,c.fillU,c.amt,c.f,0,'screener');save();sync();
  say(`${a.side==='L'?'LONG':'SHORT'} ${a.sym} ${rp(c.amt)} @ ${usd(c.fillU)} · SL/TP otomatis dari screener`,'up');sched(1)}
function closePos(id,frac,why){
  const q=A.pos[id];if(!q)return;const p=pidr(id);if(p==null){if(!why||why==='manual')say('Harga belum tersedia','dn');return}
  const qty=frac>=.999?q.qty:q.qty*frac,v=qty*p,i=imp(id,v);if(i==null)return;
  const got=net(q,qty),pe=q.side==='S'?p*(1+i):p*(1-i),cp=q.cost*(qty/q.qty),pnl=got-cp;
  A.cash+=got;A.rl+=pnl;A.n++;if(pnl>0)A.w++;q.qty-=qty;q.cost-=cp;
  log(q.side==='L'?'JUAL':'COVER',q,qty,P[id].u*(pe/p),got,fee(id)*qty*pe,pnl,why||'manual');
  if(frac>=.999||q.qty<=1e-12)delete A.pos[id];
  save();sync();say(`${why&&why!=='manual'?why+' kena: ':'Tutup '}${q.sym} ${rp(got)} (${pnl>=0?'+':''}${rp(pnl)})`,pnl>=0?'up':'dn');sched(1)}

/* ---------- koneksi: Binance WS ---------- */
let bw=null,bwI=0,bwD=1000,bwT=0,bwCur=new Set(),pw=null,pwD=1000,pwT=0,pwCur=new Set(),pollT=0,fxT=0,hbT=0,cpB=0;
const active=()=>isOpen||entryOpen||Object.keys(A.pos).length>0;
function bnWant(){const s=new Set(['usdtidr@miniTicker','solusdt@aggTrade']);
  const add=a=>{if(a&&a.kind==='c')s.add(a.sym.toLowerCase()+'usdt@aggTrade')};add(cur);Object.values(A.pos).forEach(add);return s}
function bnSync(){if(!bw||bw.readyState!==1)return;const w=bnWant(),a=[...w].filter(x=>!bwCur.has(x)),d=[...bwCur].filter(x=>!w.has(x));
  if(a.length)bw.send(JSON.stringify({method:'SUBSCRIBE',params:a,id:1}));
  if(d.length)bw.send(JSON.stringify({method:'UNSUBSCRIBE',params:d,id:2}));bwCur=w}
function bnConnect(){
  if(bw)return;let w;try{w=new WebSocket(WSB[bwI%2]+'?streams=usdtidr@miniTicker')}catch(e){return bnRetry()}
  bw=w;
  w.onopen=()=>{bwD=1000;st.bn=1;bwCur=new Set(['usdtidr@miniTicker']);bnSync();sched()};
  w.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}const d=m.data||m;if(!d||!d.s)return;
    if(d.e==='24hrMiniTicker'){if(d.s==='USDTIDR'&&+d.c>0){fx=+d.c;fxAt=Date.now();chkAll();sched()}return}
    if(d.e==='aggTrade'){const u=+d.p;if(d.s==='SOLUSDT')solUsd=u;if(d.s.endsWith('USDT'))tick('c:'+d.s.slice(0,-4),u,{src:'bn'})}};
  w.onclose=()=>{if(bw!==w)return;bw=null;st.bn=0;sched();bnRetry()};
  w.onerror=()=>{try{w.close()}catch(e){}}}
function bnRetry(){clearTimeout(bwT);if(!active())return;bwI++;bwT=setTimeout(bnConnect,bwD=Math.min(bwD*1.8,3e4))}

/* ---------- koneksi: PumpPortal WS (pump.fun, tidak resmi) ---------- */
function pumpWant(){const s=new Set();const add=a=>{if(a&&a.kind==='d'&&a.chain==='solana')s.add(a.addr)};add(cur);Object.values(A.pos).forEach(add);return s}
function pumpSync(){if(!pw||pw.readyState!==1)return;const w=pumpWant(),a=[...w].filter(x=>!pwCur.has(x)),d=[...pwCur].filter(x=>!w.has(x));
  if(a.length)pw.send(JSON.stringify({method:'subscribeTokenTrade',keys:a}));
  if(d.length)pw.send(JSON.stringify({method:'unsubscribeTokenTrade',keys:d}));pwCur=w}
function pumpConnect(){
  if(pw)return;let w;try{w=new WebSocket(WSP)}catch(e){return pumpRetry()}
  pw=w;
  w.onopen=()=>{pwD=1000;st.pump=1;pwCur=new Set();pumpSync();sched()};
  w.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch(x){return}if(!d||!d.mint||!pwCur.has(d.mint))return;
    const sv=+d.vSolInBondingCurve,tk=+d.vTokensInBondingCurve;if(!(sv>0&&tk>0&&solUsd>0))return;
    tick('d:'+d.mint,sv/tk*solUsd,{R:sv*solUsd,src:'pump'})};
  w.onclose=()=>{if(pw!==w)return;pw=null;st.pump=0;sched();pumpRetry()};
  w.onerror=()=>{try{w.close()}catch(e){}}}
function pumpRetry(){clearTimeout(pwT);if(!active())return;pwT=setTimeout(pumpConnect,pwD=Math.min(pwD*1.8,3e4))}

/* ---------- DexScreener (polling 2 detik, semua chain) ---------- */
function dexWant(){const m=new Map();const add=a=>{if(a&&a.kind==='d'&&CH.has(a.chain)){if(!m.has(a.chain))m.set(a.chain,new Set());m.get(a.chain).add(a.addr)}};
  add(cur);Object.values(A.pos).forEach(add);return m}
async function poll(){
  cexPoll();
  const w=dexWant();if(!w.size)return;
  try{for(const[ch,set]of w){const arr=[...set],best={};
      for(let i=0;i<arr.length;i+=30){const j=await getJ(DEX+'tokens/v1/'+ch+'/'+arr.slice(i,i+30).join(','));
        (Array.isArray(j)?j:[]).forEach(x=>{const a=x.baseToken&&x.baseToken.address;if(!a)return;const k=key(ch,a);if(!set.has(k))return;
          if(!best[k]||((x.liquidity&&x.liquidity.usd)||0)>((best[k].liquidity&&best[k].liquidity.usd)||0))best[k]=x})}
      arr.forEach(k=>{const x=best[k];if(!x)return;const id='d:'+k,p=P[id],liq=(x.liquidity&&x.liquidity.usd)||0;
        if(!(p&&p.src==='pump'&&Date.now()-p.t<15e3))tick(id,+x.priceUsd,{R:liq/2,src:'dex'});
        const q=P[id];if(q){q.liq=liq;q.mc=x.marketCap||x.fdv}})}
    st.dex=1}catch(e){st.dex=0}sched()}
/* cadangan koin Binance: bila WebSocket mati/terblokir/sepi, harga diambil lewat REST tiap ~2 detik */
async function cexPoll(){
  if(cpB)return;
  const ids=Object.keys(A.pos).filter(i=>i[0]==='c');if(cur&&cur.kind==='c'&&!ids.includes(cur.id))ids.push(cur.id);
  if(!ids.length)return;
  const old=ids.filter(id=>!P[id]||Date.now()-P[id].t>4000);
  const needFx=!fx||Date.now()-fxAt>6000&&!st.bn;
  if(!old.length&&!needFx)return;
  cpB=1;
  try{
    if(old.length){
      for(const b of BN){try{
        const syms=old.map(i=>i.slice(2)+'USDT');
        const j=await getJ(b+'ticker/price?symbols='+encodeURIComponent(JSON.stringify(syms)),5000);
        (Array.isArray(j)?j:[]).forEach(x=>{if(x.symbol&&x.symbol.endsWith('USDT'))tick('c:'+x.symbol.slice(0,-4),+x.price,{src:'bn'})});
        break}catch(e){}}
    }
    if(needFx)await initFx();
  }catch(e){}
  cpB=0}
async function initFx(){
  for(const b of BN){try{const[a,s]=await Promise.all([getJ(b+'ticker/price?symbol=USDTIDR'),getJ(b+'ticker/price?symbol=SOLUSDT')]);
    fx=+a.price||fx;fxAt=Date.now();solUsd=+s.price||solUsd;chkAll();sched();return}catch(e){}}}
async function cexInit(sym){for(const b of BN){try{const j=await getJ(b+'ticker/price?symbol='+sym+'USDT');tick('c:'+sym,+j.price,{src:'bn'});return}catch(e){}}}
function sync(){bnSync();pumpSync();poll()}
function start(){bnConnect();pumpConnect();initFx();if(!pollT)pollT=setInterval(poll,2000);if(!fxT)fxT=setInterval(()=>{if(!fx||!st.bn)initFx()},3e4);
  if(!hbT)hbT=setInterval(()=>{if(active())sched(1)},1000)}   /* detak 1 detik: ekuitas/PnL selalu segar */
function stop(){clearInterval(pollT);clearInterval(fxT);clearInterval(hbT);pollT=fxT=hbT=0;clearTimeout(bwT);clearTimeout(pwT);
  const a=bw,b=pw;bw=pw=null;st.bn=st.pump=st.dex=0;try{a&&a.close()}catch(e){}try{b&&b.close()}catch(e){}}
const idle=()=>{if(!active())stop()};

/* ---------- UI ---------- */
const css=document.createElement('style');css.textContent=`
.dm-go{display:block;width:100%;margin-top:10px;height:42px;border-radius:999px;border:1px solid #2ee59d;color:#2ee59d;font-weight:600;font-size:.88rem;background:rgba(46,229,157,.08)}
.dm-go:hover{background:rgba(46,229,157,.2)}
.dm-st{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:.8rem;margin:-4px 0 16px}
.dm-st i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5c6c;margin-right:6px}.dm-st i.on{background:#2ee59d}
.dm-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:10px}
.dm-c{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04);padding:14px;min-width:0}
.dm-c small,.dm-r small,.dm-meta{color:var(--muted);font-size:.78rem}.dm-c small{display:block}
.dm-c b{font-size:1.1rem;font-weight:600;font-variant-numeric:tabular-nums;word-break:break-word;transition:color .5s}
.dm-wr{color:var(--muted);font-size:.82rem;margin:0 0 16px}
.dm-p{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.04);padding:16px;margin-bottom:16px}
.dm-h3{font-size:1rem;font-weight:500;margin:8px 0 10px}
.dm-up{color:#2ee59d}.dm-dn{color:#ff5c6c}.dm-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dm-fu{color:#2ee59d!important;transition:none!important}.dm-fd{color:#ff5c6c!important;transition:none!important}
.dm-b{height:44px;border-radius:999px;border:1px solid var(--line);padding:0 16px;font-size:.88rem;white-space:nowrap;color:#fff}
.dm-b:hover{background:rgba(255,255,255,.12)}.dm-b.s{height:34px;padding:0 12px;font-size:.8rem}
.dm-buy{background:#2ee59d;color:#000;font-weight:600;width:100%;border-color:#2ee59d}.dm-buy:hover{background:#5df0b8}
.dm-buy.S{background:#ff5c6c;border-color:#ff5c6c}.dm-buy.S:hover{background:#ff8591}.dm-buy[disabled]{opacity:.4;cursor:not-allowed}
.dm-sell{background:#ff5c6c;color:#000;border-color:#ff5c6c}.dm-sell:hover{background:#ff8591}
.dm-in{height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#fff;font:inherit;font-size:16px;width:100%;min-width:0;outline:0}
.dm-in:focus{border-color:#fff}
.dm-pos{border-top:1px solid rgba(255,255,255,.08);padding:12px 0}.dm-pos:first-child{border-top:0}
.dm-ph{display:flex;align-items:center;gap:10px}.dm-ph .av{width:36px;height:36px;font-size:.85rem}
.dm-r{text-align:right;display:flex;flex-direction:column;flex-shrink:0}.dm-r b{font-size:.9rem;font-variant-numeric:tabular-nums}
.dm-sd{font-size:.68rem;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:middle;border:1px solid}
.dm-sd.L{color:#2ee59d;border-color:#2ee59d}.dm-sd.S{color:#ff5c6c;border-color:#ff5c6c}
.sc-n small{display:block;color:var(--muted);font-size:.78rem}
.dm-lv{display:flex;gap:6px 14px;flex-wrap:wrap;margin:10px 0 0;font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums}.dm-lv b{color:#fff;font-weight:500}
.dm-pa{display:flex;gap:8px;margin-top:10px}
.dm-nd{color:var(--muted);font-size:.88rem;padding:8px 0}
.dm-tw{overflow-x:auto}.dm-t{width:100%;border-collapse:collapse;font-size:.82rem;font-variant-numeric:tabular-nums}
.dm-t th{color:var(--muted);font-weight:400;text-align:left;padding:6px 8px}.dm-t td{padding:8px;border-top:1px solid rgba(255,255,255,.08);white-space:nowrap}
.dm-top select{height:34px;border-radius:999px;border:1px solid var(--line);background:#111;color:#fff;padding:0 10px;font:inherit;font-size:.8rem}
.dm-ov{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.78);overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 14px calc(20px + env(safe-area-inset-bottom))}
.dm-ov[hidden]{display:none}
.dm-md{width:100%;max-width:480px;margin:auto;background:#0b0b0b;border:1px solid var(--line);border-radius:24px;padding:20px}
.dm-px{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:10px 0}
.dm-px b{font-size:clamp(1.4rem,5vw,1.9rem);font-weight:600;font-variant-numeric:tabular-nums}
.dm-bdg{font-size:.7rem;padding:3px 10px;border-radius:999px;border:1px solid var(--line)}
.dm-lock{font-size:.78rem;color:#2ee59d;margin:0 0 6px}
.dm-q{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}
.dm-est{font-size:.82rem;color:var(--muted);margin:8px 0 12px;line-height:1.55;min-height:3em}.dm-est.e{color:#ffd166}
.dm-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translate(-50%,20px);z-index:400;padding:12px 20px;border-radius:999px;background:#111;border:1px solid var(--line);font-size:.88rem;opacity:0;pointer-events:none;transition:.25s;max-width:92vw;text-align:center}
.dm-toast.on{opacity:1;transform:translate(-50%,0)}.dm-toast.up{border-color:#2ee59d}.dm-toast.dn{border-color:#ff5c6c}
#dmOpen{font-variant-numeric:tabular-nums}
@media(max-width:860px){.dm-sum{grid-template-columns:repeat(2,1fr)}}`;
document.head.append(css);

/* panel akun demo (portofolio) */
const root=document.createElement('div');root.id='dm';root.className='scr';root.hidden=true;
root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Akun Demo');
root.innerHTML=`<div class="scr-in">
<div class="scr-top"><div><p class="btc-tag"><i class="live"></i>Akun Demo · Rupiah · Harga realtime</p><h2>Portofolio Demo</h2></div><button class="scr-x" id="dmX" type="button" aria-label="Tutup">&times;</button></div>
<div class="dm-st" id="dmSt"></div>
<div class="dm-sum">
 <div class="dm-c"><small>Ekuitas (live)</small><b id="dmEq">—</b></div>
 <div class="dm-c"><small>Saldo tunai</small><b id="dmCash">—</b></div>
 <div class="dm-c"><small>Total PnL</small><b id="dmPl">—</b></div>
 <div class="dm-c"><small>PnL posisi terbuka</small><b id="dmFl">—</b></div>
</div>
<p class="dm-wr" id="dmWr"></p>
<h3 class="dm-h3">Posisi terbuka</h3><div class="dm-p" id="dmPos"></div>
<div class="dm-top" style="justify-content:space-between;margin-bottom:10px"><h3 class="dm-h3" style="margin:0">Riwayat</h3>
 <div class="dm-top"><select id="dmStart" aria-label="Saldo awal"><option value="10000000">Rp 10 juta</option><option value="50000000">Rp 50 juta</option><option value="100000000">Rp 100 juta</option><option value="1000000000">Rp 1 miliar</option></select><button class="dm-b s" id="dmReset" type="button">Reset akun</button></div></div>
<div class="dm-p dm-tw" id="dmHist"></div>
<p class="scr-note" style="color:var(--muted);font-size:.8rem;line-height:1.6;margin-top:8px"><b>Catatan.</b> Akun simulasi dengan uang virtual, bukan transaksi sungguhan dan bukan saran investasi. Entry/SL/TP1/TP2 otomatis diambil dari kartu screener. TP1 menutup 50% posisi, TP2 menutup sisanya, SL menutup semua. Fee disimulasikan 0,1% (koin Binance) dan 1% (token DEX), ditambah price impact dari likuiditas, jadi tepat setelah entry PnL sedikit negatif (biaya fee + slippage). SHORT hanya untuk koin Binance (simulasi tanpa leverage dan tanpa funding). Nilai posisi dihitung bersih seandainya ditutup sekarang. <b>TP/SL hanya berjalan selama halaman ini terbuka.</b> Saldo tersimpan di browser ini saja. Token baru sangat berisiko; di dunia nyata bisa jatuh drastis atau tidak bisa dijual.</p>
</div>`;
document.body.append(root);

/* modal Entry via Demo: user cukup isi nominal, SL/TP otomatis dari screener */
const em=document.createElement('div');em.className='dm-ov';em.hidden=true;
em.innerHTML=`<div class="dm-md" role="dialog" aria-modal="true" aria-label="Entry via Demo">
<div class="dm-top" style="justify-content:space-between"><b id="deT" style="font-size:1.05rem"></b><button class="scr-x" id="deX" type="button" aria-label="Tutup" style="width:40px;height:40px;font-size:1.4rem">&times;</button></div>
<div class="dm-px"><b id="deP">—</b><span class="dm-meta" id="deU"></span><span class="dm-bdg" id="deB"></span></div>
<p class="dm-lock">🔒 Entry, SL, TP1 &amp; TP2 otomatis dari hasil screener</p>
<div class="dm-tw"><table class="dm-t" id="deL"></table></div>
<p class="dm-meta" style="margin:14px 0 6px">Modal yang dipakai (Rp) · saldo tunai <span id="deC"></span></p>
<input class="dm-in" id="deA" inputmode="numeric" placeholder="mis. 1.000.000" autocomplete="off">
<div class="dm-q"><button class="dm-b s" type="button" data-p=".1">10%</button><button class="dm-b s" type="button" data-p=".25">25%</button><button class="dm-b s" type="button" data-p=".5">50%</button><button class="dm-b s" type="button" data-p="1">100%</button></div>
<p class="dm-est" id="deE"></p><button class="dm-buy dm-b" id="deGo" type="button">Entry</button></div>`;
document.body.append(em);
const E={};[...root.querySelectorAll('[id]'),...em.querySelectorAll('[id]')].forEach(e=>E[e.id]=e);
const tz=document.createElement('div');tz.className='dm-toast';document.body.append(tz);
let tzT=0;function say(m,c){tz.textContent=m;tz.className='dm-toast on '+(c||'');clearTimeout(tzT);tzT=setTimeout(()=>tz.className='dm-toast',4500)}

const amtVal=()=>+(E.deA.value.replace(/\D/g,''))||0;
const setAmt=n=>{E.deA.value=n>0?nf(n,{maximumFractionDigits:0}):''};
const lvRow=(l,v,u)=>`<tr><td>${l}</td><td><b>${usd(v)}</b></td><td class="${u==null?'':u>=0?'dm-up':'dm-dn'}">${u==null?'':sg(u)}</td></tr>`;
function paintEntry(){
  const a=cur;if(!a)return;const id=a.id,p=P[id],L=a.side==='L',u=p&&p.u,ok=p&&!stale(id);
  E.deP.textContent=u?usd(u):'—';E.deU.textContent=u&&fx?'Rp '+nf(u*fx,{maximumSignificantDigits:6}):'';
  E.deB.textContent=ok?'● LIVE '+(p.src==='pump'?'pump.fun':p.src==='dex'?'DEX':'Binance'):'○ MENUNGGU';E.deB.className='dm-bdg '+(ok?'dm-up':'');
  const d=v=>u?(v-u)/u*100:null,sd=L?1:-1;
  E.deL.innerHTML=`<tr><th>Level screener</th><th>Harga</th><th>vs live</th></tr>`+lvRow('Entry (screener)',a.e,d(a.e))+lvRow('Stop Loss',a.sl,d(a.sl))+lvRow('TP1 (tutup 50%)',a.t1,d(a.t1))+lvRow('TP2 (tutup sisa)',a.t2,d(a.t2));
  E.deC.textContent=rp(A.cash);
  const amt=amtVal();let t='',er=0;
  const le=ok?lvlErr(a):'';
  if(!amt){t='Masukkan nominal modal atau pilih tombol persen. SL/TP sudah otomatis.';er=1}
  else{const c=calcOpen(a,amt);
    if(c.e){t=c.e;er=1}else if(le){t=le;er=1}
    else{const pl=lv=>c.n*(lv-c.fillU)/c.fillU*sd-c.n*fee(id),dev=u?Math.abs(u-a.e)/Math.abs(a.e-a.sl):0;
      t=`Modal ${rp(c.amt)} → ±${nf(c.qty,{maximumSignificantDigits:6})} ${esc(a.sym)} @ ${usd(c.fillU)} · fee ${rp(c.f)} · slippage ${(c.i*100).toFixed(2)}%. Jika SL ≈ ${rp(pl(a.sl))}, TP1 ≈ ${sr(pl(a.t1)/2)} (50%), TP2 ≈ ${sr(pl(a.t2)/2+pl(a.t1)/2)}.`
        +(dev>.3?` ⚠ Harga sudah bergeser ${(dev*100).toFixed(0)}% jarak SL dari entry screener.`:'')+(c.i>.03?' ⚠ Price impact besar.':'')}}
  E.deE.textContent=t;E.deE.className='dm-est'+(er?' e':'');E.deGo.disabled=!!er;
  E.deGo.className='dm-buy dm-b '+a.side;E.deGo.textContent='Entry '+(L?'LONG':'SHORT')+' via Demo'}

/* ---- panel portofolio: angka diperbarui di tempat (tanpa render ulang) supaya mulus & tombol tidak hilang saat ditekan ---- */
let lastEq=null,fT=0,posSig='',histSig='';
function flash(el,up){el.classList.remove('dm-fu','dm-fd');void el.offsetWidth;el.classList.add(up?'dm-fu':'dm-fd');clearTimeout(el._f);el._f=setTimeout(()=>el.classList.remove('dm-fu','dm-fd'),350)}
const setT=(el,t)=>{if(el.textContent!==t)el.textContent=t};
const colCls=v=>v>=0?'dm-up':'dm-dn';
function setNum(el,t,v){setT(el,t);el.classList.remove('dm-up','dm-dn');if(v!=null)el.classList.add(colCls(v))}
const posHtml=q=>`<div class="dm-pos" data-id="${esc(q.id)}"><div class="dm-ph"><span class="av">${esc((q.sym||'?')[0])}</span><div class="sc-n"><b>${esc(q.sym)}</b><span class="dm-sd ${q.side}">${q.side==='L'?'LONG':'SHORT'}</span><small><span class="pq"></span> · modal <span class="pc"></span> · nilai <span class="pv"></span></small></div><div class="dm-r"><b class="pl">—</b><small class="pp"></small></div></div>
    <div class="dm-lv"><span>Entry <b>${usd(q.eu)}</b></span><span>Live <b class="lpx">—</b></span><span>SL <b>${usd(q.sl)}</b></span><span>TP1 <b>${usd(q.t1)}${q.t1d?' ✓':''}</b></span><span>TP2 <b>${usd(q.t2)}</b></span></div>
    <div class="dm-pa"><button class="dm-b s" type="button" data-cl=".5">Tutup 50%</button><button class="dm-b s dm-sell" type="button" data-cl="1">Tutup semua</button></div></div>`;
function paintAcct(){
  const eq=equity(),pl=eq-A.start,fl=floating();
  setT(E.dmEq,rp(eq));setT(E.dmCash,rp(A.cash));
  setNum(E.dmPl,rp(pl)+' ('+sg(pl/A.start*100)+')',pl);
  setNum(E.dmFl,Object.keys(A.pos).length?sr(fl):'—',Object.keys(A.pos).length?fl:null);
  if(lastEq!=null&&Math.abs(eq-lastEq)>=.5){flash(E.dmEq,eq>lastEq);flash(E.dmPl,eq>lastEq)}
  lastEq=eq;
  setT(E.dmWr,`Win rate ${A.n?Math.round(A.w/A.n*100)+'%':'—'} (${A.w}/${A.n} transaksi tutup) · PnL terealisasi ${rp(A.rl)}`);
  const a=Object.values(A.pos),sig=a.map(q=>[q.id,q.qty,q.t1d,q.sl,q.t1,q.t2,q.eu].join(':')).join('|');
  if(sig!==posSig){posSig=sig;
    E.dmPos.innerHTML=a.length?a.map(posHtml).join(''):'<p class="dm-nd">Belum ada posisi. Buka Screener, lalu tekan <b>Entry via Demo</b> di kartu mana pun.</p>'}
  E.dmPos.querySelectorAll('.dm-pos').forEach(el=>{const q=A.pos[el.dataset.id];if(!q)return;
    const v=net(q,q.qty),l=v==null?null:v-q.cost,p=l==null?null:l/q.cost*100,lp=P[q.id]&&P[q.id].u,old=P[q.id]&&stale(q.id);
    setT(el.querySelector('.pq'),nf(q.qty,{maximumSignificantDigits:6}));setT(el.querySelector('.pc'),rp(q.cost));setT(el.querySelector('.pv'),v==null?'—':rp(v));
    const pe=el.querySelector('.pl'),pp=el.querySelector('.pp'),lx=el.querySelector('.lpx');
    const prevL=pe._l;pe._l=l;
    setNum(pe,l==null?'—':sr(l),l);setNum(pp,p==null?'':sg(p),p);
    if(prevL!=null&&l!=null&&Math.abs(l-prevL)>=.5)flash(pe,l>prevL);
    setT(lx,lp?usd(lp)+(old?' ○':''):'—')});
  const hs=A.hist.length+':'+(A.hist[0]?A.hist[0].t:0);
  if(hs!==histSig){histSig=hs;
    const d=t=>new Date(t).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    E.dmHist.innerHTML=A.hist.length?`<table class="dm-t"><tr><th>Waktu</th><th>Aksi</th><th>Aset</th><th>Nilai</th><th>Harga</th><th>PnL</th><th>Ket.</th></tr>${A.hist.slice(0,40).map(h=>`<tr><td>${d(h.t)}</td><td>${esc(h.s)}</td><td>${esc(h.sym)}</td><td>${rp(h.v)}</td><td>${usd(h.p)}</td><td class="${h.pnl>=0?'dm-up':'dm-dn'}">${h.s==='JUAL'||h.s==='COVER'?rp(h.pnl):'—'}</td><td>${esc(h.w)}</td></tr>`).join('')}</table>`:'<p class="dm-nd">Belum ada transaksi.</p>'}
  E.dmSt.innerHTML=`<span><i class="${st.bn?'on':''}"></i>Binance WS</span><span><i class="${st.pump?'on':''}"></i>PumpPortal WS</span><span><i class="${st.dex?'on':''}"></i>DexScreener</span><span>Kurs USDT/IDR ${fx?'Rp '+nf(fx,{maximumFractionDigits:0}):'…'}</span>`}

/* tombol "Akun Demo" di bar screener: selalu menampilkan ekuitas & PnL live */
let bt=null;
function badge(){if(!bt)return;const n=Object.keys(A.pos).length,eq=equity(),pl=eq-A.start;
  const t='Akun Demo · '+rp(eq)+(n?' · '+sr(pl)+' · '+n+' posisi':'');
  if(bt.textContent!==t)bt.textContent=t;
  bt.style.color=n?(pl>=0?'#2ee59d':'#ff5c6c'):''}
let tm=0;
function go(){if(isOpen)paintAcct();if(entryOpen)paintEntry();badge()}
function sched(f){if(f){clearTimeout(tm);tm=0;go();return}if(tm)return;tm=setTimeout(()=>{tm=0;go()},250)}

/* ---------- buka/tutup panel & modal ---------- */
let prevOv='';
function openP(){isOpen=true;root.hidden=false;prevOv=document.body.style.overflow;document.body.style.overflow='hidden';posSig='';histSig='';lastEq=null;start();sync();go()}
function closeP(){isOpen=false;root.hidden=true;document.body.style.overflow=prevOv;idle()}
function openEntry(a){
  cur=a;entryOpen=true;E.deA.value='';E.deT.textContent=`${a.side==='L'?'LONG':'SHORT'} ${a.sym}${a.kind==='c'?'/USDT':''}`;
  em.hidden=false;start();sync();if(a.kind==='c'&&!P[a.id])cexInit(a.sym);go()}
function closeEntry(){entryOpen=false;em.hidden=true;cur=null;sync();idle()}
root.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
  if(t.id==='dmX')return closeP();
  if(t.id==='dmReset'){if(confirm('Reset akun demo? Semua posisi dan riwayat dihapus.')){const s=+E.dmStart.value||10000000;A=fresh(s);save();posSig='';histSig='';lastEq=null;sync();say('Akun direset: '+rp(s),'up');sched(1)}return}
  const pos=t.closest('[data-id]');if(t.dataset.cl&&pos)closePos(pos.dataset.id,+t.dataset.cl)});
em.addEventListener('click',e=>{if(e.target===em)return closeEntry();const t=e.target.closest('button');if(!t)return;
  if(t.id==='deX')return closeEntry();
  if(t.id==='deGo'){if(!cur)return;openPos(cur,amtVal());E.deA.value='';return closeEntry()}
  const d=t.dataset;
  if(d.p){setAmt(Math.floor(A.cash*+d.p));paintEntry()}});
E.deA.addEventListener('input',()=>{const n=amtVal(),s=n?nf(n,{maximumFractionDigits:0}):'';if(E.deA.value!==s)E.deA.value=s;paintEntry()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(entryOpen)closeEntry();else if(isOpen)closeP()});

/* tombol "Entry via Demo" di kartu screener (crypto & sniper): SL/TP diambil dari data kartu */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.dm-go');if(!b)return;e.preventDefault();const d=b.dataset,n=k=>parseFloat(d[k]);
  const a={kind:d.dm,sym:String(d.sym||'').slice(0,24),side:d.dir==='SHORT'?'S':'L',e:n('e'),sl:n('sl'),t1:n('t1'),t2:n('t2')};
  a.name=a.sym;
  if(a.kind==='c'){if(!CX.test(a.sym))return;a.id='c:'+a.sym}
  else if(a.kind==='d'){a.chain=d.chain;if(!CH.has(a.chain)||!okAddr(a.chain,d.tok||''))return;a.addr=key(a.chain,d.tok);a.id='d:'+a.addr}
  else return;
  const L=a.side==='L';
  if(![a.e,a.sl,a.t1,a.t2].every(x=>x>0)||(L?!(a.sl<a.e&&a.e<a.t1&&a.t1<=a.t2):!(a.t2<=a.t1&&a.t1<a.e&&a.e<a.sl)))return say('Level setup tidak valid','dn');
  if(a.kind==='d'&&!L)return say('SHORT tidak tersedia untuk token DEX/pump.fun, hanya LONG','dn');
  openEntry(a)});

const ref=document.getElementById('scrRef');
if(ref){bt=document.createElement('button');bt.type='button';bt.id='dmOpen';ref.after(bt);bt.onclick=openP;badge()}
if(Object.keys(A.pos).length)start();   /* posisi terbuka: TP/SL tetap dipantau selama halaman terbuka */
window.WDDemo={open:openP,close:closeP};
if(window.WD_DEMO_TEST)window.WDDemo._t={openPos,closePos,tick,A:()=>A,setFx:v=>{fx=v;fxAt=Date.now()},setSol:v=>{solUsd=v},calcOpen,net,equity,openEntry:a=>{cur=a},P};
})();
