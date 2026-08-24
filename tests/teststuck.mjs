// A gesture interrupted every way it can be still puts the panels back
//
// Run with:  node tests/teststuck.mjs
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
await new Promise(r=>srv.listen(8073,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8073'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 await new Promise(r=>setTimeout(r,300));
 const items=Array.from({length:10},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://t.test/f'}]})));
await page.goto('http://localhost:8073/index.html');await page.waitForTimeout(2500);

const startDrag = px => page.evaluate(async d=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  window.__x0=r.left+r.width/2; window.__y0=r.top+200; window.__el=el;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:window.__y0,pageX:x,pageY:window.__y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  window.__mk=mk;
  mk('touchstart',window.__x0);
  for(let i=1;i<=8;i++){await new Promise(r=>setTimeout(r,15)); mk('touchmove',window.__x0+d*i/8);}
}, px);
const rest = async () => page.evaluate(()=>[...document.querySelectorAll('.panel')]
  .map(p=>Math.round(new DOMMatrix(getComputedStyle(p).transform).m41)).sort((a,b)=>a-b).join(','));
const tab = () => page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent);
const W = await page.evaluate(()=>document.querySelector('#list').clientWidth);
console.log('at rest, panels should sit at -'+W+',0,'+W+'\n');

console.log('1. second finger lands mid-drag, then both lift');
await startDrag(-90);
await page.evaluate(()=>{const el=window.__el, y=window.__y0;
  const t1=new Touch({identifier:1,target:el,clientX:window.__x0-90,clientY:y});
  const t2=new Touch({identifier:2,target:el,clientX:window.__x0-40,clientY:y+30});
  el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t1,t2],targetTouches:[t1,t2],changedTouches:[t2]}));
  el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t1,t2],targetTouches:[t1,t2],changedTouches:[t1,t2]}));});
await page.waitForTimeout(700);
console.log('   panels:', await rest(), '| tab', await tab());

console.log('\n2. a refresh starts mid-drag (pane goes untouchable)');
await startDrag(-90);
await page.evaluate(()=>refresh());
await page.waitForTimeout(900);
console.log('   panels:', await rest(), '| tab', await tab(), '| busy', await page.evaluate(()=>document.body.classList.contains('busy')));
await page.waitForTimeout(1200);
console.log('   after the refresh finishes:', await rest());

console.log('\n3. app backgrounded mid-drag');
await startDrag(-90);
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));});
await page.waitForTimeout(700);
console.log('   panels:', await rest(), '| tab', await tab());

console.log('\n4. touchcancel (a system gesture takes over)');
await startDrag(-90);
await page.evaluate(()=>{const el=window.__el;
  const tc=new Touch({identifier:1,target:el,clientX:0,clientY:0});
  el.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[tc]}));});
await page.waitForTimeout(700);
console.log('   panels:', await rest(), '| tab', await tab());

console.log('\n5. a normal swipe still works afterwards');
await startDrag(-160);
await page.evaluate(()=>window.__mk('touchend',window.__x0-160));
await page.waitForTimeout(900);
console.log('   panels:', await rest(), '| tab', await tab());
console.log('\n6. events simply stop arriving (nothing ends the gesture)');
await startDrag(-90);
console.log('   right after the drag :', await rest());
await page.waitForTimeout(4200);
console.log('   4s later             :', await rest(), '| tab', await tab());

console.log('\n7. and a swipe still works after that');
await startDrag(-160);
await page.evaluate(()=>window.__mk('touchend',window.__x0-160));
await page.waitForTimeout(900);
console.log('   panels:', await rest(), '| tab', await tab());

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
