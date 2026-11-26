// "No feeds reachable" means no feed anywhere answered - not that the one
// failing feed in the category you just turned to failed again.
//
// Run with:  node tests/testfailmsg.mjs
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
await new Promise(r=>srv.listen(8096,r));
const mark=(ok,msg)=>console.log((ok?'  ok  ':'*** ')+msg);

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
let offline=false, n=0;
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8096'))return route.continue();
 if(offline||!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 // One feed in Business is dead: the relay reaches it and gets a 404.
 if(id.startsWith('dead'))return route.fulfill({status:404,contentType:'text/plain',body:'not found'});
 n++;
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>`
   +`<item><title>${id} story ${n}</title><link>https://x/${id}/${n}</link>`
   +`<pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{ if(localStorage.getItem('breaking.v1'))return;
 localStorage.setItem('breaking.v1',JSON.stringify({migrated:22,idleResetMin:0,
 autoRefresh:true,proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'World One',url:'https://world.test/f'},
 {id:'2',cat:'Business',name:'Biz Live',url:'https://biz.test/f'},
 {id:'3',cat:'Business',name:'Biz Dead',url:'https://dead.test/f'},
 {id:'4',cat:'Technology',name:'Tech One',url:'https://tech.test/f'}]}));
 localStorage.setItem('breaking.v1.tab','World');});
const status=()=>page.evaluate(()=>document.querySelector('#status').textContent);
const to=async c=>{await page.evaluate(c=>[...document.querySelectorAll('.chip')]
  .find(x=>x.textContent===c).click(),c); await page.waitForTimeout(1200);};

await page.goto('http://localhost:8096/index.html');
await page.waitForTimeout(2500);
console.log('on open                 :',await status());
mark(/3\/4 feeds/.test(await status())&&/Biz Dead/.test(await status()),'the open names the one feed that failed');

// What happened on the phone: turning to the category re-fetches the feed in
// it that has been failing, and it fails again.
await to('Business');
let st=await status();
console.log('turn to Business        :',st);
mark(!/No feeds reachable/.test(st),'one dead feed in a category is not "no feeds reachable"');
mark(/Couldn't fetch Biz Dead/.test(st),'it says which feed failed');

// A pull on a category where every feed fails names them too.
await page.evaluate(()=>refresh(cfg.feeds.filter(f=>f.cat==='Business'&&f.name==='Biz Dead')
  .concat([{id:'x',cat:'Business',name:'Biz Dead Two',url:'https://dead2.test/f'}]),{name:'Business',why:'you pulled to refresh'}));
st=await status();
console.log('pull, all failing       :',st);
mark(/Couldn't fetch any of 2 Business feeds: Biz Dead, Biz Dead Two/.test(st),'a scoped pass where everything fails lists what failed');

// And when the phone genuinely reaches nothing, the arrow still says so.
offline=true;
await page.click('#refresh');await page.waitForTimeout(3500);
st=await status();
console.log('↻ with nothing reachable:',st);
mark(/No feeds reachable/.test(st),'the arrow with nothing reachable still says "No feeds reachable"');

console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
