// The chip row only moves when the category is off screen
//
// Run with:  node tests/testchips.mjs
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
await new Promise(r=>srv.listen(8078,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8078'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:6},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const cats=['World','Business','Tech','Canada','Science','Health','Entertainment'];
await page.addInitScript(cs=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:cs.map((c,i)=>({id:String(i+1),cat:c,name:c.toLowerCase().slice(0,4)+i,url:'https://f'+i+'.test/f'}))})), cats);
await page.goto('http://localhost:8078/index.html');await page.waitForTimeout(2500);
const row=()=>page.evaluate(()=>{const r=document.querySelector('#chips');
  const vis=[...r.querySelectorAll('.chip')].filter(c=>{const b=c.getBoundingClientRect(),p=r.getBoundingClientRect();
    return b.left>=p.left-1 && b.right<=p.right+1;}).map(c=>c.textContent);
  return {scrollLeft:Math.round(r.scrollLeft), showing:vis.join(','),
          on:document.querySelector('.chip[aria-pressed="true"]').textContent};});
const swipe = dx => page.evaluate(async d=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=10;i++){await new Promise(r=>setTimeout(r,15)); mk('touchmove',x0+d*i/10);}
  mk('touchend',x0+d);}, dx);
console.log('start          ', await row());
for (let i=0;i<6;i++){ await swipe(-200); await page.waitForTimeout(800);
  console.log('swipe forward  ', await row()); }
console.log();
for (let i=0;i<4;i++){ await swipe(200); await page.waitForTimeout(800);
  console.log('swipe back     ', await row()); }
console.log('\n--- a refresh must not move the row ---');
await page.evaluate(()=>document.querySelector('#chips').scrollLeft=120);
const before=await row();
await page.evaluate(()=>refresh());
await page.waitForTimeout(1200);
const after=await row();
console.log('before refresh :', before.scrollLeft, '| after:', after.scrollLeft, before.scrollLeft===after.scrollLeft?'(unmoved)':'*** MOVED ***');
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
