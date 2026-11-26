// Your own relay: the Worker in relay/worker.js does what it says, and the
// switch in Settings puts it in front of the public relays when on and takes
// it out entirely when off - without its key ever leaving the phone.
//
// Run with:  node tests/testownrelay.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const mark=(ok,msg)=>console.log((ok?'  ok  ':'*** ')+msg);
const rss=(name,n)=>`<?xml version="1.0"?><rss version="2.0"><channel><title>${name}</title>`
  +Array.from({length:n},(_,i)=>`<item><title>${name} story ${i}</title><link>https://example.com/${encodeURIComponent(name)}/${i}</link>`
  +`<guid>${name}-${i}</guid><pubDate>${new Date(Date.now()-i*60000).toUTCString()}</pubDate></item>`).join('')
  +`</channel></rss>`;

/* ------------------------------------------------ the Worker, on its own */
console.log('relay/worker.js');
const worker=(await import(path.join(ROOT,'relay/worker.js'))).default;
const realFetch=globalThis.fetch;
let upstream=null, upstreamSaw=null;
globalThis.fetch=async(u,init)=>{upstreamSaw={u,init};return upstream(u,init)};
const W='https://news-relay.me.workers.dev/';
const call=async(qs,env={RELAY_KEY:'s3cret'},method='GET')=>worker.fetch(new Request(W+qs,{method,headers:{'User-Agent':'TestPhone/1'}}),env);
upstream=async()=>new Response(rss('Up',2),{status:200,headers:{'Content-Type':'application/rss+xml','Set-Cookie':'track=1'}});
const feed=encodeURIComponent('https://www.cbc.ca/webfeed/rss/rss-canada');

let r=await call('?key=s3cret&url='+feed,{});
mark(r.status===500,'no RELAY_KEY set: refuses everything (500), not an open relay');
r=await call('?url='+feed);
mark(r.status===401,'no key: 401');
r=await call('?key=s3cre&url='+feed);
mark(r.status===401,'a key that is nearly right: 401');
r=await call('?key=s3cret');
mark(r.status===400,'no url: 400');
r=await call('?key=s3cret&url='+encodeURIComponent('javascript:alert(1)'));
mark(r.status===400,'javascript: url: 400');
r=await call('?key=s3cret&url='+encodeURIComponent('file:///etc/passwd'));
mark(r.status===400,'file: url: 400');
r=await call('?key=s3cret&url='+encodeURIComponent(W+'?key=s3cret&url=x'));
mark(r.status===400,'a request back to itself: 400');
r=await call('',undefined,'OPTIONS');
mark(r.status===204&&r.headers.get('access-control-allow-origin')==='*','preflight answered with CORS');
r=await call('?key=s3cret&url='+feed,undefined,'POST');
mark(r.status===405,'POST: 405');
upstreamSaw=null;
r=await call('?key=s3cret&url='+feed);
const body=await r.text();
mark(r.status===200&&body.includes('Up story 1'),'right key: the feed comes back');
mark(r.headers.get('access-control-allow-origin')==='*','with the CORS header the publisher left out');
mark(r.headers.get('content-type')==='application/rss+xml','with the publisher\'s content type');
mark(!r.headers.get('set-cookie'),'without the publisher\'s cookies');
mark(upstreamSaw&&upstreamSaw.u==='https://www.cbc.ca/webfeed/rss/rss-canada','fetched the decoded feed URL');
const ua=upstreamSaw&&upstreamSaw.init.headers['User-Agent'];
mark(ua&&ua!=='TestPhone/1'&&/Safari/.test(ua),'with a generic browser User-Agent, not the phone\'s own');
mark(Object.keys(upstreamSaw.init.headers).sort().join()==='Accept,User-Agent','and nothing else of the phone\'s headers');
mark(!String(upstreamSaw&&JSON.stringify(upstreamSaw)).includes('s3cret'),'and never the key');
r=await call('?key=s3cret&url='+feed,{RELAY_KEY:'s3cret',ALLOW_ORIGIN:'https://me.github.io'});
mark(r.headers.get('access-control-allow-origin')==='https://me.github.io','ALLOW_ORIGIN narrows the CORS header');
upstream=async()=>new Response('nope',{status:404});
r=await call('?key=s3cret&url='+feed);
mark(r.status===404,'publisher 404 is passed through as 404');
upstream=async()=>{throw new TypeError('dns')};
r=await call('?key=s3cret&url='+feed);
mark(r.status===502,'publisher unreachable: 502');
upstream=async()=>new Response('x'.repeat(10),{headers:{'Content-Length':String(6*1024*1024)}});
r=await call('?key=s3cret&url='+feed);
mark(r.status===413,'a body that claims to be 6MB: 413');
const bodyNoKey=await (await call('?key=wrong&url='+feed)).text();
mark(!bodyNoKey.includes('s3cret'),'an error never echoes the key');
globalThis.fetch=realFetch;

/* ------------------------------------------------------- the app's switch */
console.log('\nSettings switch');
const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,res)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p); if(!fs.existsSync(f)){res.writeHead(404);return res.end()}
 res.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});res.end(fs.readFileSync(f))});
await new Promise(res=>srv.listen(8095,res));

const KEY='k3y-only-the-phone-knows';
const OWN='https://news-relay.me.workers.dev/?key='+KEY+'&url=';
const FEEDS=[
  {id:'1',cat:'Canada',name:'CBC Canada',url:'https://www.cbc.ca/webfeed/rss/rss-canada'},
  {id:'2',cat:'Canada',name:'Global News',url:'https://globalnews.ca/feed/'}];

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
const hits=[];          // every relay request, in order: [host, feed]
await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8095'))return route.continue();
 const url=new URL(u);
 // The outage: no publisher sends CORS, and both public relays are 522ing.
 if(url.host==='www.cbc.ca'||url.host==='globalnews.ca') return route.abort('failed');
 if(url.host==='api.allorigins.win'||url.host==='api.codetabs.com'){
   hits.push([url.host,url.searchParams.get('url')||url.searchParams.get('quest')]);
   return route.fulfill({status:522,contentType:'text/plain',body:'error code: 522'});}
 if(url.host==='news-relay.me.workers.dev'){
   const target=url.searchParams.get('url');
   hits.push([url.host,target]);
   if(url.searchParams.get('key')!==KEY) return route.fulfill({status:401,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*'},body:'wrong or missing key'});
   const f=FEEDS.find(x=>x.url===target);
   return route.fulfill({status:200,contentType:'application/rss+xml',headers:{'Access-Control-Allow-Origin':'*'},body:rss(f?f.name:'?',3)});}
 return route.abort('failed');});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(([feeds,own])=>{ if(localStorage.getItem('breaking.v1'))return;
 localStorage.setItem('breaking.v1',JSON.stringify({migrated:22,feeds,
  proxies:['https://api.allorigins.win/raw?url=','https://api.codetabs.com/v1/proxy?quest='],
  ownRelay:own,ownRelayOn:false}))},[FEEDS,OWN]);
await page.goto('http://localhost:8095/index.html');
await page.waitForTimeout(4000);

const stories=()=>page.evaluate(()=>[...document.querySelectorAll('#list .item, #list li, #list a')].length);
const cfgNow=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('status, switch off   :',await page.textContent('#status'));
mark(!hits.some(h=>h[0]==='news-relay.me.workers.dev'),'switched off: your relay is never contacted');
mark(hits.some(h=>h[0]==='api.allorigins.win'),'the public relays are tried as usual');

await page.click('#open-settings');await page.waitForTimeout(400);
let msg=await page.textContent('#own-msg');
console.log('settings says        :',msg);
mark(/news-relay\.me\.workers\.dev — off/.test(msg),'Settings names the relay and says it is off');
mark(!msg.includes(KEY),'without showing the key');
mark(await page.inputValue('#own-relay')===OWN,'the address is there to edit');

// Test works with the switch off, so the relay can be checked before an outage.
await page.click('#own-test');await page.waitForFunction(()=>!document.querySelector('#own-test').disabled);
msg=await page.textContent('#own-msg');
console.log('test, switch off     :',msg);
mark(/Test: CBC Canada came back in \d+ms with 3 stories/.test(msg),'Test fetches a real feed through it');
mark((await cfgNow()).ownRelayOn===false,'and testing does not switch it on');

// A wrong key is named as a wrong key.
await page.fill('#own-relay',OWN.replace(KEY,'nope'));
await page.click('#own-test');await page.waitForFunction(()=>!document.querySelector('#own-test').disabled);
msg=await page.textContent('#own-msg');
console.log('test, wrong key      :',msg);
mark(/wrong key/.test(msg),'a wrong key says so');
// Tapping Test takes focus out of the box, which saves it like any other
// edit - so what was tested is what is kept. Put the right one back.
mark((await cfgNow()).ownRelay===OWN.replace(KEY,'nope'),'leaving the box saves what was typed in it');
await page.fill('#own-relay',OWN);await page.dispatchEvent('#own-relay','change');
mark((await cfgNow()).ownRelay===OWN,'and the right address goes back in the same way');

// A non-https address is not saved.
await page.fill('#own-relay','http://news-relay.me.workers.dev/?key=x&url=');
await page.dispatchEvent('#own-relay','change');
console.log('http address         :',await page.textContent('#own-msg'));
mark((await cfgNow()).ownRelay===OWN,'an http:// address is refused and the old one kept');
await page.fill('#own-relay',OWN);await page.dispatchEvent('#own-relay','change');

// Switch on, close, refresh everything: the outage is over for this phone.
hits.length=0;
await page.click('#s-own');await page.waitForTimeout(200);
console.log('switched on          :',await page.textContent('#own-msg'));
mark((await cfgNow()).ownRelayOn===true,'the switch is saved');
await page.click('#close-settings');await page.waitForTimeout(500);
await page.click('#refresh');await page.waitForTimeout(4000);
console.log('status, switch on    :',await page.textContent('#status'));
const shown=await page.evaluate(()=>document.body.innerText);
mark(/CBC Canada story 0/.test(shown)&&/Global News story 0/.test(shown),'both feeds load through your relay while the public ones are down');
const firstRelayFor=u=>(hits.find(h=>h[1]===u)||[])[0];
console.log('first relay per feed :',FEEDS.map(f=>f.name+' → '+firstRelayFor(f.url)).join(', '));
mark(FEEDS.every(f=>firstRelayFor(f.url)==='news-relay.me.workers.dev'),'your relay is asked before any public relay');
mark(!hits.some(h=>h[0]!=='news-relay.me.workers.dev'),'and the public relays are not asked at all while it answers');
mark(!shown.includes(KEY),'the key appears nowhere on screen');

// Settings shows its record alongside the public relays'.
await page.click('#open-settings');await page.waitForTimeout(300);
const health=await page.textContent('#relay-health');
console.log('relay health         :',health);
mark(/news-relay\.me\.workers\.dev: \d+ ok/.test(health),'its record shows in the relay health line');

// The log, the setup link and Export.
const log=await page.evaluate(()=>localStorage.getItem('breaking.v1.log')||'');
mark(!log.includes(KEY),'the key is not in the fetch log');
const link=await page.evaluate(()=>setupLink());
const decoded=Buffer.from(link.split('#s=')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString();
mark(!decoded.includes(KEY)&&!decoded.includes('news-relay'),'a setup link carries neither the relay nor its key');
await page.click('#io-export');
mark((await page.inputValue('#io')).includes(KEY),'Export (your own backup) keeps it');

// Direct only beats it.
await page.click('#s-direct');await page.waitForTimeout(200);
console.log('with direct only     :',await page.textContent('#own-msg'));
let cands=await page.evaluate(u=>candidatesFor(u).map(c=>c.label),FEEDS[0].url);
mark(cands.length===1&&cands[0]==='direct','Direct only leaves your relay out too');
await page.click('#s-direct');await page.waitForTimeout(200);
cands=await page.evaluate(u=>candidatesFor(u).map(c=>c.label),FEEDS[0].url);
console.log('candidates           :',cands.join(' → '));
mark(cands[0]==='direct'&&cands[1]==='news-relay.me.workers.dev','direct first, then your relay, then the public ones');

// Switch off: gone from the race, address kept for next time.
await page.click('#s-own');await page.waitForTimeout(200);
cands=await page.evaluate(u=>candidatesFor(u).map(c=>c.label),FEEDS[0].url);
console.log('switched off         :',cands.join(' → '));
mark(!cands.includes('news-relay.me.workers.dev'),'switched off: out of the race');
let c=await cfgNow();
mark(c.ownRelay===OWN&&c.ownRelayOn===false,'and the address is kept, ready for next time');

// Clearing the address switches it off and cannot be switched back on empty.
await page.click('#s-own');await page.fill('#own-relay','');await page.dispatchEvent('#own-relay','change');
c=await cfgNow();
mark(c.ownRelay===''&&c.ownRelayOn===false,'clearing the address switches it off');
await page.click('#s-own');await page.waitForTimeout(100);
mark(!(await page.isChecked('#s-own'))&&/Paste your relay/.test(await page.textContent('#own-msg')),'and it will not switch on with no address');

// A pasted JSON import goes through the same gate.
await page.fill('#io',JSON.stringify({feeds:FEEDS,ownRelay:'javascript:alert(1)//',ownRelayOn:true}));
await page.click('#io-import');await page.waitForTimeout(300);
c=await cfgNow();
mark(c.ownRelay===''&&c.ownRelayOn===false,'a JSON import cannot install a javascript: relay');

console.log(errs.length?'ERRORS '+errs.join(';'):'no JS errors');
await b.close();srv.close();
