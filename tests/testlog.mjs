// The fetch log: does a failure get written down with enough detail to act on,
// does a recovery show up, and does a hostile error string stay text?
//
// Run with:  node tests/testlog.mjs
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
await new Promise(r=>srv.listen(8091,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();

// good.test answers; sick.test hands back an HTML error page under a 200,
// which is the failure that used to read as a bare "bad XML".
let sickMode='html';
await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8091'))return route.continue();
 const host=new URL(u).host;
 const d=decodeURIComponent(u);
 if(host!=='relay.test') return route.abort('failed');            // no CORS direct
 if(d.includes('sick.test')){
   if(sickMode==='html') return route.fulfill({status:200,contentType:'text/html',
     body:'<!doctype html><html><body><h1>502 Bad Gateway</h1><script>alert("xss")<\/script> nginx</body></html>'});
   if(sickMode==='429') return route.fulfill({status:429,contentType:'text/plain',body:'slow down'});
   return route.fulfill({status:200,contentType:'application/xml',
     body:`<?xml version="1.0"?><rss version="2.0"><channel><title>sick</title><item><title>back from the dead</title><link>https://x/1</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});
 }
 return route.fulfill({status:200,contentType:'application/xml',
   body:`<?xml version="1.0"?><rss version="2.0"><channel><title>good</title><item><title>fine story</title><link>https://x/2</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});

const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(x=>localStorage.setItem('breaking.v1',x),JSON.stringify({migrated:13,idleResetMin:0,
 proxies:['https://relay.test/p?url='],feeds:[
 {id:'1',cat:'World',name:'Good Feed',url:'https://good.test/rss'},
 {id:'2',cat:'World',name:'Sick Feed',url:'https://sick.test/rss'}]}));
await page.goto('http://localhost:8091/index.html');
await page.waitForTimeout(4000);

const readLog=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.log')||'[]'));
let l=await readLog();
console.log('=== a feed that answers with an error page ===');
console.log('entries            :', l.length);
const fail=l.find(e=>e.k==='fail');
console.log('kind / feed        :', fail&&fail.k, '/', fail&&fail.n);
console.log('why it was fetched :', JSON.stringify(fail&&fail.w));
console.log('attempts recorded  :', JSON.stringify((fail&&fail.a||[]).map(a=>a.h+': '+a.e)));
console.log('stated reason      :', JSON.stringify(fail&&fail.r));
console.log('response began     :', JSON.stringify(fail&&fail.b));
if(fail&&!fail.r) console.log('*** a feed that answered with junk gives no reason, only "ok" route lines');
if(!fail) console.log('*** the failure was not logged');
else {
  if(!fail.b||!fail.b.includes('502')) console.log('*** the response body was not captured, so "bad XML" is all you get');
  if(!(fail.a||[]).length) console.log('*** no per-relay detail was recorded');
  if(!fail.w) console.log('*** the log does not say what asked for the fetch');
}
if(l.some(e=>e.n==='Good Feed'&&e.k==='fail')) console.log('*** a working feed was logged as failing');

console.log('\n=== the log sheet ===');
await page.click('#open-settings'); await page.waitForTimeout(300);
console.log('count in Settings  :', await page.evaluate(()=>document.querySelector('#log-count').textContent));
await page.click('#open-log'); await page.waitForTimeout(300);
const shown=await page.evaluate(()=>[...document.querySelectorAll('#log-list .log-entry')].map(d=>d.textContent));
console.log('entries on screen  :', shown.length);
console.log('first entry        :', JSON.stringify((shown[0]||'').slice(0,150)));
if(!shown.length) console.log('*** the log sheet is empty');
// The whole page exists to show hostile strings. None of it may become markup.
const injected=await page.evaluate(()=>document.querySelectorAll('#log-list script, #log-list h1').length);
console.log('markup from the feed:', injected, injected===0?'(inert text)':'*** THE LOG RENDERED REMOTE MARKUP ***');
console.log('settings closed     :', await page.evaluate(()=>document.querySelector('#settings').getAttribute('aria-hidden')));

console.log('\n=== the feed comes back ===');
await page.click('#close-log'); await page.waitForTimeout(200);
sickMode='ok';
await page.click('#refresh'); await page.waitForTimeout(4000);
l=await readLog();
const rec=l.find(e=>e.k==='ok');
console.log('recovery logged    :', rec?('yes — '+rec.n):'*** NO RECOVERY ENTRY');
console.log('total entries      :', l.length);

console.log('\n=== it stays bounded ===');
sickMode='429';
for(let i=0;i<8;i++){ await page.click('#refresh'); await page.waitForTimeout(900); }
l=await readLog();
console.log('entries after 8 more refreshes:', l.length, l.length<=60?'(capped at 60)':'*** UNBOUNDED ***');
const bytes=await page.evaluate(()=>(localStorage.getItem('breaking.v1.log')||'').length);
console.log('log size in storage :', bytes, 'characters', bytes<60000?'(small)':'*** LARGE ***');
const http429=l.find(e=>e.a&&e.a.some(a=>/429/.test(a.e)));
console.log('HTTP 429 recorded   :', http429?'yes':'*** the status code was lost');

console.log('\n=== clearing ===');
await page.click('#open-settings'); await page.waitForTimeout(200);
await page.click('#open-log'); await page.waitForTimeout(200);
await page.click('#log-clear'); await page.waitForTimeout(300);
console.log('after Clear        :', (await readLog()).length, 'entries ·',
  await page.evaluate(()=>document.querySelector('#log-msg').textContent));

// The report that started this: clear the log, run Test all feeds, watch a
// feed fail, and find the log still empty - because only refresh() logged.
console.log('\n=== Test all feeds writes to the log too ===');
sickMode='429';
await page.click('#close-log'); await page.waitForTimeout(200);
await page.click('#open-feeds'); await page.waitForTimeout(300);
await page.click('#f-test'); await page.waitForTimeout(4000);
console.log('button says        :', await page.evaluate(()=>document.querySelector('#f-test').textContent));
let after=await readLog();
console.log('entries after test :', after.length, after.length?'':'*** A TEST RUN THAT FAILED LOGGED NOTHING ***');
const t=after.find(e=>e.k==='fail');
console.log('  what             :', t&&t.n, '·', JSON.stringify(t&&t.w), '·', JSON.stringify((t&&t.a||[]).map(a=>a.h+': '+a.e)));
if(t&&t.w!=='test all feeds') console.log('*** the entry does not say the test asked for it');
if(after.some(e=>e.n==='Good Feed'&&e.k==='fail')) console.log('*** a working feed was logged as failing');

// Watching the log while something fails should show it arrive.
console.log('\n=== the sheet updates while it is open ===');
await page.click('#close-feeds'); await page.waitForTimeout(200);
await page.click('#open-settings'); await page.waitForTimeout(200);
await page.click('#open-log'); await page.waitForTimeout(200);
await page.click('#log-clear'); await page.waitForTimeout(200);
const before0=await page.evaluate(()=>document.querySelectorAll('#log-list .log-entry').length);
await page.evaluate(()=>refresh(undefined,{quiet:true,why:'a background pass'}));
await page.waitForTimeout(3500);
const after0=await page.evaluate(()=>document.querySelectorAll('#log-list .log-entry').length);
console.log('rows on screen     :', before0, '->', after0, after0>before0?'(arrived without reopening)':'*** THE OPEN SHEET DID NOT UPDATE ***');
console.log('  sheet still open :', await page.evaluate(()=>document.querySelector('#log-sheet').classList.contains('open')));

console.log('\n'+(errs.length?'*** ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
