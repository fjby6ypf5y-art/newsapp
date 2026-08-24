// Swipe between categories: wrap-around, gestures that must not switch, pull still works
//
// Run with:  node tests/testswipe.mjs
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
await new Promise(r=>srv.listen(8058,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let fetches=0;
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8058'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 fetches++;
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.split('.')[0];
 const items=Array.from({length:20},(_,i)=>`<item><title>${id} item ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*30*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:10,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'T',url:'https://t.test/f'},
 {id:'4',cat:'Canada',name:'C',url:'https://c.test/f'}]})));
await page.goto('http://localhost:8058/index.html');await page.waitForTimeout(4000);

// synthetic drag over the list
const drag = async ([dxTotal, dyTotal, steps]) => page.evaluate(([dxT,dyT,n])=>{
  const el=document.querySelector('#list'), r=el.getBoundingClientRect();
  const x0=r.left+r.width/2, y0=r.top+120;
  const mk=(type,x,y)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:y,pageX:x,pageY:y});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));};
  mk('touchstart',x0,y0);
  for(let i=1;i<=n;i++) mk('touchmove',x0+dxT*i/n,y0+dyT*i/n);
  mk('touchend',x0+dxT,y0+dyT);
}, [dxTotal,dyTotal,steps]);

const tab = () => page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent);
const chips = await page.evaluate(()=>[...document.querySelectorAll('.chip')].map(c=>c.textContent));
console.log('categories:', chips.join(' | '));
console.log('start on  :', await tab());

console.log('\n--- swipe left (forward) ---');
for (let i=0;i<4;i++){ await drag([-280,0,10]); await page.waitForTimeout(650);
  console.log('  ->', await tab()); }
console.log('  (last one should not move past the end)');

console.log('\n--- swipe right (back) ---');
for (let i=0;i<4;i++){ await drag([280,0,10]); await page.waitForTimeout(650);
  console.log('  ->', await tab()); }

console.log('\n--- gestures that must NOT change category ---');
let t0=await tab();
await drag([-40,0,6]); await page.waitForTimeout(650);
console.log('  short swipe        ->', await tab(), (await tab())===t0?'(unchanged)':'*** MOVED ***');
await drag([-30,140,10]); await page.waitForTimeout(650);
console.log('  mostly-vertical    ->', await tab(), (await tab())===t0?'(unchanged)':'*** MOVED ***');

console.log('\n--- pull to refresh still works ---');
fetches=0;
await drag([0,220,10]); await page.waitForTimeout(2500);
console.log('  vertical pull -> fetches:', fetches, fetches>0?'(refreshed)':'*** NO REFRESH ***');
console.log('  tab after pull        :', await tab(), (await tab())===t0?'(unchanged)':'*** MOVED ***');

console.log('\n--- scrolled down: sideways swipe still switches, pull does not fire ---');
await page.evaluate(()=>{document.querySelector('#list').scrollTop=600});
await page.waitForTimeout(200); fetches=0;
await drag([-280,0,10]); await page.waitForTimeout(650);
console.log('  swipe while scrolled ->', await tab());
console.log('  list back at top     :', await page.evaluate(()=>document.querySelector('#list').scrollTop===0));
console.log('  transform cleared    :', await page.evaluate(()=>getComputedStyle(document.querySelector('#list')).transform));
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
