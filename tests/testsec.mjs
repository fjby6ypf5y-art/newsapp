// A hostile feed cannot get a script, a javascript: link or markup through
//
// Run with:  node tests/testsec.mjs
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
const HOSTILE=`<?xml version="1.0"?><rss version="2.0"><channel><title>evil</title>
<item><title>JS scheme</title><link>javascript:window.PWNED=1;void 0</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>Data scheme</title><link>data:text/html,&lt;script&gt;window.PWNED=2&lt;/script&gt;</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>Mixed case JS</title><link>JaVaScRiPt:window.PWNED=3</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>HTML in title &lt;img src=x onerror="window.PWNED=4"&gt;</title><link>https://ok.test/a</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>HTML in body</title><link>https://ok.test/b</link><pubDate>${new Date().toUTCString()}</pubDate>
<description>&lt;img src=x onerror="window.PWNED=5"&gt;</description></item>
<item><title>Legit link</title><link>https://good.example/story</link><pubDate>${new Date().toUTCString()}</pubDate></item>
</channel></rss>`;
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8090'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 if(!decodeURIComponent(u).includes('evil.test'))return route.abort('failed');
 return route.fulfill({status:200,contentType:'application/xml',body:HOSTILE});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:7,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{cat:'World',name:'Hostile',url:'https://evil.test/rss'}]})));
await page.goto('http://localhost:8090/index.html');await page.waitForTimeout(3500);

console.log('status  :',await page.evaluate(()=>document.querySelector('#status').textContent));
console.log('chips   :',await page.evaluate(()=>[...document.querySelectorAll('.chip')].map(c=>c.textContent)));
console.log('active  :',await page.evaluate(()=>{const c=document.querySelector('.chip[aria-pressed="true"]');return c&&c.textContent}));
console.log('cached  :',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')||'[]').map(i=>i.source+' | '+i.title.slice(0,30)+' | '+i.link)));
console.log('feeds   :',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds));
console.log('listtext:',(await page.evaluate(()=>document.querySelector('#list').innerText)).slice(0,180));
const rows=await page.evaluate(()=>[...document.querySelectorAll('.item')].map(a=>({
  title:a.querySelector('.ttl').textContent.slice(0,46), href:a.getAttribute('href'),
  inert:a.style.pointerEvents})));
console.table(rows);
// click every story, then check for execution
for(const a of await page.$$('.item')){ try{ await a.click({timeout:900}); }catch{} }
await page.waitForTimeout(700);
console.log('window.PWNED after clicking every story:',await page.evaluate(()=>window.PWNED));
console.log('stray <img> injected into the list      :',await page.evaluate(()=>document.querySelectorAll('#list img').length));
console.log('titles kept as literal text             :',await page.evaluate(()=>!!document.body.innerText.includes('<img src=x')));
console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
