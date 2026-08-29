// Five relays, most of them bad: how long a refresh takes, which relay each
// feed ends up on, and whether one dead relay costs every feed a timeout.
//
// Run with:  node tests/testrelays.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8090,r));

// The reader's actual relay list. dead.test never answers, slow.test answers
// after 9s (past the per-attempt timeout), broken.test 502s, and only the
// last two work - which is the shape of the problem being fixed.
const PROXIES=[
 'https://dead.test/p?url=',
 'https://slow.test/p?url=',
 'https://broken.test/p?url=',
 'https://good.test/p?url=',
 'https://alsogood.test/p?url='];
const FEEDS=Array.from({length:8},(_,i)=>({id:'f'+i,cat:i<3?'World':i<6?'Business':'Canada',
 name:'feed'+i,url:'https://pub'+i+'.test/rss'}));

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
const hits={};                       // relay host -> requests it received
const body=id=>{const items=Array.from({length:10},(_,i)=>
  `<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return `<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`;};

await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8090'))return route.continue();
 const host=new URL(u).host;
 hits[host]=(hits[host]||0)+1;
 const id=(decodeURIComponent(u).match(/\/\/(pub\d+)\.test/)||[])[1]||'x';
 if(host.endsWith('pub0.test')||/^pub\d/.test(host)) return route.abort('failed');   // no CORS anywhere: direct always fails
 if(host==='dead.test')   return new Promise(()=>{});                     // hangs forever
 if(host==='slow.test'){ await new Promise(r=>setTimeout(r,9000)); return route.fulfill({status:200,contentType:'application/xml',body:body(id)}); }
 if(host==='broken.test') return route.fulfill({status:502,contentType:'text/plain',body:'bad gateway'});
 return route.fulfill({status:200,contentType:'application/xml',body:body(id)});});

const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(x=>localStorage.setItem('breaking.v1',x),
  JSON.stringify({migrated:13,idleResetMin:0,proxies:PROXIES,feeds:FEEDS}));

const t0=Date.now();
await page.goto('http://localhost:8090/index.html');
const settled=async()=>page.evaluate(()=>document.querySelector('#status').textContent);

// how long before the reader gets the screen back
let freed=0;
for(let i=0;i<200;i++){
  const busy=await page.evaluate(()=>document.body.classList.contains('busy'));
  if(!busy){freed=Date.now()-t0;break;}
  await page.waitForTimeout(100);
}
console.log('=== a launch with three bad relays out of five ===');
console.log('screen handed back after :', freed+'ms', freed<6000?'(bounded)':'*** HELD TOO LONG ***');
console.log('  status then            :', await settled());

await page.waitForTimeout(9000);
const h1=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.health')));
const okCount=Object.values(h1).filter(x=>x.ok).length;
console.log('feeds working            :', okCount+'/'+FEEDS.length, okCount===FEEDS.length?'':'*** SOME FEEDS FAILED ***');
console.log('total time to all feeds  :', (Date.now()-t0)+'ms');
console.log('status                   :', await settled());
console.log('requests per relay       :', Object.entries(hits).filter(([h])=>h.includes('good')||h.includes('dead')||h.includes('slow')||h.includes('broken'))
  .map(([h,n])=>h+'×'+n).join(', '));
const rel=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.relays')||'{}'));
console.log('relay scoreboard         :', Object.entries(rel).map(([h,s])=>`${h} ${s.ok}ok/${s.fail}bad${s.until>Date.now()?' cooling':''}`).join(' · '));
// A cold start has to try them to find out - eight feeds launched at once all
// ask the dead relay before any of them has learned anything. What matters is
// the next refresh.
console.log('dead relay on the cold run:', hits['dead.test']||0, 'requests (nothing was known yet)');

console.log('\n=== a second launch two seconds later ===');
hits.__mark=1; const before=JSON.stringify(hits);
await page.reload(); await page.waitForTimeout(3000);
const after=JSON.stringify(hits);
console.log('refetched anything       :', before===after?'no (served the cache)':'yes');
console.log('  status                 :', await settled());

console.log('\n=== the arrow always refetches, now that the relays are known ===');
const n0=hits['good.test']||0, d0=hits['dead.test']||0, s0=hits['slow.test']||0, t1=Date.now();
await page.click('#refresh');
let took=0;
for(let i=0;i<120;i++){ await page.waitForTimeout(100);
  if(/^Updated/.test(await settled())){took=Date.now()-t1;break;} }
const dead2=(hits['dead.test']||0)-d0, slow2=(hits['slow.test']||0)-s0;
console.log('good.test requests       :', (hits['good.test']||0)-n0, ((hits['good.test']||0)-n0)>0?'(refetched)':'*** IGNORED THE ARROW ***');
console.log('dead + slow relays asked :', dead2+slow2, dead2+slow2===0?'(sitting out)':'*** STILL BEING TRIED ***');
console.log('  status                 :', await settled());
console.log('  time to finish         :', took+'ms', took<4000?'(no longer paying for the bad relays)':'*** STILL SLOW ***');
const h2=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.health')));
const fingerprinted=Object.values(h2).filter(x=>x.sig).length;
console.log('feeds with a fingerprint :', fingerprinted+'/'+FEEDS.length, fingerprinted===FEEDS.length?'':'*** MISSING ***');

console.log('\n'+(errs.length?'*** ERRORS '+errs.join(';'):'no JS errors'));
await ctx.close();

// The failure mode from a real log: one relay was serving most feeds happily
// and returned 4xx for two of them, which benched it for everything - and the
// feeds that only it could reach then had no route at all.
console.log('\n=== a 4xx on one feed must not bench the relay for the rest ===');
{
  const hits2={};
  const ctx2=await b.newContext({...devices['iPhone 14 Pro']});const p2=await ctx2.newPage();
  const FEEDS2=Array.from({length:6},(_,i)=>({id:'g'+i,cat:'World',name:'feed'+i,url:'https://pub'+i+'.test/rss'}));
  await ctx2.route('**/*',async route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8090'))return route.continue();
   const host=new URL(u).host;
   hits2[host]=(hits2[host]||0)+1;
   const d=decodeURIComponent(u);
   const id=(d.match(/\/\/(pub\d+)\.test/)||[])[1]||'x';
   if(/^pub\d/.test(host)) return route.abort('failed');
   // picky.test will not proxy two particular feeds, and is fine with the rest
   if(host==='picky.test'){
     if(id==='pub0'||id==='pub1') return route.fulfill({status:406,contentType:'text/plain',body:'no'});
     return route.fulfill({status:200,contentType:'application/xml',body:body(id)});
   }
   return new Promise(()=>{});                       // the other relay hangs
  });
  await p2.addInitScript(x=>localStorage.setItem('breaking.v1',x),
    JSON.stringify({migrated:13,idleResetMin:0,feeds:FEEDS2,
      proxies:['https://picky.test/p?url=','https://hangs.test/p?url=']}));
  await p2.goto('http://localhost:8090/index.html');
  await p2.waitForTimeout(9000);
  const h=await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.health')));
  const rel=await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.relays')||'{}'));
  const good=Object.values(h).filter(x=>x.ok).length;
  console.log('feeds working        :', good+'/6', good===4?'(the four it will serve)':good<4?'*** THE RELAY WAS BENCHED FOR EVERYONE ***':'');
  const picky=rel['picky.test']||{};
  console.log('picky.test record    :', picky.ok+' ok / '+picky.fail+' failed',
    picky.until>Date.now()?'*** BENCHED OVER A PER-FEED 4xx ***':'(still in play)');
  const lg=await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.log')||'[]'));
  const benched=lg.filter(e=>e.k==='relay').map(e=>e.n);
  console.log('benchings logged     :', JSON.stringify(benched),
    benched.includes('hangs.test')?'(the one that really is down)':'*** the dead relay was benched with nothing said');
  await ctx2.close();
}
// Straight from a real log: one relay answered every feed, and the two that
// lost the race were benched within two feeds of the refresh starting - so
// every later feed had one route, and the leader could never be unseated.
console.log('\n=== losing a race must not bench a relay ===');
{
  const ctx3=await b.newContext({...devices['iPhone 14 Pro']});const p3=await ctx3.newPage();
  const FEEDS3=Array.from({length:10},(_,i)=>({id:'h'+i,cat:'World',name:'feed'+i,url:'https://pub'+i+'.test/rss'}));
  await ctx3.route('**/*',async route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8090'))return route.continue();
   const host=new URL(u).host;
   const id=(decodeURIComponent(u).match(/\/\/(pub\d+)\.test/)||[])[1]||'x';
   if(/^pub\d/.test(host)) return route.abort('failed');
   // quick.test must be slower than the 1.8s hedge, or the others are never
   // started and there is no race to lose.
   if(host==='quick.test'){ await new Promise(r=>setTimeout(r,2400));
     return route.fulfill({status:200,contentType:'application/xml',body:body(id)}); }
   // Both of these work perfectly well; they are simply slower than quick.test.
   await new Promise(r=>setTimeout(r,4000));
   return route.fulfill({status:200,contentType:'application/xml',body:body(id)});});
  await p3.addInitScript(x=>localStorage.setItem('breaking.v1',x),
    JSON.stringify({migrated:13,idleResetMin:0,feeds:FEEDS3,
      proxies:['https://quick.test/p?url=','https://slower.test/p?url=','https://slowest.test/p?url=']}));
  await p3.goto('http://localhost:8090/index.html');
  await p3.waitForTimeout(14000);
  const rel=await p3.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.relays')||'{}'));
  const bench=Object.entries(rel).filter(([,st])=>st.until>Date.now()).map(([h])=>h);
  console.log('relay records        :', Object.entries(rel).map(([h,st])=>`${h} ${st.ok}ok/${st.fail}bad ~${st.ms}ms`).join(' · '));
  console.log('benched              :', JSON.stringify(bench), bench.length?'*** A RELAY WAS BENCHED FOR LOSING A RACE ***':'(none — losing is not failing)');
  const losers=Object.entries(rel).filter(([h])=>h!=='quick.test');
  console.log('losers marked failed :', losers.map(([,st])=>st.fail).join(','), losers.every(([,st])=>st.fail===0)?'(no)':'*** counted as failures ***');
  console.log('losers sort slower   :', losers.every(([,st])=>st.ms>1000)?'yes (that is all a lost race says)':'*** latency not recorded ***');
  await ctx3.close();
}

// A dead moment on the phone benched every relay for ten minutes, starting
// exactly when the signal came back.
console.log('\n=== a total blackout is the connection, not the relays ===');
{
  const ctx4=await b.newContext({...devices['iPhone 14 Pro']});const p4=await ctx4.newPage();
  let offline=true;
  const FEEDS4=Array.from({length:4},(_,i)=>({id:'k'+i,cat:'World',name:'feed'+i,url:'https://pub'+i+'.test/rss'}));
  await ctx4.route('**/*',async route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8090'))return route.continue();
   if(offline) return route.abort('failed');                 // nothing at all is reachable
   const id=(decodeURIComponent(u).match(/\/\/(pub\d+)\.test/)||[])[1]||'x';
   if(/^pub\d/.test(new URL(u).host)) return route.abort('failed');
   return route.fulfill({status:200,contentType:'application/xml',body:body(id)});});
  await p4.addInitScript(x=>localStorage.setItem('breaking.v1',x),
    JSON.stringify({migrated:13,idleResetMin:0,feeds:FEEDS4,
      proxies:['https://a.test/p?url=','https://b.test/p?url=']}));
  await p4.goto('http://localhost:8090/index.html');
  await p4.waitForTimeout(6000);
  let rel=await p4.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.relays')||'{}'));
  const still=Object.entries(rel).filter(([,st])=>st.until>Date.now()).map(([h])=>h);
  console.log('after the blackout   : benched', JSON.stringify(still),
    still.length?'*** STILL SITTING OUT WHEN THE SIGNAL RETURNS ***':'(all back in play)');
  offline=false;
  await p4.click('#refresh'); await p4.waitForTimeout(4000);
  const h=await p4.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.health')));
  const good=Object.values(h).filter(x=>x.ok).length;
  console.log('once it is back      :', good+'/4 feeds', good===4?'(straight back to work)':'*** STILL FAILING ***');
  console.log('status               :', await p4.evaluate(()=>document.querySelector('#status').textContent));
  await ctx4.close();
}
srv.close();await b.close();
