// Switching a feed on: is only that feed fetched, and does the page hold still?
//
// Two things this answers. One, adding a feed from the library must check that
// feed and nothing else - "Test all feeds" is the only thing that fetches the
// lot, and a feed checked on the way in must not be fetched again when the
// sheet closes. Two, the list above the library grows a row when a feed goes
// on, and the chip you tapped must not move when it does.
//
// Run with:  node tests/testadd.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8077,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let fetched=[];
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8077'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const host=(decodeURIComponent(u).match(/url=https:\/\/([^/]+)/)||[])[1]||'f';
 fetched.push(host);
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${host}</title>`
   +`<item><title>${host} story</title><link>https://x/${host}</link></item></channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://aaa.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://bbb.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://ccc.test/f'}]})));
await page.goto('http://localhost:8077/index.html');await page.waitForTimeout(2500);
await page.click('#open-feeds'); await page.waitForTimeout(400);

const chips = () => page.evaluate(()=>[...document.querySelectorAll('#library .lib button')]
  .map(x=>({n:x.textContent.trim(),on:x.dataset.on,
            w:+x.getBoundingClientRect().width.toFixed(1),y:+x.getBoundingClientRect().top.toFixed(1)})));
const tap = n => page.evaluate(n=>[...document.querySelectorAll('#library .lib button')]
  .find(x=>x.textContent.trim()===n).click(), n);
const rows = () => page.evaluate(()=>document.querySelectorAll('#feeds .row').length);
const bad  = (t,c) => console.log((c?'   ':'*** ')+t);

console.log('1. switch one feed on');
const before = await chips();
const pick = before.find(c=>c.on==='0').n;
fetched=[]; const rows0 = await rows();
await tap(pick); await page.waitForTimeout(1200);
const after = await chips();
console.log('   tapped     :', pick);
console.log('   fetched    :', fetched.join(', ')||'(none)');
bad('one feed fetched, not the list: '+fetched.length+' fetch(es)', fetched.length===1);
bad('a row appeared: '+rows0+' → '+await rows(), await rows() === rows0+1);
const moved = before.map((c,i)=>Math.abs(after[i].y-c.y)).sort((a,b)=>b-a)[0];
const widened = before.filter((c,i)=>after[i].w!==c.w).length;
console.log('   chips moved on screen, worst:', moved.toFixed(1)+'px');
bad('the chip row held still', moved <= 2);
bad('no chip changed width when ticked: '+widened, widened===0);
bad('the dot next to it is filled in', await page.evaluate(()=>
  [...document.querySelectorAll('#feeds .hd')].some(d=>d.classList.contains('ok')||d.classList.contains('bad'))));

console.log('\n2. closing the sheet does not read it again');
fetched=[];
await page.click('#close-feeds'); await page.waitForTimeout(1200);
console.log('   fetched    :', fetched.join(', ')||'(none)');
bad('nothing refetched on close', fetched.length===0);

console.log('\n3. switching it off fetches nothing, and holds still');
await page.click('#open-feeds'); await page.waitForTimeout(400);
fetched=[];
const b3 = await chips();
await tap(pick); await page.waitForTimeout(900);
const a3 = await chips();
const moved3 = b3.map((c,i)=>Math.abs(a3[i].y-c.y)).sort((a,b)=>b-a)[0];
console.log('   fetched    :', fetched.join(', ')||'(none)', '| worst chip move:', moved3.toFixed(1)+'px');
bad('removing fetches nothing', fetched.length===0);
bad('the chip row held still', moved3 <= 2);

console.log('\n4. Add all fetches the ones it added, and only those');
fetched=[];
const cat = await page.evaluate(()=>{const h=[...document.querySelectorAll('#library [data-cat]')]
  .find(x=>x.querySelector('button').textContent==='Add all'); return h && h.dataset.cat;});
const grew = await page.evaluate(c=>{
  const h=document.querySelector(`#library [data-cat="${c}"]`);
  const n=h.nextElementSibling.querySelectorAll('button[data-on="0"]:not([data-pay="1"])').length;
  h.querySelector('button').click(); return n;}, cat);
await page.waitForTimeout(2000);
console.log('   category   :', cat, '| free feeds added:', grew, '| fetched:', fetched.length);
bad('fetched exactly what it added', fetched.length===grew);
fetched=[];
await page.click('#close-feeds'); await page.waitForTimeout(1200);
bad('nothing refetched on close: '+fetched.length, fetched.length===0);

console.log('\n5. Test all feeds still tests all of them');
await page.click('#open-feeds'); await page.waitForTimeout(300);
fetched=[];
await page.click('#f-test'); await page.waitForTimeout(2500);
const all = await page.evaluate(()=>cfg.feeds.length);
console.log('   feeds      :', all, '| fetched:', fetched.length);
bad('every feed fetched', fetched.length===all);

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
