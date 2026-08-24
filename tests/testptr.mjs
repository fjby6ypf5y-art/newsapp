// Pull to refresh, and the idle reset to the first category
//
// Run with:  node tests/testptr.mjs
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
await new Promise(r=>srv.listen(8077,r));
const b=await chromium.launch(CHROME);

// in-page synthetic swipe over #list
const SWIPE = async ([dy, steps]) => {
  const el = document.querySelector('#list');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width/2, y0 = r.top + 30;
  const mk = (type, cy) => {
    const t = new Touch({identifier:1, target:el, clientX:x, clientY:cy, pageX:x, pageY:cy});
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
  };
  mk('touchstart', y0);
  for (let i=1;i<=steps;i++){ mk('touchmove', y0 + dy*i/steps); await new Promise(r=>setTimeout(r,16)); }
  await new Promise(r=>setTimeout(r,60));
  const state = {transform:getComputedStyle(el).transform,
                 label:document.querySelector('#ptr-text').textContent,
                 opacity:+getComputedStyle(document.querySelector('#ptr')).opacity};
  mk('touchend', y0 + dy);
  return state;
};

const mk = async (seed) => {
  const ctx=await b.newContext({...devices['iPhone 14 Pro']});
  const page=await ctx.newPage();
  let fetches=0;
  await ctx.route('**/*',route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8077'))return route.continue();
   if(!u.includes('allorigins'))return route.abort('failed');
   fetches++;
   const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
   const id=h.replace(/[^a-z0-9]/gi,'').slice(0,12);
   const items=Array.from({length:12},(_,i)=>`<item><title>${id} #${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*40*60000).toUTCString()}</pubDate></item>`).join('');
   return route.fulfill({status:200,contentType:'application/xml',body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
  if (seed) await page.addInitScript(x=>{const o=JSON.parse(x);
    localStorage.setItem('breaking.v1',JSON.stringify(o.cfg));
    if(o.tab) localStorage.setItem('breaking.v1.tab',o.tab);
    if(o.seenAt!==undefined) localStorage.setItem('breaking.v1.seenAt',String(o.seenAt));
  },JSON.stringify(seed));
  await page.goto('http://localhost:8077/index.html'); await page.waitForTimeout(4000);
  return {page, ctx, count:()=>fetches, reset:()=>{fetches=0;}};
};

console.log('=== hot colour ===');
{ const {page,ctx}=await mk(null);
  console.log('  --h0 =',await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--h0').trim()));
  console.log('  newest rail =',await page.evaluate(()=>getComputedStyle(document.querySelector('.item')).borderLeftColor));
  await ctx.close(); }

console.log('\n=== pull to refresh ===');
{ const h=await mk(null);
  h.reset();
  let st=await h.page.evaluate(SWIPE,[40,8]);
  console.log('  short pull  ->', st.label, '| transform', st.transform.slice(0,28));
  await h.page.waitForTimeout(2500);
  console.log('  fetches after short pull:', h.count(), '(expect 0)');

  h.reset();
  st=await h.page.evaluate(SWIPE,[220,10]);
  console.log('  long pull   ->', st.label, '| opacity', st.opacity.toFixed(2));
  await h.page.waitForTimeout(3000);
  console.log('  fetches after long pull :', h.count(), '(expect >0)');
  console.log('  transform settled back  :', await h.page.evaluate(()=>getComputedStyle(document.querySelector('#list')).transform));

  // scrolled away from the top: gesture must be ignored
  await h.page.evaluate(()=>{document.querySelector('#list').scrollTop=800});
  await h.page.waitForTimeout(200); h.reset();
  st=await h.page.evaluate(SWIPE,[220,10]);
  await h.page.waitForTimeout(2000);
  console.log('  mid-list pull fetches   :', h.count(), '(expect 0)');
  await h.ctx.close(); }

console.log('\n=== idle reset to first tab ===');
const cfg={migrated:8,proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
 {cat:'Tech',name:'Hacker News',url:'https://news.ycombinator.com/rss'},
 {cat:'Science',name:'Phys.org',url:'https://phys.org/rss-feed/'}]};
for (const [label, seenAt, expect] of [
  ['fresh install (no seenAt)', undefined, 'World'],
  ['used 2 minutes ago',        Date.now()-2*60000, 'Science'],
  ['last used 3 hours ago',     Date.now()-3*3600000, 'World']]) {
  const {page,ctx}=await mk({cfg, tab:'Science', seenAt});
  console.log(`  ${label.padEnd(26)} -> ${await page.evaluate(()=>document.querySelector('.chip[aria-pressed="true"]').textContent)}  (expect ${expect})`);
  await ctx.close();
}
await b.close();srv.close();
