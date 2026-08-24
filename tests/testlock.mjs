// The list cannot scroll during a sideways drag, and its position is restored
//
// Run with:  node tests/testlock.mjs
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
await new Promise(r=>srv.listen(8064,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8064'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 const items=Array.from({length:30},(_,i)=>`<item><title>${id} item ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'W',url:'https://w.test/f'},
 {id:'2',cat:'Business',name:'B',url:'https://b.test/f'}]})));
await page.goto('http://localhost:8064/index.html');await page.waitForTimeout(3000);
console.log('touch-action on list:', await page.evaluate(()=>getComputedStyle(document.querySelector('#list')).touchAction));
await page.evaluate(()=>document.querySelector('#list').scrollTop=500);
const top=()=>page.evaluate(()=>document.querySelector('#list').scrollTop);
const ov =()=>page.evaluate(()=>document.querySelector('#list').style.overflowY||'(auto)');
console.log('scrolled to        :', await top());
// diagonal drag: horizontal-dominant but with real vertical movement
const drag = (dx,dy) => page.evaluate(async([dx,dy])=>{
  const el=document.querySelector('#list'),r=el.getBoundingClientRect();
  const x0=r.left+r.width/2,y0=r.top+200;
  const mk=(t,x,y)=>{const tc=new Touch({identifier:1,target:el,clientX:x,clientY:y,pageX:x,pageY:y});
    el.dispatchEvent(new TouchEvent(t,{bubbles:true,cancelable:true,
      touches:t==='touchend'?[]:[tc],targetTouches:t==='touchend'?[]:[tc],changedTouches:[tc]}));};
  mk('touchstart',x0,y0);
  const out=[];
  for(let i=1;i<=12;i++){await new Promise(r=>setTimeout(r,14));
    mk('touchmove',x0+dx*i/12,y0+dy*i/12);
    out.push(el.scrollTop);}
  return out;
},[dx,dy]);
const mid = await drag(-220,-90);
console.log('overflow mid-drag  :', await ov());
console.log('scrollTop samples  :', [...new Set(mid)].join(','), (new Set(mid)).size===1?'(frozen)':'*** SCROLLED ***');
await page.evaluate(()=>{const el=document.querySelector('#list');
  const tc=new Touch({identifier:1,target:el,clientX:0,clientY:0});
  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[tc]}));});
await page.waitForTimeout(500);
console.log('after commit       : tab', await page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent),
            '| scrollTop', await top(), '| overflow', await ov());
// a cancelled sideways drag must restore the scroll position, not jump to top
await page.evaluate(()=>document.querySelector('#list').scrollTop=420);
await drag(-90,-40);
await page.evaluate(()=>{const el=document.querySelector('#list');
  const tc=new Touch({identifier:1,target:el,clientX:0,clientY:0});
  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[tc]}));});
await page.waitForTimeout(500);
console.log('cancelled drag     : scrollTop', await top(), '| overflow', await ov(), '(should be 420)');
// plain vertical scroll still works
await page.evaluate(()=>document.querySelector('#list').scrollTop=0);
await drag(0,-260);
console.log('vertical drag      : scrollTop', await top(), '| overflow', await ov());
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
