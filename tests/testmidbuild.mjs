// A swipe taken while a panel is still filling stays smooth
//
// Run with:  node tests/testmidbuild.mjs
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
await new Promise(r=>srv.listen(8075,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8075'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:190},(_,i)=>`<item><title>${id.toUpperCase()} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*7*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://t.test/f'}]})));
await page.goto('http://localhost:8075/index.html');
// swipe the instant the panels start building, worst case for a half-built panel
await page.waitForTimeout(2600);
const frames = await page.evaluate(async()=>{
  const el=document.querySelector('#list'),rc=el.getBoundingClientRect();
  const x0=rc.left+rc.width/2,y0=rc.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  const log=[]; let last=performance.now(), stop=false;
  const tick=()=>{const n=performance.now(); log.push(+(n-last).toFixed(1)); last=n;
    if(!stop) requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  mk('touchstart',x0);
  for(let i=1;i<=6;i++){await new Promise(r=>setTimeout(r,16)); mk('touchmove',x0-140*i/6);}
  mk('touchend',x0-140);
  await new Promise(r=>setTimeout(r,1400)); stop=true;
  return log;});
console.log('longest frame during a swipe taken mid-build:', Math.max(...frames).toFixed(1)+'ms');
console.log('frames over 24ms:', frames.filter(f=>f>24).length);
const st = await page.evaluate(()=>{
  const live=document.querySelector('#list');
  const src=p=>{const s=p.querySelector('.src'); return s?s.textContent:'(empty)';};
  return {tab:document.querySelector('.chip[aria-pressed="true"]').textContent,
    liveShows:src(live), liveRows:live.childElementCount,
    parked:[...document.querySelectorAll('.panel')].filter(p=>p!==live).map(p=>src(p)+':'+p.childElementCount)};});
console.log('after it settles:', st);
console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
