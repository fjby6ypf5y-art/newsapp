// A feed big enough to fill the storage quota does not wedge the app, and a
// config that cannot be read is not thrown away
//
// Run with:  node tests/testquota.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8092,r));
const mark=(ok,msg)=>console.log((ok?'  ok  ':'*** ')+msg);

// 400 stories with a 30KB title each: about 12MB of JSON against a 5MB quota.
const big='A'.repeat(30000);
const HOSTILE='<?xml version="1.0"?><rss version="2.0"><channel><title>huge</title>'
 +Array.from({length:400},(_,n)=>`<item><title>${big} ${n}</title><link>https://huge.test/${n}</link>`
   +`<pubDate>${new Date().toUTCString()}</pubDate></item>`).join('')+'</channel></rss>';

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8092'))return route.continue();
 if(!decodeURIComponent(u).includes('huge.test'))return route.abort('failed');
 return route.fulfill({status:200,contentType:'application/xml',body:HOSTILE});});
const errs=[];page.on('pageerror',e=>errs.push(e.message.slice(0,120)));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{id:'1',cat:'World',name:'Huge',url:'https://huge.test/rss'}]})));
await page.goto('http://localhost:8092/index.html');await page.waitForTimeout(7000);

console.log('status      :',await page.evaluate(()=>document.querySelector('#status').textContent));
console.log('rows on scr :',await page.evaluate(()=>document.querySelectorAll('.item').length));
console.log('title length:',await page.evaluate(()=>{const t=document.querySelector('.ttl');return t?t.textContent.length:0}));
console.log('items stored:',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')||'[]').length));
mark(await page.evaluate(()=>{const t=document.querySelector('.ttl');return !!t&&t.textContent.length<=300}),
     'a title off a feed is capped like everything else');
mark(!await page.evaluate(()=>document.body.classList.contains('busy')),'the screen is not left dimmed');
mark(/Updated|No feeds/.test(await page.evaluate(()=>document.querySelector('#status').textContent)),
     'the refresh reported a result rather than stopping mid-way');

// The real damage was the next refresh, which used to queue behind a flag that
// never came down.
await page.click('#refresh');await page.waitForTimeout(6000);
mark(!await page.evaluate(()=>document.body.classList.contains('busy')),'a second refresh still finishes');
console.log('after 2nd   :',await page.evaluate(()=>document.querySelector('#status').textContent));
console.log('errors      :',errs.length?errs:'none');
mark(errs.length===0,'no exception escaped the refresh');

// ---- the same again, but the bulk is in the links, which cannot be capped
// without corrupting them. The cache gets trimmed instead of the write failing.
const longlink='https://long.test/'+'b'.repeat(30000);
const LONG='<?xml version="1.0"?><rss version="2.0"><channel><title>long</title>'
 +Array.from({length:400},(_,n)=>`<item><title>story ${n}</title><link>${longlink}${n}</link>`
   +`<pubDate>${new Date().toUTCString()}</pubDate></item>`).join('')+'</channel></rss>';
const ctx3=await b.newContext({...devices['iPhone 14 Pro']});const p3=await ctx3.newPage();
await ctx3.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8092'))return route.continue();
 if(!decodeURIComponent(u).includes('long.test'))return route.abort('failed');
 return route.fulfill({status:200,contentType:'application/xml',body:LONG});});
const errs3=[];p3.on('pageerror',e=>errs3.push(e.message.slice(0,120)));
await p3.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{id:'1',cat:'World',name:'Long',url:'https://long.test/rss'}]})));
await p3.goto('http://localhost:8092/index.html');await p3.waitForTimeout(7000);
console.log('long: status:',await p3.evaluate(()=>document.querySelector('#status').textContent));
console.log('long: stored:',await p3.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')||'[]').length),'of 400');
mark(!await p3.evaluate(()=>document.body.classList.contains('busy')),'an oversized cache trims instead of wedging');
mark(errs3.length===0,'no exception escaped that one either');
console.log('long: errors:',errs3.length?errs3:'none');

// ---- an unreadable config is kept, not silently discarded
const ctx2=await b.newContext({...devices['iPhone 14 Pro']});const p2=await ctx2.newPage();
await ctx2.route('**/*',route=>route.request().url().startsWith('http://localhost:8092')
 ?route.continue():route.abort('failed'));
await p2.addInitScript(()=>localStorage.setItem('breaking.v1','{"feeds":42,'));
await p2.goto('http://localhost:8092/index.html');await p2.waitForTimeout(1500);
const warn=await p2.evaluate(()=>{const r=document.querySelector('.restore');return r?r.innerText:''});
console.log('warning bar :',JSON.stringify(warn.split('\n')[0]));
mark(/could not be read/.test(warn),'the app says the config could not be read');
mark(await p2.evaluate(()=>localStorage.getItem('breaking.v1.broken')==='{"feeds":42,'),
     'the unreadable copy is kept rather than overwritten');
await b.close();srv.close();
