// Feed editing: add, edit, cancel, delete with confirmation
//
// Run with:  node tests/testfeeds.mjs
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
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.replace(/[^a-z0-9]/gi,'').slice(0,12);
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title><item><title>${id} story</title><link>https://x/${id}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
// pre-v10 config: no ids yet
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:9,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
 {cat:'Canada',name:'CBC Canada',url:'https://rss.cbc.ca/lineup/canada.xml'}]})));
await page.goto('http://localhost:8071/index.html');await page.waitForTimeout(3500);

const cfg=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('ids minted by migration:',(await cfg()).feeds.map(f=>!!f.id));

console.log('\n=== two separate pages ===');
await page.click('#open-feeds'); await page.waitForTimeout(400);
console.log('  feeds open   :',await page.evaluate(()=>$("#feeds-sheet").classList.contains('open')));
console.log('  settings open:',await page.evaluate(()=>$("#settings").classList.contains('open')));
console.log('  feeds page h3:',await page.evaluate(()=>[...document.querySelectorAll('#feeds-sheet h3')].map(x=>x.textContent)));
await page.click('#close-feeds'); await page.waitForTimeout(300);
await page.click('#open-settings'); await page.waitForTimeout(400);
console.log('  settings h3  :',await page.evaluate(()=>[...document.querySelectorAll('#settings h3')].map(x=>x.textContent)));
await page.click('#close-settings'); await page.waitForTimeout(2500);

console.log('\n=== edit a feed URL ===');
await page.click('#open-feeds'); await page.waitForTimeout(400);
await page.evaluate(()=>[...document.querySelectorAll('#feeds .row')].find(r=>r.textContent.includes('BBC World')).click());
await page.waitForTimeout(300);
console.log('  editor shows URL:',await page.evaluate(()=>document.querySelector('.editor textarea').value));
// invalid first
await page.evaluate(()=>{document.querySelector('.editor textarea').value='not a url';});
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Save').click());
await page.waitForTimeout(300);
console.log('  rejected msg   :',await page.evaluate(()=>{const e=document.querySelector('.err-msg');return e.style.display===''?e.textContent:'(none)'}));
console.log('  url unchanged  :',(await cfg()).feeds.find(f=>f.name==='BBC World').url);
// duplicate
await page.evaluate(()=>{document.querySelector('.editor textarea').value='https://rss.cbc.ca/lineup/canada.xml';});
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Save').click());
await page.waitForTimeout(300);
console.log('  duplicate msg  :',await page.evaluate(()=>{const e=document.querySelector('.err-msg');return e.style.display===''?e.textContent:'(none)'}));
// valid change + rename
await page.evaluate(()=>{document.querySelector('.editor textarea').value='https://feeds.bbci.co.uk/news/world/rss.xml?v=2';
  document.querySelector('.editor input').value='BBC World News';});
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Save').click());
await page.waitForTimeout(500);
const c2=await cfg();
console.log('  saved url      :',c2.feeds.find(f=>f.name==='BBC World News').url);
console.log('  feed count     :',c2.feeds.length,'(must stay 2 - identity survived the URL change)');
console.log('  stories relabel:',await page.evaluate(()=>[...new Set(JSON.parse(localStorage.getItem('breaking.v1.items')).map(i=>i.source))]));

console.log('\n=== cancel discards edits ===');
await page.evaluate(()=>[...document.querySelectorAll('#feeds .row')].find(r=>r.textContent.includes('CBC Canada')).click());
await page.waitForTimeout(300);
console.log('  editor open   :',await page.evaluate(()=>!!document.querySelector('.editor')));
await page.evaluate(()=>{document.querySelector('.editor input').value='TYPED BUT NOT SAVED';
  document.querySelector('.editor textarea').value='https://example.com/changed.xml';});
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Cancel').click());
await page.waitForTimeout(300);
console.log('  editor closed :',await page.evaluate(()=>!document.querySelector('.editor')));
const c3=await cfg();
console.log('  name intact   :',c3.feeds.find(f=>f.cat==='Canada').name);
console.log('  url intact    :',c3.feeds.find(f=>f.cat==='Canada').url);
console.log('  feed count    :',c3.feeds.length);

console.log('\n=== delete asks first ===');
await page.evaluate(()=>[...document.querySelectorAll('#feeds .row')].find(r=>r.textContent.includes('CBC Canada')).click());
await page.waitForTimeout(300);
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Delete feed').click());
await page.waitForTimeout(300);
console.log('  prompt shown  :',await page.evaluate(()=>{const c=document.querySelector('.confirm');
  return c && c.style.display!=='none' ? c.querySelector('.err-msg').textContent : '(none)'}));
console.log('  nothing deleted yet:',(await cfg()).feeds.length,'feeds');
// Keep backs out
await page.evaluate(()=>[...document.querySelectorAll('.confirm .btn')].find(b=>b.textContent==='Keep').click());
await page.waitForTimeout(300);
console.log('  after Keep    :',(await cfg()).feeds.length,'feeds, prompt hidden:',
  await page.evaluate(()=>document.querySelector('.confirm').style.display==='none'));
// screenshot the armed state
await page.evaluate(()=>[...document.querySelectorAll('.editor .btn')].find(b=>b.textContent==='Delete feed').click());
await page.waitForTimeout(300);
await page.screenshot({path:'confirm.png'});
// now really delete
await page.evaluate(()=>[...document.querySelectorAll('.confirm .btn')].find(b=>b.textContent==='Delete').click());
await page.waitForTimeout(400);
console.log('  feeds left     :',(await cfg()).feeds.map(f=>f.name));
console.log('  its stories gone:',await page.evaluate(()=>!JSON.parse(localStorage.getItem('breaking.v1.items')).some(i=>i.source==='CBC Canada')));
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await page.screenshot({path:'feedspage.png'});
await b.close();srv.close();
