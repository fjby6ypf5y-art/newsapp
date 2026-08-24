// Panels rotate correctly across repeated swipes; chip taps and pull still target the live one
//
// Run with:  node tests/testrotate.mjs
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
await new Promise(r=>srv.listen(8072,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let hits=0;
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8072'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 hits++;
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:9},(_,i)=>`<item><title>${id.toUpperCase()} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*21*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://t.test/f'},
 {id:'4',cat:'Canada',name:'c',url:'https://c.test/f'}]})));
await page.goto('http://localhost:8072/index.html');await page.waitForTimeout(3500);
const drag = d => page.evaluate(async dx=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=12;i++){await new Promise(r=>setTimeout(r,15)); mk('touchmove',x0+dx*i/12);}
  mk('touchend',x0+dx);}, d);
const state = () => page.evaluate(()=>{
  const live=document.querySelector('#list');
  const panels=[...document.querySelectorAll('.panel')];
  const src=p=>{const s=p.querySelector('.src'); return s?s.textContent:'(empty)';};
  return {tab:document.querySelector('.chip[aria-pressed="true"]').textContent,
          shows:src(live), rows:live.querySelectorAll('.item').length,
          parked:panels.filter(p=>p!==live).map(p=>src(p)+'@'+Math.round(new DOMMatrix(getComputedStyle(p).transform).m41)),
          liveVisible:!live.hasAttribute('aria-hidden'),
          hidden:panels.filter(p=>p.getAttribute('aria-hidden')==='true').length,
          ids:panels.filter(p=>p.id).length};});
console.log('start          ', await state());
for (const step of [1,2,3]) { await drag(-260); await page.waitForTimeout(900);
  console.log('after swipe '+step+'  ', await state()); }
await drag(260); await page.waitForTimeout(900);
console.log('swipe back     ', await state());
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Canada').click());
await page.waitForTimeout(700);
console.log('after chip tap ', await state());
hits=0;
await page.evaluate(async()=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+120;
  const mk=(t,y)=>{const tc=new Touch({identifier:1,target:el,clientX:x0,clientY:y,pageX:x0,pageY:y});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',y0); for(let i=1;i<=10;i++){await new Promise(r=>setTimeout(r,15)); mk('touchmove',y0+220*i/10);} mk('touchend',y0+220);});
await page.waitForTimeout(1800);
console.log('pull refreshed ', hits, 'feed fetch(es) ·', await page.evaluate(()=>document.querySelector('#status').textContent));
console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
