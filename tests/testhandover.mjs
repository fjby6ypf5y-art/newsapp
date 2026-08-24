// Frame-by-frame through the handover: the screen is never blank
//
// Run with:  node tests/testhandover.mjs
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
await new Promise(r=>srv.listen(8069,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8069'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:190},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*7*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'}]})));
await page.goto('http://localhost:8069/index.html');await page.waitForTimeout(2500);
const frames = await page.evaluate(async()=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=10;i++){await new Promise(r=>setTimeout(r,16)); mk('touchmove',x0-200*i/10);}
  const out=[]; const t0=performance.now();
  mk('touchend',x0-200);
  await new Promise(done=>{const tick=()=>{
    const g=[...document.querySelectorAll('.panel.side')].map(e=>e).find(e=>new DOMMatrix(getComputedStyle(e).transform).m41>-200);
    const mid=innerWidth/2;
    const probe=y=>{const n=document.elementFromPoint(mid,y);
      const it=n&&n.closest&&n.closest('.item');
      return it?it.querySelector('.ttl').textContent.replace(' story','').replace('w','World ').replace('b','Biz '):'—';};
    out.push({t:Math.round(performance.now()-t0),
      lx:Math.round(new DOMMatrix(getComputedStyle(el).transform).m41),
      gx:g?Math.round(new DOMMatrix(getComputedStyle(g).transform).m41):null,
      rows:el.querySelectorAll('.item').length,
      grows:g?g.querySelectorAll('.item').length:0,
      top:probe(200), bottom:probe(innerHeight-90),
      chip:document.querySelector('.chip[aria-pressed="true"]').textContent,
      scroll:el.scrollTop});
    if(performance.now()-t0<520) requestAnimationFrame(tick); else done();};
    requestAnimationFrame(tick);});
  return out;});
console.log('every frame from release through the handover:');
let prev=null;
for (const f of frames) {
  const mark = (f.top==='—'||f.bottom==='—') ? '   <-- BLANK AT PROBE' : '';
  const changed = prev && (prev.rows!==f.rows || prev.chip!==f.chip || (prev.gx===null)!==(f.gx===null));
  console.log('  t='+String(f.t).padStart(3)+' lx='+String(f.lx).padStart(5)+' gx='+String(f.gx).padStart(5)
    +' rows='+String(f.rows).padStart(3)+' preview='+String(f.grows).padStart(3)
    +' scroll='+String(f.scroll).padStart(4)
    +' chip='+f.chip.padEnd(9)+' top="'+f.top+'" bot="'+f.bottom+'"'+(changed?'  *':'')+mark);
  prev=f;
}
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
