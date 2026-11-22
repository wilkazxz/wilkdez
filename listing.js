/* =====================================================================
   listing.js  -  SNIPER KOIN BARU LISTING (Binance Spot) + LOGO INSTAN
   Pasang: tambahkan  <script src="listing.js"></script>  tepat sebelum </body>
   (setelah semua <script> lama). Tidak mengubah kode lama.
   ===================================================================== */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const BN=['https://data-api.binance.vision/api/v3/','https://api.binance.com/api/v3/'];
const WSU=['wss://stream.binance.com:9443/stream?streams=!miniTicker@arr','wss://data-stream.binance.vision/stream?streams=!miniTicker@arr'];
const CG='https://api.coingecko.com/api/v3/';
const STB=/^(USDC|FDUSD|TUSD|USDP|DAI|BUSD|AEUR|EUR|EURI|USDE|XUSD|USD1|PYUSD|BFUSD|USDS|UST|GBP|TRY|BRL)$/;
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const getJ=async(u,ms=9000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};
const pool=async(a,fn,n=8)=>{let i=0;await Promise.all(Array.from({length:Math.min(n,a.length)},async()=>{while(i<a.length){const x=a[i++];await fn(x)}}))};

/* ===================== CSS ===================== */
const st=document.createElement('style');
st.textContent=`
.av{position:relative}
.av .lt{position:absolute;inset:0;display:grid;place-items:center;font-weight:600}
.av .lt+img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#111}
.lst-t{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:400;max-width:min(92vw,520px);
  padding:14px 18px;border-radius:16px;border:1px solid #2ee59d;background:rgba(8,24,18,.96);color:#fff;font-size:.92rem;line-height:1.4;cursor:pointer;
  box-shadow:0 10px 40px rgba(0,0,0,.6);transition:transform .35s}
.lst-t.on{transform:translate(-50%,0)}
.lst-t b{color:#2ee59d}
.lst-new{color:#000;background:#2ee59d;border-radius:999px;padding:2px 9px;font-size:.7rem;font-weight:600;margin-left:6px}
.lst-live{color:#ffd166;border:1px solid rgba(255,209,102,.5);border-radius:999px;padding:1px 8px;font-size:.7rem;margin-left:6px}
.sc .lb{display:flex;flex-direction:column;gap:12px}
`;
document.head.appendChild(st);

/* ===================== LOGO: instan, semua koin ===================== */
let IM=LS('wd_icm',{});                     /* {SIMBOL: url logo} dari CoinGecko (top 1000) + pencarian */
const spotI=s=>`https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${s.toLowerCase()}.png`;
const capI=s=>`https://assets.coincap.io/assets/icons/${s.toLowerCase()}@2x.png`;
const srcs=s=>[IM[s],spotI(s),capI(s)].filter(Boolean);
const okSym=s=>/^[A-Z0-9]{1,15}$/.test(s||'');
/* huruf langsung tampil (tanpa jeda), logo menimpa begitu siap */
window.coinIcon=s=>`<div class="av"><span class="lt">${esc(s[0]||'?')}</span><img src="${srcs(s)[0]}" data-s="${s}" alt="" decoding="async" referrerpolicy="no-referrer"></div>`;
const symOf=im=>{if(im.dataset.s)return im.dataset.s;if(im.closest('#cIco'))return(($('cSym')||{}).textContent||'').trim();const h=im.closest('[data-s]');return h?h.dataset.s:''};
const skipSt=im=>im.closest('#saham,#sscr,#ssGrid,#stChips');
function patchOne(im){
  if(skipSt(im))return;const s=symOf(im);if(!okSym(s))return;const u=IM[s];
  if(!u||im.getAttribute('src')===u||(im._t&&im._t.has(u)))return;
  if(im.complete&&im.naturalWidth>0)return;
  im.src=u;
}
const patchAll=()=>document.querySelectorAll('.av img,.cico img').forEach(patchOne);
/* rantai cadangan: kalau satu sumber gagal, coba sumber berikutnya; baru terakhir huruf */
document.addEventListener('error',e=>{
  const im=e.target;if(!im||im.tagName!=='IMG'||!im.closest||!im.closest('.av,.cico')||skipSt(im))return;
  const s=symOf(im);if(!okSym(s))return;
  (im._t=im._t||new Set()).add(im.getAttribute('src'));
  const nx=srcs(s).find(u=>!im._t.has(u));
  if(nx){e.stopImmediatePropagation();im.src=nx}
  else{const l=im.previousElementSibling;if(l&&l.classList&&l.classList.contains('lt'))im.remove()}
},true);
document.addEventListener('load',e=>{const im=e.target;if(im&&im.tagName==='IMG'){const l=im.previousElementSibling;if(l&&l.classList&&l.classList.contains('lt'))l.remove()}},true);
/* ikon yang baru muncul di halaman langsung diganti ke sumber terbaik sebelum sempat kedip */
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;
  if(n.tagName==='IMG')patchOne(n);else if(n.querySelectorAll)n.querySelectorAll('.av img,.cico img').forEach(patchOne)}}).observe(document.body,{childList:true,subtree:true});

const CGM=CG+'coins/markets?vs_currency=usd&sparkline=false&order=market_cap_desc&per_page=250&page=';
async function buildIcons(){
  if(Date.now()-LS('wd_icm_t',0)<216e5&&Object.keys(IM).length>300){patchAll();return}
  const n={};
  for(let pg=1;pg<=4;pg++){
    try{const j=await getJ(CGM+pg,15000);
      j.forEach(x=>{const s=String(x.symbol).toUpperCase();if(x.image&&!n[s])n[s]=x.image});
      IM=Object.assign({},IM,n);patchAll();
      if(j.length<250)break}catch(e){break}
    await new Promise(r=>setTimeout(r,1200));
  }
  if(Object.keys(n).length>200){SV('wd_icm',IM);SV('wd_icm_t',Date.now())}
}
/* pra-muat gambar semua koin Binance ke cache browser supaya tampil tanpa jeda */
async function preload(){
  let l=[];try{l=window.coinList?await window.coinList():[]}catch(e){}
  const a=l.slice(0,600).map(x=>x.s);let i=0;
  const step=()=>{for(let k=0;k<15&&i<a.length;k++,i++){const im=new Image();im.referrerPolicy='no-referrer';im.src=IM[a[i]]||spotI(a[i])}if(i<a.length)setTimeout(step,120)};step();
}
/* koin yang belum ada di daftar (listing baru): cari satu per satu, pelan-pelan */
const iq=[],ip=new Set();let iT=0;
function wantIcon(s){if(IM[s]||ip.has(s))return;ip.add(s);iq.push(s);if(!iT)iT=setTimeout(nextIcon,300)}
async function nextIcon(){
  iT=0;const s=iq.shift();if(!s)return;
  try{const j=await getJ(CG+'search?query='+encodeURIComponent(s),8000),
      c=(j.coins||[]).find(x=>String(x.symbol).toUpperCase()===s&&(x.large||x.thumb));
    if(c){IM[s]=c.large||c.thumb;SV('wd_icm',IM);patchAll();document.querySelectorAll(`#lstGrid img[data-s="${s}"]`).forEach(im=>{if(!(im.complete&&im.naturalWidth>0)){im._t=null;im.src=IM[s]}})}}catch(e){}
  if(iq.length)iT=setTimeout(nextIcon,2300);
}
setTimeout(()=>{buildIcons().then(preload)},1500);
if(Object.keys(IM).length)setTimeout(patchAll,0);

/* ===================== SNIPER LISTING BARU ===================== */
const lt=LS('wd_lt',{});                    /* {S:{t:waktu listing(ms), o:harga pembukaan pertama, est:1 bila perkiraan}} */
let known=new Set(LS('wd_known',[]));       /* semua pasangan USDT yang sudah pernah terlihat */
const det=LS('wd_det',{});                  /* koin yang terdeteksi listing saat halaman terbuka */
const syms=new Set(),tick={},E={};
let isOpen=false,alertOn=LS('wd_lal',1)!==0,WIN=30,FL='all',q='',lim=48,seeded=false,hostI=0;
let ws=null,wsOn=false,wsDelay=1000,wsHost=0,raf=0,t10=0,t20=0,scanN=0,scanT=0,toastT=0,ctx=null;

/* ---- markup panel ---- */
const panel=document.createElement('div');
panel.id='lst';panel.className='scr';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Listing Baru');
panel.innerHTML=`<div class="scr-in">
 <div class="scr-top"><div><p class="btc-tag"><i class="live" id="lstLive"></i>Sniper Listing Baru · Binance Spot</p><h2>Koin Baru Listing</h2></div><button class="scr-x" id="lstX" type="button" aria-label="Tutup">×</button></div>
 <div class="scr-bar">
  <div class="seg" id="lstWin" role="group" aria-label="Umur listing">
   <button type="button" data-v="1" aria-pressed="false">24j</button><button type="button" data-v="7" aria-pressed="false">7H</button><button type="button" data-v="30" aria-pressed="true">30H</button><button type="button" data-v="90" aria-pressed="false">90H</button></div>
  <div class="seg" id="lstFl" role="group" aria-label="Filter">
   <button type="button" data-v="all" aria-pressed="true">Semua</button><button type="button" data-v="ok" aria-pressed="false">Layak</button><button type="button" data-v="live" aria-pressed="false">Terdeteksi live</button></div>
  <input class="scr-q" id="lstQ" type="search" enterkeyhint="search" placeholder="Cari koin baru…" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Cari koin baru">
  <button class="btn btn-ghost btn-sm" id="lstAl" type="button"></button>
 </div>
 <div class="scr-meta"><span id="lstMeta">Memuat…</span><button type="button" id="lstRef">Refresh</button></div>
 <div class="scr-grid" id="lstGrid"></div>
 <p class="scr-note"><b>Cara kerja.</b> Daftar pasangan USDT Binance Spot dipantau lewat WebSocket realtime (harga semua koin). Begitu muncul pasangan yang belum pernah ada, aplikasi mengirim <b>alert</b> (toast, bunyi, dan notifikasi browser bila diizinkan). Umur listing tiap koin diambil dari <b>candle pertama</b> di Binance. Kartu menampilkan harga listing, harga sekarang, dan perubahan dari listing. <b>Entry · SL · TP</b> dihitung dari candle (1 menit untuk koin &lt;2 jam, 5 menit &lt;12 jam, 15 menit sisanya) dengan EMA, RSI, MACD, ATR, dan volume; butuh minimal 60 candle, jadi koin yang baru beberapa menit akan berstatus <b>Menunggu</b>. Hanya setup LONG yang ditampilkan karena ini pasar spot. Skor ini <b>teknikal saja</b>, tidak ada data fundamental untuk koin yang baru listing.<br><b>Batas yang jujur:</b> deteksi dimulai saat pasangan sudah bisa diperdagangkan, bukan dari pengumuman Binance (API pengumuman tidak bisa dipanggil langsung dari browser). Alert di latar belakang memakai polling tiap 15 detik selama tab/aplikasi masih terbuka; saat panel ini terbuka deteksi hampir seketika. Koin baru sering sangat volatil, ada risiko wick ekstrem dan harga turun tajam setelah pump awal. Level hanya acuan hitungan, bukan saran investasi, tidak ada jaminan profit (DYOR).</p>
</div>`;
document.body.appendChild(panel);
const toastEl=document.createElement('div');toastEl.className='lst-t';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);

/* ---- tombol masuk: menu Screener, panel Market, dan di dalam screener ---- */
function addBtn(host,cls){if(!host||host.querySelector('[data-lst]'))return;const b=document.createElement('button');b.type='button';b.setAttribute('data-lst','');b.textContent='Listing Baru (Sniper)';if(cls)b.className=cls;host.appendChild(b)}
addBtn(document.querySelector('.dd-list [data-scr]')&&document.querySelector('.dd-list [data-scr]').parentElement);
addBtn(document.querySelector('#market .btc-ctl'),'btn btn-ghost btn-sm');
addBtn(document.querySelector('#scr .scr-bar'),'btn btn-ghost btn-sm');
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-lst]')){wakeAudio();openL()}});

/* ---- util tampilan ---- */
const ageT=ms=>{const s=Math.max(0,ms/1000);return s<60?Math.floor(s)+' dtk':s<3600?Math.floor(s/60)+' mnt':s<172800?(s/3600).toFixed(1)+' jam':Math.floor(s/86400)+' hari'};
const dT=t=>new Date(t).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const fpx=p=>!(p>0)?'—':p>=1?'$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:p>=100?2:4}):'$'+p.toFixed(Math.min(12,Math.ceil(-Math.log10(p))+3));
const sg=v=>(v>=0?'+':'')+v.toFixed(Math.abs(v)>=100?0:2)+'%';
const cpt=v=>v==null||isNaN(v)?'—':'$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const pr=s=>tick[s]&&tick[s].p>0?tick[s].p:(E[s]&&E[s].cs&&E[s].cs.length?E[s].cs[E[s].cs.length-1].c:0);

/* ---- audio + alert ---- */
function wakeAudio(){try{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch(e){}}
function beep(){try{wakeAudio();if(!ctx)return;[0,.16,.32].forEach((d,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=[880,1100,1320][i];
  g.gain.setValueAtTime(.0001,ctx.currentTime+d);g.gain.exponentialRampToValueAtTime(.2,ctx.currentTime+d+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+d+.14);
  o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+d);o.stop(ctx.currentTime+d+.16)})}catch(e){}}
function toast(html){toastEl.innerHTML=html;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),14000)}
toastEl.onclick=()=>{toastEl.classList.remove('on');openL()};
function announce(list){
  if(!alertOn||!list.length)return;
  const names=list.length>3?list.length+' koin baru':list.map(s=>s+'/USDT').join(', ');
  toast(`<b>LISTING BARU</b> · ${esc(names)} sudah bisa diperdagangkan di Binance. Ketuk untuk lihat.`);
  beep();
  try{if('Notification' in window&&Notification.permission==='granted')new Notification('Listing baru Binance',{body:names+' baru listing'})}catch(e){}
  try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
}
function alBtn(){$('lstAl').textContent='Alert: '+(alertOn?'ON':'OFF')}
$('lstAl').onclick=()=>{alertOn=!alertOn;SV('wd_lal',alertOn?1:0);alBtn();wakeAudio();
  if(alertOn){try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()}catch(e){}beep()}
  bgSet()};
alBtn();

/* ---- data: daftar pasangan USDT + deteksi listing baru ---- */
async function fetchPrices(){
  for(let k=0;k<BN.length;k++){const i=(hostI+k)%BN.length;
    try{const j=await getJ(BN[i]+'ticker/price',10000);hostI=i;return j}catch(e){}}
  return null;
}
function handleNew(list){
  const fresh=list.filter(s=>!known.has(s));if(!fresh.length)return;
  fresh.forEach(s=>{known.add(s);syms.add(s);det[s]=det[s]||Date.now();lt[s]=lt[s]||{t:Date.now(),o:pr(s)||0,est:1};wantIcon(s)});
  SV('wd_known',[...known]);SV('wd_known_t',Date.now());SV('wd_det',det);SV('wd_lt',lt);
  announce(fresh);
  setTimeout(()=>scanFirst(fresh),isOpen?4000:20000);
  if(isOpen)render();
}
async function seed(){
  const j=await fetchPrices();if(!j)return false;
  const cur=[];
  j.forEach(x=>{if(x.symbol.endsWith('USDT')){const s=x.symbol.slice(0,-4);if(s&&!STB.test(s)){cur.push(s);syms.add(s);if(!tick[s])tick[s]={p:+x.price}}}});
  if(!known.size){known=new Set(cur);SV('wd_known',cur);SV('wd_known_t',Date.now())}
  else handleNew(cur);
  seeded=true;return true;
}
const kl=async(s,iv,n,st0)=>{
  for(let k=0;k<BN.length;k++){const i=(hostI+k)%BN.length;
    try{const j=await getJ(`${BN[i]}klines?symbol=${s}USDT&interval=${iv}&limit=${n}${st0!=null?'&startTime='+st0:''}`);hostI=i;return j}catch(e){}}
  return null};
/* umur listing = candle 1 menit pertama koin itu di Binance (disimpan permanen) */
async function scanFirst(list){
  const need=list.filter(s=>!lt[s]||lt[s].est);if(!need.length)return;
  scanN+=need.length;let dirty=0;
  await pool(need,async s=>{
    const j=await kl(s,'1m',1,0);scanN--;
    if(j&&j[0]){lt[s]={t:j[0][0],o:+j[0][1]};dirty++;if(dirty%25===0){SV('wd_lt',lt);if(isOpen)softRender()}}
  },8);
  SV('wd_lt',lt);if(isOpen)render();
}
let sr=0;const softRender=()=>{clearTimeout(sr);sr=setTimeout(render,500)};

/* ---- kartu ---- */
const view=()=>{const now=Date.now(),win=WIN*864e5;let a=[];
  syms.forEach(s=>{const L=lt[s];if(L&&now-L.t<=win)a.push(s)});
  if(q)a=a.filter(s=>s.includes(q));
  if(FL==='live')a=a.filter(s=>det[s]);
  if(FL==='ok')a=a.filter(s=>E[s]&&E[s].ok);
  return a.sort((x,y)=>lt[y].t-lt[x].t)};
const mk=s=>{const el=document.createElement('article');el.className='sc';el.dataset.s=s;
  el.innerHTML=`<div class="sc-h">${window.coinIcon(s)}<div class="sc-n"><b>${s}/USDT</b><small class="ag"></small></div><div class="cp"><b class="lp2">—</b><small class="ch2">—</small></div></div><div class="lb"></div>`;
  wantIcon(s);return el};

function mini(cs,c,p){
  cs=cs.slice(-60);if(cs.length<5)return '';
  const W=320,H=150,R=40,n=cs.length,cw=(W-R)/n,lv=c?[c.entry,c.tp1,c.tp2,c.sl]:[];
  let mn=Math.min(...cs.map(x=>x.l),...lv),mx=Math.max(...cs.map(x=>x.h),...lv);const pd=(mx-mn)*.05||mx*.001;mn-=pd;mx+=pd;
  const Y=v=>H-(v-mn)/(mx-mn)*H,f=v=>Y(v).toFixed(1),bw=Math.max(1,cw*.62);
  let k='';
  cs.forEach((d,i)=>{const x=i*cw+cw/2,cl=d.c>=d.o?'#2ee59d':'#ff5c6c',yo=Y(d.o),yc=Y(d.c);
    k+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${f(d.h)}" y2="${f(d.l)}" stroke="${cl}" stroke-width="1"/><rect x="${(x-bw/2).toFixed(1)}" y="${Math.min(yo,yc).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,Math.abs(yo-yc)).toFixed(1)}" fill="${cl}"/>`});
  const ln=(v,col,lb,dash)=>`<line x1="0" x2="${W-R}" y1="${f(v)}" y2="${f(v)}" stroke="${col}" stroke-width="1" ${dash?'stroke-dasharray="4 3"':''}/><text x="${W-R+4}" y="${Math.max(9,Math.min(H-2,Y(v)+3)).toFixed(1)}" fill="${col}">${lb}</text>`;
  let l='';
  if(c)l=ln(c.tp2,'#2ee59d','TP2',1)+ln(c.tp1,'#2ee59d','TP1',1)+ln(c.entry,'rgba(255,255,255,.75)','ENTRY',0)+ln(c.sl,'#ff5c6c','SL',1);
  const lc=cs[n-1],lcol=(p||lc.c)>=lc.o?'#2ee59d':'#ff5c6c';
  l+=`<line x1="0" x2="${W-R}" y1="${f(p||lc.c)}" y2="${f(p||lc.c)}" stroke="${lcol}" stroke-width=".8" stroke-dasharray="1 3"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Candle">${k}${l}</svg>`;
}
function body(s){
  const e=E[s]||{},L=lt[s],p=pr(s),t=tick[s],age=Date.now()-L.t,f=L.o>0&&p?(p/L.o-1)*100:null,c=e.c,fl=[];
  if(age<9e5)fl.push('Sangat baru: spread & wick ekstrem');
  if(f!=null&&f>300)fl.push('Sudah naik '+f.toFixed(0)+'% dari listing');
  if(t&&t.q!=null&&t.q<1e5)fl.push('Volume 24j tipis');
  const iv=(e.iv||'1m').replace('m',' mnt');
  let cs=e.cs;
  if(cs&&cs.length&&p>0){cs=cs.slice();const l=cs[cs.length-1];cs[cs.length-1]={t:l.t,o:l.o,h:Math.max(l.h,p),l:Math.min(l.l,p),c:p,v:l.v}}
  const badge=e.ok?'<span class="dir LONG">LAYAK ENTRY</span>':c&&c.dir==='SHORT'?'<span class="dir SHORT">TREN TURUN</span>':'<span class="st">MENUNGGU</span>';
  let lv='',ex='';
  if(c&&c.dir==='LONG'){
    const r=(p-c.entry)/c.risk,stt=window.TA?window.TA.stat(c,p):{t:'',k:'ok'};
    lv=`<div class="lv"><div class="e"><small>Entry</small><b>${fpx(c.entry)}</b></div><div class="s"><small>Stop Loss</small><b>${fpx(c.sl)}</b><i>${sg((c.sl/c.entry-1)*100)}</i></div><div class="t"><small>TP1 (1.5R)</small><b>${fpx(c.tp1)}</b><i>${sg((c.tp1/c.entry-1)*100)}</i></div><div class="t"><small>TP2 (2.5R)</small><b>${fpx(c.tp2)}</b><i>${sg((c.tp2/c.entry-1)*100)}</i></div></div>
    <div class="sc-l"><span>Live <b>${fpx(p)}</b></span><span class="lr">${r>=0?'+':''}${r.toFixed(2)}R</span><span class="st ${stt.k}">${stt.t}</span></div>`;
    ex=`<b>Kenapa:</b> ${esc(c.tags.join(', '))}. Skor teknikal ${c.tech.toFixed(1)}/10 di candle ${iv}. SL di bawah swing 8 candle (min. 1 ATR), TP1 1.5R dan TP2 2.5R. Masuk saat status <b>Zona entry</b>; bila harga sudah jauh dari entry, tunggu pullback.`;
  }else ex=e.msg||'Menganalisa candle…';
  return `<div class="vd">${badge}<span>Candle ${iv}${e.cs?' · '+e.cs.length+' bar':''}</span></div>
  <div class="cc">${cs?mini(cs,c&&c.dir==='LONG'?c:null,p):''}</div>
  <div class="fc"><div><small>Harga listing${L.est?' ≈':''}</small><b>${L.o>0?fpx(L.o):'—'}</b></div><div><small>Sekarang</small><b>${fpx(p)}</b></div><div><small>Dari listing</small><b>${f==null?'—':sg(f)}</b></div><div><small>Vol 24j</small><b>${t&&t.q!=null?cpt(t.q):'—'}</b></div></div>
  ${lv}<p class="ex">${ex}</p>
  <div class="tags">${fl.map(x=>`<span class="rk">${esc(x)}</span>`).join('')}<a href="https://www.binance.com/en/trade/${s}_USDT" target="_blank" rel="noopener">Trade di Binance</a><button type="button" data-an="${s}">Analisa penuh</button><button type="button" data-cp="${s}">Salin kode</button></div>`;
}
function paintHead(s,el){
  const L=lt[s],age=Date.now()-L.t,p=pr(s),t=tick[s];
  el.querySelector('.ag').innerHTML=`Listing ${ageT(age)} lalu · ${dT(L.t)}${age<36e5?'<span class="lst-new">BARU</span>':''}${det[s]?'<span class="lst-live">terdeteksi live</span>':''}`;
  el.querySelector('.lp2').textContent=fpx(p);
  const h=el.querySelector('.ch2');
  if(t&&t.o>0){const d=(p/t.o-1)*100;h.textContent=sg(d)+' · 24j';h.className='ch2 '+(d>=0?'up':'dn')}else{h.textContent='';h.className='ch2'}
}
function paint(s){
  const el=$('lstGrid').querySelector(`.sc[data-s="${s}"]`);if(!el||!lt[s])return;
  paintHead(s,el);el.querySelector('.lb').innerHTML=body(s);
}
function paintPrices(){raf=0;if(!isOpen)return;
  $('lstGrid').querySelectorAll('.sc').forEach(el=>{const s=el.dataset.s;if(lt[s])paintHead(s,el)})}
function render(){
  const a=view(),g=$('lstGrid'),show=a.slice(0,lim),key=show.join();
  if(g._k!==key||!show.length){
    const have={};g.querySelectorAll('.sc').forEach(el=>have[el.dataset.s]=el);
    if(show.length){const fr=document.createDocumentFragment();show.forEach(s=>fr.appendChild(have[s]||mk(s)));g.replaceChildren(fr)}
    else g.innerHTML=`<div class="scr-empty">${scanN>0||!seeded?'Memindai umur listing semua koin… tunggu sebentar.':FL==='live'?'Belum ada listing baru terdeteksi sejak panel dibuka. Alert akan muncul otomatis begitu ada.':FL==='ok'?'Belum ada koin baru yang punya setup layak. Coba filter Semua.':'Tidak ada koin listing dalam rentang ini.'}</div>`;
    g._k=key;
  }
  if(a.length>lim&&!g.querySelector('.more')){const d=document.createElement('div');d.className='scr-empty more';d.innerHTML=`<button type="button" class="mr">Tampilkan lagi (${a.length-lim})</button>`;g.appendChild(d)}
  show.forEach(paint);
  $('lstMeta').textContent=`${a.length} koin listing ≤ ${WIN===1?'24 jam':WIN+' hari'} · ${syms.size} pasangan dipantau`+(scanN>0?` · memindai umur listing (${scanN} sisa)`:'')+` · harga ${wsOn?'live (WebSocket)':'polling'}`;
  kick(show);
}

/* ---- analisa candle (Entry/TP/SL) untuk kartu yang tampil ---- */
async function ana(s){
  const e=E[s]=E[s]||{};if(e.busy)return;e.busy=1;
  const L=lt[s],age=Date.now()-L.t,iv=age<72e5?'1m':age<432e5?'5m':'15m';
  const j=await kl(s,iv,150);e.busy=0;e.at=Date.now();
  if(!j||!isOpen){if(!e.cs)e.msg='Candle belum bisa dimuat. Coba Refresh.';return}
  const cs=j.map(x=>({t:x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}));
  e.cs=cs;e.iv=iv;e.c=null;e.ok=false;
  if(cs.length<62)e.msg=`<b>Menunggu.</b> Baru ${Math.max(0,cs.length-1)} candle ${iv.replace('m',' mnt')} yang sudah close, butuh 60 untuk menghitung Entry/TP/SL. Pantau terus; analisa diperbarui otomatis.`;
  else if(!window.TA)e.msg='Modul analisa belum siap.';
  else{
    const c=window.TA.analyze(s,cs,0,'',1);
    if(!c)e.msg='Data belum cukup untuk dianalisis.';
    else if(c.none)e.msg=`<b>Belum ada zona entry.</b> Skor teknikal ${c.sc.toFixed(1)} dari 12 (butuh minimal 6). Kondisi: ${c.cond}.`;
    else if(c.dir==='SHORT')e.msg='<b>Tren turun.</b> Kondisi condong SHORT; di pasar spot sebaiknya tidak entry. Tunggu pembalikan.';
    else{e.c=c;e.ok=c.tech>=5.5&&age>=9e5;if(!e.ok)e.msg=''}
  }
  paint(s);
}
function kick(show){
  const top=show.slice(0,24).filter(s=>!E[s]||!E[s].at||Date.now()-E[s].at>25e3);
  if(top.length)pool(top,ana,6);
}

/* ---- WebSocket: harga semua koin + deteksi listing instan ---- */
function liveDot(){const d=$('lstLive');if(d)d.style.background=wsOn?'#2ee59d':'#888'}
function wsStart(){
  if(ws||!isOpen||!seeded||!('WebSocket' in window))return;
  let w;try{w=new WebSocket(WSU[wsHost%WSU.length])}catch(e){return}
  ws=w;
  w.onopen=()=>{wsDelay=1000;wsOn=true;liveDot()};
  w.onmessage=e=>{try{const a=JSON.parse(e.data).data;if(!Array.isArray(a))return;const nw=[];
    a.forEach(x=>{if(!x.s.endsWith('USDT'))return;const s=x.s.slice(0,-4);if(STB.test(s))return;
      tick[s]={p:+x.c,o:+x.o,q:+x.q};
      if(known.size>50&&!known.has(s))nw.push(s)});
    if(nw.length)handleNew(nw);
    if(!raf)raf=requestAnimationFrame(paintPrices)}catch(_){}};
  w.onclose=()=>{if(ws===w){ws=null;wsOn=false;liveDot();wsHost++;if(isOpen)setTimeout(wsStart,wsDelay);wsDelay=Math.min(wsDelay*2,15000)}};
  w.onerror=()=>{try{w.close()}catch(_){}};
}
function wsStop(){const w=ws;ws=null;wsOn=false;liveDot();if(w){w.onclose=null;try{w.close()}catch(_){}}}

/* ---- polling ringan di latar belakang (alert tetap jalan walau panel tertutup) ---- */
let bg=0;
async function bgPoll(){if(!alertOn||(isOpen&&wsOn)||document.hidden&&false)return;await seed()}
function bgSet(){clearInterval(bg);bg=0;if(alertOn)bg=setInterval(bgPoll,15000)}
setTimeout(()=>{if(alertOn)seed();bgSet()},3500);

/* ---- buka / tutup ---- */
async function openL(){
  if(isOpen)return;isOpen=true;
  if(window.setMenu)window.setMenu(false);
  panel.hidden=false;document.body.style.overflow='hidden';$('lstX').focus({preventScroll:true});
  $('lstMeta').textContent='Memuat daftar koin…';
  if(!seeded)await seed();
  if(!isOpen)return;
  render();wsStart();
  scanFirst([...syms]);
  t10=setInterval(()=>{if(!document.hidden){if(!wsOn)seed();paintPrices();render()}},10000);
  t20=setInterval(()=>{if(!document.hidden)bgPoll()},20000);
}
function closeL(){
  if(!isOpen)return;isOpen=false;panel.hidden=true;
  clearInterval(t10);clearInterval(t20);wsStop();
  document.body.style.overflow=[...document.querySelectorAll('.scr')].some(x=>!x.hidden)?'hidden':'';
}
$('lstX').onclick=closeL;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen)closeL()});
document.addEventListener('visibilitychange',()=>{if(isOpen&&!document.hidden){if(!ws)wsStart();render()}});
$('lstRef').onclick=()=>{Object.keys(E).forEach(s=>{if(E[s])E[s].at=0});seed().then(render)};
function seg(el,fn){el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset.v)})}
seg($('lstWin'),v=>{WIN=+v;lim=48;render()});
seg($('lstFl'),v=>{FL=v;lim=48;render()});
let qt=0;
$('lstQ').addEventListener('input',e=>{clearTimeout(qt);qt=setTimeout(()=>{q=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').slice(0,12);lim=48;render()},250)});
$('lstGrid').addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('.mr')){lim+=48;render();return}
  const a=t.closest('[data-an]');if(a&&window.openScrFor){closeL();window.openScrFor(a.dataset.an);return}
  const c=t.closest('[data-cp]');
  if(c){try{navigator.clipboard.writeText(c.dataset.cp);const o=c.textContent;c.textContent='Tersalin ✓';setTimeout(()=>c.textContent=o,1400)}catch(_){}}
});
})();
