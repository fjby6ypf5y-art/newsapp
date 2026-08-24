// Frame times across a committed swipe - nothing over one frame
//
// Run with:  node tests/testcost2.mjs
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
await new Promise(r=>srv.listen(8071,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8071'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:190},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*7*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'}]})));
await page.goto('http://localhost:8071/index.html');await page.waitForTimeout(3200);
// measure frame lengths across a real committed swipe
const r = await page.evaluate(async()=>{
  const el=document.querySelector('#list'),rc=el.getBoundingClientRect();
  const x0=rc.left+rc.width/2,y0=rc.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  const frames=[]; let last=performance.now(), stop=false;
  const tick=()=>{const n=performance.now(); frames.push(+(n-last).toFixed(1)); last=n;
    if(!stop) requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  mk('touchstart',x0);
  for(let i=1;i<=10;i++){await new Promise(r=>setTimeout(r,16)); mk('touchmove',x0-200*i/10);}
  mk('touchend',x0-200);
  await new Promise(r=>setTimeout(r,700)); stop=true;
  return frames;});
const worst=[...r].sort((a,b)=>b-a).slice(0,5);
console.log('frame gaps during and after the swipe (ms):');
console.log('  '+r.join(' '));
console.log('\nlongest frames:', worst.join(', '));
console.log('frames over 24ms:', r.filter(x=>x>24).length);
await b.close();srv.close();
