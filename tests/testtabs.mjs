// Settings are never lost quietly: a second tab cannot write an old config
// over a newer one, a save that does not fit makes room or says so, a config
// that vanishes under an open tab is written back, and a phone's existing
// setup comes through the update byte for byte.
//
// Run with:  node tests/testtabs.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
// index.html is served from a variable so one test can upgrade a page in place.
let html=fs.readFileSync(path.join(ROOT,'index.html'));
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 if(p==='/index.html'){r.writeHead(200,{'Content-Type':'text/html'});return r.end(html)}
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8099,r));
const URL_='http://localhost:8099/index.html';
const mark=(ok,msg)=>console.log((ok?'  ok  ':'*** ')+msg);
const FT='https://www.ft.com/markets?format=rss';
const SEED={migrated:22,autoRefresh:false,proxies:['https://api.allorigins.win/raw?url='],feeds:[
  {id:'f1',cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
  {id:'f2',cat:'Canada',name:'CBC Canada',url:'https://www.cbc.ca/webfeed/rss/rss-canada'},
  {id:'f3',cat:'Business',name:'BBC Business',url:'https://feeds.bbci.co.uk/news/business/rss.xml'}]};

const b=await chromium.launch(CHROME);
const errs=[];
async function newCtx(seed){
  const ctx=await b.newContext({...devices['iPhone 14 Pro']});
  await ctx.route('**/*',route=>{const u=route.request().url();
    if(u.startsWith('http://localhost:8099'))return route.continue();
    if(!u.includes('allorigins'))return route.abort('failed');
    const feed=decodeURIComponent(u.split('url=')[1]||'');
    return route.fulfill({status:200,contentType:'application/xml',headers:{'Access-Control-Allow-Origin':'*'},
      body:`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>${feed} story</title>`
        +`<link>https://x/${encodeURIComponent(feed)}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
  await ctx.addInitScript(s=>{ if(!localStorage.getItem('breaking.v1')) localStorage.setItem('breaking.v1',s); },JSON.stringify(seed));
  return ctx;
}
async function open(ctx){ const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL_); await p.waitForTimeout(800); return p; }
const stored=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
const tapLibrary=async(p,url)=>{ await p.click('#open-feeds'); await p.waitForTimeout(300);
  await p.evaluate(u=>[...document.querySelectorAll('#library .lib button')].find(x=>x.dataset.feed===u).click(),url);
  await p.waitForTimeout(300); await p.click('#close-feeds'); await p.waitForTimeout(300); };
const comeBack=p=>p.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
  document.dispatchEvent(new Event('visibilitychange')); });

/* ---------------------------------------------------- two tabs, one store */
console.log('two tabs');
{
  const ctx=await newCtx(SEED);
  const A=await open(ctx), B=await open(ctx);
  await tapLibrary(A,FT);
  mark((await stored(A)).feeds.some(f=>f.url===FT),'tab A switches FT Markets on, and it is saved');
  await B.waitForTimeout(300);
  mark(await B.evaluate(u=>cfg.feeds.some(f=>f.url===u),FT),'tab B picks it up without a reload');
  mark(await B.evaluate(()=>document.querySelector('#ver').textContent.includes('4 feeds')),'and its feed count in Settings says 4');
  // The bug: any save from the stale tab wrote its old list back.
  await B.evaluate(()=>toggleSource(['https://feeds.bbci.co.uk/news/world/rss.xml'],true));
  let st=await stored(A);
  mark(st.feeds.some(f=>f.url===FT),'tab B switching a source off keeps FT Markets in storage');
  mark(st.hidden.includes('https://feeds.bbci.co.uk/news/world/rss.xml'),'and keeps B\'s own change too');
  await A.waitForTimeout(300);
  mark(await A.evaluate(()=>cfg.hidden.length===1),'tab A picks up B\'s change in turn');
  await A.reload(); await A.waitForTimeout(800);
  mark(await A.evaluate(u=>cfg.feeds.some(f=>f.url===u)&&cfg.hidden.length===1,FT),'a reload of A (the build-update reload) shows both');

  // A storage event missed while a tab was frozen: coming back looks anyway.
  await B.evaluate(()=>{ const c=JSON.parse(localStorage.getItem('breaking.v1')); c.muted=['crypto'];
    localStorage.setItem('breaking.v1',JSON.stringify(c)); });   // B's own write: no event in B
  mark(await B.evaluate(()=>cfg.muted.length===0),'(B has not seen the change yet)');
  await comeBack(B);
  mark(await B.evaluate(()=>cfg.muted[0]==='crypto'),'coming back to the tab reads storage again');

  // The browser drops the site's storage while the tab stays open.
  await B.evaluate(()=>localStorage.removeItem('breaking.v1'));
  await comeBack(B);
  st=await stored(B);
  mark(st&&st.feeds.some(f=>f.url===FT)&&st.muted[0]==='crypto','a config gone from storage is written back from the open tab');
  mark(await B.evaluate(()=>log.some(e=>e.k==='store'&&/missing from storage/.test(e.w||e.why||JSON.stringify(e)))),'and the log says so');
  await ctx.close();
}

/* ------------------------------------------------------------ full storage */
console.log('\nfull storage');
{
  const ctx=await newCtx(SEED);
  const P=await open(ctx);
  // A story cache big enough to matter, then everything else filled to the brim.
  await P.evaluate(()=>{
    items=Array.from({length:400},(_,i)=>({id:'x'+i,title:'x'.repeat(4000),source:'BBC World',ts:Date.now()-i,link:'https://x/'+i}));
    localStorage.setItem('breaking.v1.items',JSON.stringify(items));
    let pad='', chunk=1<<22;
    while(chunk>=8){ try{ localStorage.setItem('pad',pad+'p'.repeat(chunk)); pad+='p'.repeat(chunk);}catch{ chunk>>=1; } }
  });
  await tapLibrary(P,FT);
  let st=await stored(P);
  console.log('  stories left        :',await P.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')).length));
  mark(st.feeds.some(f=>f.url===FT),'a full store makes room in the story cache and the feed is saved');
  mark(await P.evaluate(()=>log.some(e=>JSON.stringify(e).includes('trimmed to'))),'the log says the cache was trimmed for it');

  // Nothing left to trim: it has to say so, not pretend.
  await P.evaluate(()=>{ items=[]; localStorage.setItem('breaking.v1.items','[]');
    let pad=localStorage.getItem('pad'), chunk=1<<22;
    while(chunk>=8){ try{ localStorage.setItem('pad',pad+'p'.repeat(chunk)); pad+='p'.repeat(chunk);}catch{ chunk>>=1; } } });
  const lib2=await P.evaluate(()=>CATALOG.find(f=>!cfg.feeds.some(o=>o.url===f.url)&&!f.paywall).url);
  await tapLibrary(P,lib2);
  const status=await P.textContent('#status');
  console.log('  status              :',status);
  mark(/Couldn't save your settings|Settings not saved/.test(status),'a save that cannot fit says so on the status line');
  mark(await P.evaluate(()=>document.querySelector('#status').classList.contains('err')),'in the error colour');
  mark(!(await stored(P)).feeds.some(f=>f.url===lib2),'(storage really does not have it)');
  mark(await P.evaluate(()=>log.some(e=>JSON.stringify(e).includes('settings not saved'))),'and it is in the log');
  // Room comes back; returning to the tab saves what was waiting.
  await P.evaluate(()=>localStorage.removeItem('pad'));
  await comeBack(P);
  mark((await stored(P)).feeds.some(f=>f.url===lib2),'once there is room, coming back saves it');
  console.log('  status after        :',await P.textContent('#status'));
  await ctx.close();
}

/* --------------------------------------------- the update keeps your setup */
console.log('\nupdate');
{
  const prev=execFileSync('git',['show','HEAD:index.html'],{cwd:ROOT});
  const cur=html; html=prev;
  const ctx=await newCtx(SEED);
  const P=await open(ctx);
  await tapLibrary(P,FT);
  await P.evaluate(()=>{ cfg.muted=['crypto']; cfg.hidden=[cfg.feeds[0].url]; save(); });
  const before=await P.evaluate(()=>localStorage.getItem('breaking.v1'));
  const was=await P.evaluate(()=>BUILD);
  html=cur; await P.reload(); await P.waitForTimeout(800);
  const after=await P.evaluate(()=>localStorage.getItem('breaking.v1'));
  console.log('  ',was,'→',await P.evaluate(()=>BUILD));
  mark(before===after,'the stored config is byte-identical after the update');
  await ctx.close();
}

console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close(); srv.close();
