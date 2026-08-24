// Coming back to a web app iOS has put away: a slow launch must not sit on a
// blank screen, and a backgrounded app must not hold rows nobody is reading.
//
// Run with:  node tests/testresume.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};

let stall = 0;                       // seconds the server sits on every request
const srv=http.createServer(async (q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
  if (stall) await new Promise(res=>setTimeout(res, stall*1000));
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain','Cache-Control':'max-age=600'});
  r.end(fs.readFileSync(f));
});
await new Promise(r=>srv.listen(8081,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8081'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/https?:\/\/([^./]+)/g)||[]).pop()||'f';
 const items=Array.from({length:60},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*11*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://aaa.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://bbb.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://ccc.test/f'}]})));

await page.goto('http://localhost:8081/index.html');
await page.waitForTimeout(2500);
console.log('first launch, worker active :', await page.evaluate(()=>!!navigator.serviceWorker.controller));

const rows = () => page.evaluate(()=>[...document.querySelectorAll('.panel')]
  .map(p=>p.childElementCount));
console.log('rows in the three panels    :', (await rows()).join(' / '));

const hide = () => page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));});
const show = () => page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));});

await hide(); await page.waitForTimeout(200);
console.log('backgrounded                :', (await rows()).join(' / '), '(the two parked ones let go)');
await show(); await page.waitForTimeout(900);
console.log('back in the foreground      :', (await rows()).join(' / '), '(rebuilt)');

console.log('\n--- relaunch while the network hangs (10s per request) ---');
stall = 10;
const t0 = Date.now();
await page.goto('http://localhost:8081/index.html', { waitUntil: 'commit' });
await page.waitForSelector('#list .item', { timeout: 9000 }).catch(()=>{});
const shown = Date.now() - t0;
const n = await page.evaluate(()=>document.querySelectorAll('#list .item').length);
console.log('  stories on screen after    :', n, 'in', shown + 'ms',
  n > 0 && shown < 6000 ? '(served from the cache, not a blank page)' : '*** BLANK OR TOO SLOW ***');
console.log('  build shown                :', await page.evaluate(()=>BUILD));
stall = 0;
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
