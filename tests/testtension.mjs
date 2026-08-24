// How far a drag has to travel before the page turns, and what springs back
//
// Run with:  node tests/testtension.mjs
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
await new Promise(r=>srv.listen(8063,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8063'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:8},(_,i)=>`<item><title>${id} item ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'T',url:'https://t.test/f'}]})));
await page.goto('http://localhost:8063/index.html');await page.waitForTimeout(3000);
const W = await page.evaluate(()=>document.querySelector('#list').clientWidth);
console.log('screen width:',W,' half =',W/2);

const hold = dx => page.evaluate(async d=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+140;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=14;i++){await new Promise(r=>setTimeout(r,14)); mk('touchmove',x0+d*i/14);}
  const m=new DOMMatrix(getComputedStyle(el).transform);
  return m.m41;
}, dx);
const rel = () => page.evaluate(()=>{const el=document.querySelector('#list');
  const tc=new Touch({identifier:1,target:el,clientX:0,clientY:0});
  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[tc]}));});
const tab=()=>page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent);

console.log('\nfinger travel -> panel travel (and whether it commits on release)');
for (const d of [20,40,60,80,110,130,150,200]) {
  const before = await tab();
  const painted = await hold(-d); await rel(); await page.waitForTimeout(500);
  const after = await tab();
  console.log('  '+String(d).padStart(4)+'px  ->  panel '+Math.round(-painted).toString().padStart(4)
    +'px  ('+(Math.abs(painted)/W*100).toFixed(0)+'% across)   '
    +(after!==before?'COMMITS  '+before+' -> '+after:'springs back'));
}
console.log('\nfast throw (110px in ~90ms):');
let before=await tab();
await page.evaluate(async()=>{const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+140;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=6;i++){await new Promise(r=>setTimeout(r,15)); mk('touchmove',x0-160*i/6);}
  mk('touchend',x0-160);});
await page.waitForTimeout(600);
console.log('  ->',await tab(), (await tab())!==before?'(committed)':'(springs back)');
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
