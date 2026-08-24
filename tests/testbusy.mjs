// The reading surface is held back while feeds land
//
// Run with:  node tests/testbusy.mjs
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
await new Promise(r=>srv.listen(8067,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let slow=2500;
await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8067'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 if(id==='c') await new Promise(r=>setTimeout(r,slow));      // one stubborn feed
 const items=Array.from({length:10},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'},
 {id:'3',cat:'Canada',name:'C',url:'https://c.test/f'}]})));
await page.goto('http://localhost:8067/index.html');
const state = async () => page.evaluate(()=>({
  busy: document.body.classList.contains('busy'),
  chipsOpacity: getComputedStyle(document.querySelector('.chips')).opacity,
  paneOpacity: getComputedStyle(document.querySelector('.pane')).opacity,
  ariaBusy: document.querySelector('.pane').getAttribute('aria-busy'),
  status: document.querySelector('#status').textContent,
  statusOpacity: getComputedStyle(document.querySelector('#status')).opacity,
  tab: (document.querySelector('.chip[aria-pressed="true"]')||{}).textContent}));
await page.waitForTimeout(900);
console.log('while feeds are landing:', await state());
// try to change category by tapping a chip
const clicked = await page.evaluate(()=>{
  const c=[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Business');
  if(!c) return 'no chip';
  try { c.click(); } catch {}
  const r=c.getBoundingClientRect();
  const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return 'chip is '+(hit && hit.closest('.chip')?'tappable':'not tappable');});
console.log('  chip tap             :', clicked);
console.log('  tab after chip tap   :', (await state()).tab);
// try to swipe
await page.evaluate(async()=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y0,pageX:x,pageY:y0});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0);
  for(let i=1;i<=12;i++){await new Promise(r=>setTimeout(r,14)); mk('touchmove',x0-260*i/12);}
  mk('touchend',x0-260);});
await page.waitForTimeout(400);
console.log('  tab after swipe      :', (await state()).tab, '(should still be World)');
await page.waitForTimeout(3000);
console.log('\nonce every feed is in :', await state());
const c2 = await page.evaluate(()=>{const c=[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Business');
  c.click(); return true;});
console.log('  chip tap now works   :', (await state()).tab);
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
