// A scoped refresh fetches only its own category
//
// Run with:  node tests/testscoped.mjs
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
await new Promise(r=>srv.listen(8075,r));
const b=await chromium.launch(CHROME);

const SWIPE = async ([dy, steps]) => {
  const el = document.querySelector('#list');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width/2, y0 = r.top + 30;
  const mk = (type, cy) => {
    const t = new Touch({identifier:1,target:el,clientX:x,clientY:cy,pageX:x,pageY:cy});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
  };
  mk('touchstart', y0);
  for (let i=1;i<=steps;i++){ mk('touchmove', y0 + dy*i/steps); await new Promise(r=>setTimeout(r,16)); }
  await new Promise(r=>setTimeout(r,60));
  mk('touchend', y0 + dy);
};

const CFG={migrated:8,proxies:['https://api.allorigins.win/raw?url='],idleResetMin:30,feeds:[
 {cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
 {cat:'World',name:'CBC World',url:'https://rss.cbc.ca/lineup/world.xml'},
 {cat:'World',name:'NPR News',url:'https://feeds.npr.org/1001/rss.xml'},
 {cat:'Tech',name:'Hacker News',url:'https://news.ycombinator.com/rss'},
 {cat:'Tech',name:'Ars Technica',url:'https://feeds.arstechnica.com/arstechnica/index'},
 {cat:'Science',name:'Phys.org',url:'https://phys.org/rss-feed/'}]};

const mk = async (over={}) => {
  const ctx=await b.newContext({...devices['iPhone 14 Pro']});
  const page=await ctx.newPage();
  const hits=[];
  await ctx.route('**/*',route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8075'))return route.continue();
   if(!u.includes('allorigins'))return route.abort('failed');
   const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
   hits.push(h);
   const id=h.replace(/[^a-z0-9]/gi,'').slice(0,12);
   return route.fulfill({status:200,contentType:'application/xml',
    body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title><item><title>${id} story</title><link>https://x/${id}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
  await page.addInitScript(x=>{const o=JSON.parse(x);
    localStorage.setItem('breaking.v1',JSON.stringify(o.cfg));
    if(o.tab) localStorage.setItem('breaking.v1.tab',o.tab);
    if(o.seenAt!==undefined) localStorage.setItem('breaking.v1.seenAt',String(o.seenAt));
  },JSON.stringify({cfg:{...CFG,...(over.cfg||{})},tab:over.tab,seenAt:over.seenAt}));
  await page.goto('http://localhost:8075/index.html'); await page.waitForTimeout(4000);
  return {page,ctx,hits,clear:()=>{hits.length=0;}};
};

console.log('=== scoped pull vs global button ===');
{ const h=await mk({tab:'Tech', seenAt:Date.now()-60000});
  console.log('  on tab      :',await h.page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent));
  h.clear();
  await h.page.evaluate(SWIPE,[220,10]);
  await h.page.waitForTimeout(2500);
  console.log('  PULL fetched:',[...new Set(h.hits)].sort().join(', '),'  (expect the 2 Tech feeds only)');
  console.log('  status      :',await h.page.evaluate(()=>document.querySelector('#status').textContent));

  h.clear();
  await h.page.click('#refresh');
  await h.page.waitForTimeout(3000);
  console.log('  BUTTON fetched:',[...new Set(h.hits)].length,'distinct feeds  (expect 6)');
  console.log('  status      :',await h.page.evaluate(()=>document.querySelector('#status').textContent));
  await h.ctx.close(); }

console.log('\n=== configurable idle reset ===');
for (const [label, idleResetMin, seenAt, expect] of [
  ['Never, 3h idle',      0,   Date.now()-3*3600000, 'Science'],
  ['5 min, 6 min idle',   5,   Date.now()-6*60000,   'World'],
  ['5 min, 2 min idle',   5,   Date.now()-2*60000,   'Science'],
  ['60 min, 6 min idle',  60,  Date.now()-6*60000,   'Science'],
  ['60 min, 3h idle',     60,  Date.now()-3*3600000, 'World']]) {
  const h=await mk({cfg:{idleResetMin}, tab:'Science', seenAt});
  const got=await h.page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent);
  console.log(`  ${label.padEnd(22)} -> ${got.padEnd(9)} expect ${expect}  ${got===expect?'ok':'*** MISMATCH ***'}`);
  await h.ctx.close();
}

console.log('\n=== setting persists ===');
{ const h=await mk({tab:'World', seenAt:Date.now()-60000});
  await h.page.click('#open-settings'); await h.page.waitForTimeout(400);
  console.log('  select shows :',await h.page.evaluate(()=>document.querySelector('#s-idle').value));
  await h.page.selectOption('#s-idle','120'); await h.page.waitForTimeout(300);
  console.log('  after change :',await h.page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).idleResetMin));
  await h.ctx.close(); }
await b.close();srv.close();
