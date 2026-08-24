// The page turn animates, including under prefers-reduced-motion
//
// Run with:  node tests/testslide.mjs
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
await new Promise(r=>srv.listen(8066,r));
const b=await chromium.launch(CHROME);
for (const rm of ['no-preference','reduce']) {
  const ctx=await b.newContext({...devices['iPhone 14 Pro'], reducedMotion: rm==='reduce'?'reduce':'no-preference'});
  const page=await ctx.newPage();
  await ctx.route('**/*',route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8066'))return route.continue();
   if(!u.includes('allorigins'))return route.abort('failed');
   const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
   const items=Array.from({length:12},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
   return route.fulfill({status:200,contentType:'application/xml',
    body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
  await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
   proxies:['https://api.allorigins.win/raw?url='],feeds:[
   {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
   {id:'2',cat:'Business',name:'B',url:'https://b.test/f'}]})));
  await page.goto('http://localhost:8066/index.html');await page.waitForTimeout(2500);
  console.log('\n=== prefers-reduced-motion: '+rm+' ===');
  // sample every animation frame from release until it settles
  const frames = await page.evaluate(async()=>{
    const el=document.querySelector('#list'),r=el.getBoundingClientRect();
    const x0=r.left+r.width/2,y0=r.top+200;
    const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
      el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
        touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
    mk('touchstart',x0);
    for(let i=1;i<=12;i++){await new Promise(r=>setTimeout(r,16)); mk('touchmove',x0-200*i/12);}
    const out=[]; const t0=performance.now();
    mk('touchend',x0-200);
    const xs = () => [...document.querySelectorAll('.panel')]
      .map(p=>Math.round(new DOMMatrix(getComputedStyle(p).transform).m41)).sort((a,b)=>a-b);
    await new Promise(done=>{
      const tick=()=>{const v=xs();
        // the outgoing panel and the one coming in, wherever they are now
        out.push([Math.round(performance.now()-t0), v[0], v.find(x=>x>-300&&x<300)]);
        if(performance.now()-t0<420) requestAnimationFrame(tick); else done();};
      requestAnimationFrame(tick);});
    return out;});
  const shown = frames.filter((f,i)=>i%3===0);
  for (const [t,l,g] of shown) console.log('  t='+String(t).padStart(3)+'ms  outgoing '+String(l).padStart(5)+'   incoming '+(g===undefined?'  (home)':String(g).padStart(5)));
  const moving = frames.filter(f=>f[2]!==undefined && f[2]>4 && f[2]<389).length;
  console.log('  frames with the incoming panel part-way across:', moving, moving>3?'(animated)':'*** JUMPS ***');
  await page.close(); await ctx.close();
}
await b.close();srv.close();
