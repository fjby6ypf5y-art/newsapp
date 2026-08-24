// A setup link cannot quietly hand your reading to a relay, and a relay you
// did not choose can be removed again
//
// Run with:  node tests/testrelay.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8091,r));
const mark=(ok,msg)=>console.log((ok?'  ok  ':'*** ')+msg);

// A hostile link: one innocent feed, a relay of the attacker's choosing, and
// direct-only turned off on the way past.
const payload={v:1,f:[['World','BBC World','https://feeds.bbci.co.uk/news/world/rss.xml']],
  s:{a:1,d:0,i:30,p:['https://relay.attacker.test/?u=','javascript:alert(1)','//evil.test/?u=']}};
const b64=Buffer.from(JSON.stringify(payload),'utf8').toString('base64')
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
const outbound=[];
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8091'))return route.continue();
 outbound.push(u);return route.abort('failed');});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
// direct-only starts ON, so the link trying to turn it off is visible
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,
 directOnly:true,proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{id:'1',cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'}]})));
await page.goto('http://localhost:8091/index.html#s='+b64);
await page.waitForTimeout(1200);

const barText=await page.evaluate(()=>{const r=document.querySelector('.restore');return r?r.innerText:''});
console.log('offer bar:\n' + barText.split('\n').map(l=>'   | '+l).join('\n'));
mark(/feeds\.bbci\.co\.uk/.test(barText),'the bar names the feed hosts it would install');
mark(/relay\.attacker\.test/.test(barText),'the bar names the relay the link carries');
mark(await page.evaluate(()=>{const c=document.querySelector('.relay-offer input');return !!c&&!c.checked}),
     'the relay is offered as a separate, unticked choice');

// Restore without ticking the relay box: feeds change, relays do not.
await page.click('.restore .primary');await page.waitForTimeout(1500);
let cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('proxies after restore :',cfg.proxies);
console.log('directOnly after      :',cfg.directOnly);
mark(!cfg.proxies.some(p=>p.includes('attacker')),'an unticked relay is not adopted');
mark(cfg.directOnly===true,'a link cannot turn direct-only off');
mark(!outbound.some(u=>u.includes('attacker')),'nothing was fetched through the link\'s relay');

// Now the same link, with the box ticked: it applies, but only the https one.
await page.goto('http://localhost:8091/index.html#s='+b64);
await page.reload();          // a hash-only navigation never re-runs the script
await page.waitForTimeout(1200);
await page.click('.relay-offer input');
await page.click('.restore .primary');await page.waitForTimeout(1500);
cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('proxies once ticked   :',cfg.proxies);
mark(cfg.proxies.length===1&&cfg.proxies[0]==='https://relay.attacker.test/?u=',
     'only the absolute https prefix survives; javascript: and // are dropped');

// And it can be removed again from Settings, which it could not before.
await page.click('#open-settings');await page.waitForTimeout(400);
console.log('relay box shows       :',JSON.stringify(await page.evaluate(()=>document.querySelector('#proxy').value)));
await page.fill('#proxy','https://api.allorigins.win/raw?url=\nnot-a-relay\nhttp://insecure.test/?u=');
await page.dispatchEvent('#proxy','change');await page.waitForTimeout(300);
console.log('message               :',await page.evaluate(()=>document.querySelector('#relay-msg').textContent));
cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('proxies after editing :',cfg.proxies);
mark(cfg.proxies.length===1&&cfg.proxies[0].includes('allorigins'),'the box writes back, and only https prefixes are kept');
await page.fill('#proxy','');await page.dispatchEvent('#proxy','change');await page.waitForTimeout(300);
cfg=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
mark(cfg.proxies.length===0,'clearing the box really removes every relay');
console.log('routes cleared        :',await page.evaluate(()=>localStorage.getItem('breaking.v1.routes')));

console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
