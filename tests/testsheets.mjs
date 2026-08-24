// Closing Feeds or Settings fetches only what changed
//
// Run with:  node tests/testsheets.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8079,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let fetched=[];
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8079'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 fetched.push(id);
 const items=Array.from({length:5},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'w',url:'https://aaa.test/f'},
 {id:'2',cat:'Business',name:'b',url:'https://bbb.test/f'},
 {id:'3',cat:'Tech',name:'t',url:'https://ccc.test/f'}]})));
await page.goto('http://localhost:8079/index.html');await page.waitForTimeout(2500);
const busySeen = async ms => { let seen=false; const t=Date.now();
  while(Date.now()-t<ms){ if(await page.evaluate(()=>document.body.classList.contains('busy'))) seen=true;
    await page.waitForTimeout(40);} return seen; };

console.log('1. open Feeds, change nothing, close');
fetched=[];
await page.click('#open-feeds'); await page.waitForTimeout(400);
await page.click('#close-feeds');
console.log('   greyed out :', await busySeen(900), '| fetches:', fetched.length);

console.log('\n2. open Feeds, Test all feeds, close');
fetched=[];
await page.click('#open-feeds'); await page.waitForTimeout(300);
await page.click('#f-test'); await page.waitForTimeout(1200);
console.log('   the test itself fetched:', fetched.join(', '));
fetched=[];
await page.click('#close-feeds');
console.log('   greyed out :', await busySeen(900), '| fetches after closing:', fetched.length);

console.log('\n3. open Settings, close');
fetched=[];
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.click('#close-settings');
console.log('   greyed out :', await busySeen(900), '| fetches:', fetched.length);

console.log('\n4. add a feed, close');
fetched=[];
await page.click('#open-feeds'); await page.waitForTimeout(300);
await page.evaluate(()=>{cfg.feeds.push({id:'9',cat:'Science',name:'new',url:'https://ddd.test/f'});save();renderFeeds();});
await page.click('#close-feeds'); await page.waitForTimeout(1200);
console.log('   fetches    :', fetched.join(', ') || '(none)', '| expected just the new one');
console.log('   greyed out :', await busySeen(300), '| status:', await page.evaluate(()=>document.querySelector('#status').textContent));

console.log('\n5. the circular arrow still refreshes everything');
fetched=[];
await page.click('#refresh'); await page.waitForTimeout(1500);
console.log('   fetches    :', fetched.join(', '));
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
