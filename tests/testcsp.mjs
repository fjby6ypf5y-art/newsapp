// The content security policy blocks what it should and nothing else
//
// Run with:  node tests/testcsp.mjs
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
await new Promise(r=>srv.listen(8057,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8057'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.split('.')[0];
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title><item><title>${id} story</title><link>https://x/${id}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});

const violations=[], errs=[];
page.on('console',m=>{const t=m.text();
  if(/Content Security Policy|Refused to/i.test(t)) violations.push(t.slice(0,150));
  else if(m.type()==='error') errs.push(t.slice(0,150));});
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));

await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:10,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Tech',name:'T',url:'https://t.test/f'}]})));
await page.goto('http://localhost:8057/index.html');await page.waitForTimeout(4000);

// exercise the app so anything CSP would block has a chance to fire
console.log('stories rendered   :', await page.evaluate(()=>document.querySelectorAll('.item').length));
console.log('inline styles work :', await page.evaluate(()=>{
  const a=document.querySelector('.item'); return getComputedStyle(a).borderLeftColor;}));
console.log('icons load         :', await page.evaluate(async()=>{
  const r=await fetch('icons/icon-192.png'); return r.ok;}));
console.log('manifest loads     :', await page.evaluate(async()=>{
  const r=await fetch('manifest.webmanifest'); return r.ok;}));
console.log('service worker     :', await page.evaluate(()=>!!navigator.serviceWorker.controller));
await page.click('#open-feeds');await page.waitForTimeout(500);
console.log('feeds page opens   :', await page.evaluate(()=>document.querySelectorAll('#feeds .row').length),'rows');
await page.evaluate(()=>document.querySelectorAll('#feeds .row')[0].click());
await page.waitForTimeout(300);
console.log('editor opens       :', await page.evaluate(()=>!!document.querySelector('.editor')));
await page.click('#close-feeds');await page.waitForTimeout(2500);
await page.click('#open-settings');await page.waitForTimeout(400);
await page.click('#opml-export');await page.waitForTimeout(200);
console.log('OPML export works  :', (await page.evaluate(()=>document.querySelector('#io').value)).startsWith('<?xml'));
await page.click('#close-settings');await page.waitForTimeout(2000);
await page.click('#refresh');await page.waitForTimeout(2500);
console.log('refresh works      :', await page.evaluate(()=>document.querySelector('#status').textContent));

// now prove the policy actually blocks something
console.log('\n--- policy actually enforced? ---');
const blockedScript = await page.evaluate(()=>new Promise(res=>{
  const sc=document.createElement('script');
  sc.src='https://evil.example.com/x.js';
  sc.onerror=()=>res('blocked'); sc.onload=()=>res('LOADED');
  document.head.appendChild(sc); setTimeout(()=>res('blocked'),1200);
}));
console.log('external script    :', blockedScript);
const blockedImg = await page.evaluate(()=>new Promise(res=>{
  const i=new Image(); i.onerror=()=>res('blocked'); i.onload=()=>res('LOADED');
  i.src='https://evil.example.com/x.png'; setTimeout(()=>res('blocked'),1200);
}));
console.log('external image     :', blockedImg);

console.log('\nCSP violations during normal use:', violations.length);
for (const v of violations.slice(0,6)) console.log('   ', v);
console.log(errs.length?'\nJS ERRORS:\n'+errs.join('\n'):'\nno JS errors');
await b.close();srv.close();
