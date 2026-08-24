// The abandoned page turn eases home, drifts past centre and settles
//
// Run with:  node tests/testspringback.mjs
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
await new Promise(r=>srv.listen(8068,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8068'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:12},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'}]})));
await page.goto('http://localhost:8068/index.html');await page.waitForTimeout(2500);
const frames = await page.evaluate(async()=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=10;i++){await new Promise(r=>setTimeout(r,16)); mk('touchmove',x0-110*i/10);}
  await new Promise(r=>setTimeout(r,60));
  const out=[]; const t0=performance.now();
  mk('touchend',x0-110);
  await new Promise(done=>{const tick=()=>{
    const g=document.querySelector('.ghost');
    out.push([Math.round(performance.now()-t0),
      +(new DOMMatrix(getComputedStyle(el).transform).m41).toFixed(1),
      g?Math.round(new DOMMatrix(getComputedStyle(g).transform).m41):null]);
    if(performance.now()-t0<620) requestAnimationFrame(tick); else done();};
    requestAnimationFrame(tick);});
  return out;});
console.log('spring back from a 110px drag (list x, incoming panel x):');
frames.filter((f,i)=>i%2===0).forEach(([t,l,g])=>{
  const bar = ' '.repeat(Math.max(0,Math.round(40+l/2))) + '|';
  console.log('  t='+String(t).padStart(3)+'ms  '+String(l).padStart(6)+'  '+(g===null?'(gone)':String(g).padStart(4))+bar);});
const past = frames.filter(f=>f[1] > 0.3);
console.log('\novershoot past centre:', past.length?('yes, max +'+Math.max(...past.map(f=>f[1])).toFixed(1)+'px over '+past.length+' frames'):'none');
console.log('came to rest at      :', frames[frames.length-1][1]);
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
