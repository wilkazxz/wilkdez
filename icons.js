/* =====================================================================
   icons.js - LOGO SEMUA KOIN (CEX + token DEX). Satu resolver untuk seluruh aplikasi.
   Cara kerja: tiap <img> di .av / .cico / .dmav yang gagal dimuat otomatis pindah ke sumber berikutnya:
     koin CEX  : gambar kartu -> CoinGecko (cache) -> Binance -> CoinCap -> spothq -> cari CoinGecko
     token DEX : gambar kartu -> DexScreener -> pump.fun -> API DexScreener -> API GeckoTerminal
   Kalau semua gagal: huruf pertama di lingkaran berwarna (tidak pernah kosong). Hasil pencarian disimpan di browser.
   ===================================================================== */
(()=>{
'use strict';
if(window.WDI)return;
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const getJ=async(u,ms=9000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};
const CG='https://api.coingecko.com/api/v3/',GT={solana:'solana',base:'base',bsc:'bsc',ethereum:'eth'};
const SKIP='#saham,#sscr,#ssGrid,#stChips,#sIco';            /* saham punya sumber ikon sendiri */
let IM=LS('wd_icm',{});                                       /* {SIMBOL: url} dari CoinGecko */
const X=LS('wd_icx',{});                                      /* hasil pencarian: {kunci: url | ''} */
const ok=u=>u&&/^https:\/\//.test(u)&&!/missing/i.test(u);
const base=s=>String(s).toUpperCase().replace(/^(1000000|1000|1M)(?=[A-Z])/,'');   /* 1000PEPE -> PEPE */

/* ---- warna & huruf cadangan ---- */
const hue=n=>{let h=0;for(const c of String(n))h=(h*31+c.charCodeAt(0))%360;return h};
const grad=n=>{const h=hue(n);return `linear-gradient(135deg,hsl(${h} 55% 40%),hsl(${(h+45)%360} 55% 18%))`};

/* ---- daftar sumber (sinkron) ---- */
const cexSrc=s=>{const b=base(s),l=b.toLowerCase();
  return [IM[b],IM[s],`https://bin.bnbstatic.com/static/assets/logos/${b}.png`,`https://assets.coincap.io/assets/icons/${l}@2x.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${l}.png`,X['c:'+b]].filter(ok)};
const dexSrc=(ch,a)=>[`https://dd.dexscreener.com/ds-data/tokens/${ch}/${a}.png`,ch==='solana'&&`https://images.pump.fun/coin-image/${a}?variant=86x86`,X['d:'+ch+a]].filter(ok);
function info(c){                                              /* container -> {k:'c'|'d', s | ch,a} */
  if(c.dataset.ch&&c.dataset.tok)return{k:'d',ch:c.dataset.ch,a:c.dataset.tok,n:c.dataset.l||'?'};
  if(c.dataset.k==='d')return null;                               /* token DEX tanpa chain/kontrak: biarkan handler lama */
  let s=c.dataset.s||c.dataset.sym;
  if(!s&&c.id==='cIco')s=((document.getElementById('cSym')||{}).textContent||'').trim();
  if(!s){const h=c.closest('[data-s]');s=h&&h.dataset.s}
  s=String(s||'').toUpperCase();return/^[A-Z0-9]{1,15}$/.test(s)?{k:'c',s,n:s[0]}:null}
const cands=i=>i.k==='c'?cexSrc(i.s):dexSrc(i.ch,i.a);

/* ---- pencarian async (antrian pelan supaya tidak kena rate limit) ---- */
const Q=[];let busy=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function lookup(key,fn){if(key in X)return Promise.resolve(X[key]);return new Promise(r=>{Q.push([key,fn,r]);pump()})}
async function pump(){if(busy)return;busy=1;
  while(Q.length){const[k,fn,r]=Q.shift();let u;try{u=await fn()}catch(e){}
    if(u!==undefined){X[k]=u||'';SV('wd_icx',X)}r(u||'');await sleep(400)}
  busy=0}
const findC=s=>lookup('c:'+s,async()=>{const j=await getJ(CG+'search?query='+encodeURIComponent(s),8000),
  c=(j.coins||[]).filter(x=>String(x.symbol).toUpperCase()===s&&(x.large||x.thumb)).sort((a,b)=>(a.market_cap_rank||9e9)-(b.market_cap_rank||9e9))[0];
  return c?(c.large||c.thumb):''});
const findD=(ch,a)=>lookup('d:'+ch+a,async()=>{
  try{const j=await getJ('https://api.dexscreener.com/tokens/v1/'+ch+'/'+a,8000),p=(Array.isArray(j)?j:[]).find(x=>x.info&&x.info.imageUrl);if(p)return p.info.imageUrl}catch(e){}
  const n=GT[ch];if(!n)return'';
  const j=await getJ(`https://api.geckoterminal.com/api/v2/networks/${n}/tokens/${a}/info`,8000),u=j&&j.data&&j.data.attributes&&j.data.attributes.image_url;
  return u&&!/missing/i.test(u)?u:''});
const find=i=>i.k==='c'?findC(i.s):findD(i.ch,i.a);

/* ---- tampilan ---- */
function letter(c,i){c._g=1;c.style.background=grad(i.s||i.a||i.n);const L=esc(i.n||'?');
  if(c.classList.contains('cico')){c.textContent=i.n||'?';return}
  if(!c.querySelector('.lt'))c.insertAdjacentHTML('afterbegin','<span class="lt">'+L+'</span>')}
function fail(im,c,i){im.remove();letter(c,i)}
function next(im){
  const c=im.closest('.av,.cico,.dmav');if(!c)return;const i=info(c);if(!i)return;
  (im._t=im._t||new Set()).add(im.getAttribute('src'));
  const u=cands(i).find(x=>!im._t.has(x));
  if(u){im.src=u;return}
  if(im._a)return fail(im,c,i);
  im._a=1;find(i).then(r=>{if(r&&!im._t.has(r)&&im.isConnected)im.src=r;else if(im.isConnected)fail(im,c,i)})}
const mine=im=>{const c=im.closest&&im.closest('.av,.cico,.dmav');return c&&!c.closest(SKIP)&&info(c)?c:null};
document.addEventListener('error',e=>{const im=e.target;if(!im||im.tagName!=='IMG'||!mine(im))return;e.stopImmediatePropagation();next(im)},true);
document.addEventListener('load',e=>{const im=e.target;if(!im||im.tagName!=='IMG')return;const c=mine(im);if(!c)return;
  if(im.naturalWidth<8){next(im);return}                       /* gambar kosong / 1px = dianggap gagal */
  const l=c.querySelector('.lt');if(l)l.remove();if(c._g){c._g=0;c.style.background=''}},true);
/* gambar yang sudah gagal sebelum script ini aktif */
const sweep=r=>(r||document).querySelectorAll('.av img,.cico img,.dmav img').forEach(im=>{if(im.complete&&im.naturalWidth<1&&im.getAttribute('src')&&mine(im))next(im)});

/* ---- peta CoinGecko (top 500), sekali per 6 jam ---- */
async function build(){
  if(Date.now()-LS('wd_icm_t',0)<216e5&&Object.keys(IM).length>200)return;
  const n={};
  for(let pg=1;pg<=2;pg++){
    try{const j=await getJ(CG+'coins/markets?vs_currency=usd&sparkline=false&order=market_cap_desc&per_page=250&page='+pg,15000);
      j.forEach(x=>{const s=String(x.symbol).toUpperCase();if(x.image&&!n[s])n[s]=x.image});IM=Object.assign({},IM,n);if(j.length<250)break}catch(e){break}
    await sleep(1500)}
  if(Object.keys(n).length>100){SV('wd_icm',IM);SV('wd_icm_t',Date.now())}}
setTimeout(build,2000);setTimeout(sweep,1500);

/* ---- API publik ---- */
window.coinIcon=s=>{s=String(s||'?').toUpperCase();const u=cexSrc(s)[0];
  return `<div class="av" data-s="${esc(s)}"><span class="lt">${esc(s[0])}</span>${u?`<img src="${esc(u)}" alt="" decoding="async" referrerpolicy="no-referrer">`:''}</div>`};
window.WDI={want:s=>{s=base(s);if(!IM[s]&&/^[A-Z0-9]{1,15}$/.test(s))findC(s)},grad,esc};
})();
