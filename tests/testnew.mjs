// The "N new" count means what this refresh brought in
//
// Run with:  node tests/testnew.mjs
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
await new Promise(r=>srv.listen(8061,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let extra=0; // how many additional stories each feed serves
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8061'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.split('.')[0];
 const n=5+extra;
 const items=Array.from({length:n},(_,i)=>`<item><title>${id} item ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'},
 {id:'3',cat:'Tech',name:'T',url:'https://t.test/f'}]})));
const st=()=>page.evaluate(()=>document.querySelector('#status').textContent);
await page.goto('http://localhost:8061/index.html');await page.waitForTimeout(3500);
console.log('first load (15 stories) :', await st());
await page.click('#refresh'); await page.waitForTimeout(2500);
console.log('re-refresh, nothing new :', await st());
extra=2; // each feed gains 2
await page.click('#refresh'); await page.waitForTimeout(2500);
console.log('6 new across 3 feeds    :', await st());
extra=4;
// scoped: pull to refresh on World only -> should say 2, not 6
await page.evaluate(()=>{
  const el=document.querySelector('#list'), r=el.getBoundingClientRect();
  const x=r.left+r.width/2, y=r.top+120;
  const mk=(t,yy)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:yy,pageX:x,pageY:yy});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',y); for(let i=1;i<=10;i++) mk('touchmove',y+220*i/10); mk('touchend',y+220);
});
await page.waitForTimeout(2500);
console.log('scoped pull, World only :', await st());
console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
