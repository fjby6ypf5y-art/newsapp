// Turning to a category checks it — but only when it is actually old
//
// Run with:  node tests/testarrival.mjs
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
await new Promise(r=>srv.listen(8081,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
const hits=[]; let n=0;
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8081'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 hits.push(id); n++;
 // A different story each pass, so an arrival fetch is visible on the screen.
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>`
   +`<item><title>${id} story ${n}</title><link>https://x/${id}/${n}</link>`
   +`<pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('breaking.v1',JSON.stringify({migrated:13,idleResetMin:0,
 autoRefresh:true,proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'world',url:'https://world.test/f'},
 {id:'2',cat:'Business',name:'biz',url:'https://biz.test/f'},
 {id:'3',cat:'Technology',name:'tech',url:'https://tech.test/f'}]}));
 localStorage.setItem('breaking.v1.tab','World');});

const status=()=>page.evaluate(()=>document.querySelector('#status').textContent);
const chip=()=>page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent);
const age=ms=>page.evaluate(m=>{Object.values(health).forEach(h=>h.at-=m);},ms);
const toBiz=async()=>{await page.evaluate(()=>[...document.querySelectorAll('.chip')]
  .find(c=>c.textContent==='Business').click()); await page.waitForTimeout(900);};
const toWorld=async()=>{await page.evaluate(()=>[...document.querySelectorAll('.chip')]
  .find(c=>c.textContent==='World').click()); await page.waitForTimeout(900);};

await page.goto('http://localhost:8081/index.html');
await page.waitForTimeout(1200);
console.log('on open              :', hits.join(', '), '|', await status());

hits.length=0;
await toBiz();
console.log('\nturn to a fresh tab  : on', await chip(), '| fetched', hits.join(', ') || 'nothing',
            '  (expect nothing — read seconds ago)');
console.log('  status             :', await status(), '  (expect the open summary, untouched)');

await toWorld(); hits.length=0;
await age(6*60000);                       // every feed now last read six minutes ago
await toBiz();
console.log('\nturn to an old tab   : on', await chip(), '| fetched', hits.join(', ') || 'nothing',
            '  (expect biz only)');
console.log('  status             :', await status());
if (hits.join(',')!=='biz') console.log('  *** expected exactly the Business feed');

// The same check on a page turn, which is the way the categories are usually
// reached. It runs after the slide, not during it.
const drag = async ([dxT,dyT,n]) => page.evaluate(([dx,dy,steps])=>{
  const el=document.querySelector('#list'), r=el.getBoundingClientRect();
  const x0=r.left+r.width/2, y0=r.top+120;
  const mk=(type,x,y)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:y,pageX:x,pageY:y});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));};
  mk('touchstart',x0,y0);
  for(let i=1;i<=steps;i++) mk('touchmove',x0+dx*i/steps,y0+dy*i/steps);
  mk('touchend',x0+dx,y0+dy);
},[dxT,dyT,n]);
await toWorld(); hits.length=0;
await age(6*60000);
await drag([-280,0,10]); await page.waitForTimeout(1200);
console.log('\nswipe to an old tab  : on', await chip(), '| fetched', hits.join(', ') || 'nothing',
            '  (expect the feeds of the category landed on)');
if (!hits.length) console.log('  *** a page turn onto an old category fetched nothing');

// The arrow still refreshes everything, and a turn with autoRefresh off fetches nothing.
hits.length=0;
await page.evaluate(()=>{cfg.autoRefresh=false;save();});
await toWorld(); await age(6*60000); await toBiz();
console.log('\nauto-refresh off     : fetched', hits.join(', ') || 'nothing', '  (expect nothing)');
if (hits.length) console.log('  *** a turn fetched with auto-refresh off');

console.log('\n'+(errs.length?'*** ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
