// Supplementing Business, and the paywall marking
//
//   - the added markets feeds reach a feed list that already exists
//   - nothing already in that list is removed - Yahoo Finance in particular,
//     which build .66 dropped by mistake and .67 puts back
//   - a feed removed by hand afterwards stays removed
//   - paywalled library entries are marked, and "Add all" leaves them alone
//
// Run with:  node tests/testpaywall.mjs
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
await new Promise(r=>srv.listen(8083,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8083'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.replace(/[^a-z0-9]/gi,'').slice(0,12);
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title><item><title>${id} story</title><link>https://x/${id}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
const cfg=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
const names=async()=>(await cfg()).feeds.map(f=>f.name);

const YAHOO='https://finance.yahoo.com/news/rssindex';
const CALM=['The Big Picture','A Wealth of Common Sense','Abnormal Returns'];

console.log('=== a reader who has Yahoo Finance ===');
await page.addInitScript(y=>{
  // Runs on every navigation, reloads included - seed once, or the reload
  // below would restore the pre-migration config and prove nothing.
  if(localStorage.getItem('breaking.v1'))return;
  localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,
    proxies:['https://api.allorigins.win/raw?url='],feeds:[
    {id:'a',cat:'World',name:'BBC World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
    {id:'b',cat:'Business',name:'Yahoo Finance',url:y},
    {id:'c',cat:'Business',name:'CBC Business',url:'https://rss.cbc.ca/lineup/business.xml'}]}));
  localStorage.setItem('breaking.v1.items',JSON.stringify([
    {source:'Yahoo Finance',title:'One stock, up',link:'https://x/y',ts:Date.now()},
    {source:'CBC Business',title:'Bank holds rate',link:'https://x/c',ts:Date.now()}]));
},YAHOO);
await page.goto('http://localhost:8083/index.html');await page.waitForTimeout(3500);

const c1=await cfg();
console.log('  migrated to      :',c1.migrated);
console.log('  Yahoo still there:',c1.feeds.some(f=>f.url===YAHOO),'(must be true - supplement, not replace)');
console.log('  added alongside  :',CALM.filter(n=>c1.feeds.some(f=>f.name===n)));
console.log('  Yahoo duplicated :',c1.feeds.filter(f=>f.url===YAHOO).length,'(must be 1)');
console.log('  full list        :',await names());
const left=await page.evaluate(()=>[...new Set(JSON.parse(localStorage.getItem('breaking.v1.items')).map(i=>i.source))]);
console.log('  cached sources   :',left,'(Yahoo headlines must survive - its feed is still here)');
if(!c1.feeds.some(f=>f.url===YAHOO)) console.log('*** Yahoo Finance was removed');
if(c1.feeds.filter(f=>f.url===YAHOO).length!==1) console.log('*** Yahoo Finance was duplicated');
if(CALM.some(n=>!c1.feeds.some(f=>f.name===n))) console.log('*** the supplementary feeds were not added');
if(!left.includes('Yahoo Finance')) console.log('*** Yahoo headlines were pruned from a feed that is still subscribed');

console.log('\n=== a phone that already ran build .66 gets Yahoo back ===');
const ctx3=await b.newContext({...devices['iPhone 14 Pro']});const p3=await ctx3.newPage();
await ctx3.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8083'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`});});
p3.on('pageerror',e=>errs.push(e.message));
// exactly what .66 left behind: migrated 12, Yahoo gone, the three added
await p3.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:12,
  proxies:['https://api.allorigins.win/raw?url='],feeds:[
  {id:'a',cat:'Business',name:'CBC Business',url:'https://rss.cbc.ca/lineup/business.xml'},
  {id:'d',cat:'Business',name:'The Big Picture',url:'https://ritholtz.com/feed/'},
  {id:'e',cat:'Business',name:'A Wealth of Common Sense',url:'https://awealthofcommonsense.com/feed/'},
  {id:'f',cat:'Business',name:'Abnormal Returns',url:'https://abnormalreturns.com/feed/'}]})));
await p3.goto('http://localhost:8083/index.html');await p3.waitForTimeout(2500);
const c3=await p3.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('  migrated to      :',c3.migrated);
console.log('  Yahoo restored   :',c3.feeds.some(f=>f.url===YAHOO),'(must be true)');
console.log('  no duplicates    :',c3.feeds.length===5,'-',c3.feeds.map(f=>f.name));
if(!c3.feeds.some(f=>f.url===YAHOO)) console.log('*** build .66 removal was never repaired');
if(c3.feeds.length!==5) console.log('*** the repair duplicated the feeds .66 had already added');

console.log('\n=== the migration is not repeated ===');
// Remove one of the replacements by hand, reload: it must stay removed.
await page.evaluate(n=>{const c=JSON.parse(localStorage.getItem('breaking.v1'));
  c.feeds=c.feeds.filter(f=>f.name!==n);localStorage.setItem('breaking.v1',JSON.stringify(c));},CALM[0]);
await page.reload();await page.waitForTimeout(2500);
console.log('  '+CALM[0]+' back:',(await names()).includes(CALM[0]),'(must be false)');
if((await names()).includes(CALM[0])) console.log('*** a removed feed was pushed back');

console.log('\n=== StatCan moved to Atom: migration 19 repairs a saved feed ===');
// Statistics Canada retired /n1/dai-quo/rss/ - a hard 404 - and moved The
// Daily to /n1/rss/dai-quo/0-eng.atom. A reader who already has the old URL
// gets it rewritten, not removed, and a reader who somehow has both keeps one.
const SC_OLD='https://www150.statcan.gc.ca/n1/dai-quo/rss/new-nouveau-eng.xml';
const SC_NEW='https://www150.statcan.gc.ca/n1/rss/dai-quo/0-eng.atom';
for (const [label, seed] of [
  ['only the old URL',  [{id:'a',cat:'Canada',name:'StatCan The Daily',url:SC_OLD}]],
  ['both URLs at once', [{id:'a',cat:'Canada',name:'StatCan The Daily',url:SC_OLD},
                         {id:'b',cat:'Canada',name:'StatCan The Daily',url:SC_NEW}]]]) {
  const cx=await b.newContext({...devices['iPhone 14 Pro']});const pg=await cx.newPage();
  await cx.route('**/*',route=>{const u=route.request().url();
   if(u.startsWith('http://localhost:8083'))return route.continue();
   if(!u.includes('allorigins'))return route.abort('failed');
   return route.fulfill({status:200,contentType:'application/xml',
    body:`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`});});
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(f=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:18,idleResetMin:0,
    proxies:['https://api.allorigins.win/raw?url='],feeds:JSON.parse(f)})), JSON.stringify(seed));
  await pg.goto('http://localhost:8083/index.html');await pg.waitForTimeout(2500);
  const c=await pg.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
  const urls=c.feeds.filter(f=>/statcan/.test(f.url)).map(f=>f.url);
  console.log('  '+label.padEnd(20)+'migrated '+c.migrated+'  ->  '+JSON.stringify(urls));
  if(c.migrated<19) console.log('*** migration 19 did not run');
  if(urls.includes(SC_OLD)) console.log('*** the dead StatCan URL survived');
  if(urls.length!==1) console.log('*** StatCan ended up with '+urls.length+' entries, expected 1');
  await cx.close();
}

console.log('\n=== a fresh install skips every migration ===');
const ctx2=await b.newContext({...devices['iPhone 14 Pro']});const p2=await ctx2.newPage();
await ctx2.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8083'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>`});});
p2.on('pageerror',e=>errs.push(e.message));
// Nothing stored at all: DEFAULTS carries no `migrated`, so `undefined < n`
// is false everywhere and the shipped list is what shows up.
await p2.goto('http://localhost:8083/index.html');await p2.waitForTimeout(2500);
const c2f=await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
const n2=c2f.feeds.map(f=>f.name);
console.log('  migrated         :',c2f.migrated,'(undefined - migrations never ran)');
console.log('  Yahoo present    :',n2.includes('Yahoo Finance'),'(must be false - not a default)');
console.log('  supplements       :',CALM.filter(n=>n2.includes(n)),'(must be empty - library only)');
if(n2.includes('Yahoo Finance')) console.log('*** a fresh install was given Yahoo Finance');
if(CALM.some(n=>n2.includes(n))) console.log('*** a fresh install was given the supplementary feeds');

console.log('\n=== the library marks what costs money ===');
await page.click('#open-feeds'); await page.waitForTimeout(500);
const lib=await page.evaluate(()=>[...document.querySelectorAll('#library .lib button')]
  .map(b=>({name:b.textContent,pay:b.dataset.pay==='1',on:b.dataset.on==='1'})));
const paid=lib.filter(x=>x.pay).map(x=>x.name);
console.log('  marked paywalled :',paid);
if(!paid.includes('FT Markets')||!paid.includes('WSJ Business')||!paid.includes('Bloomberg Markets'))
  console.log('*** a paywalled feed is not marked in the library');
if(lib.some(x=>x.pay&&x.on)) console.log('*** a paywalled feed is switched on by default');

console.log('\n=== "Add all" leaves the paywalled ones alone ===');
await page.evaluate(()=>{const h=[...document.querySelectorAll('#library .cat')]
  .find(d=>d.textContent.startsWith('Business'));h.querySelector('button').click();});
await page.waitForTimeout(600);
const after=await names();
console.log('  Business feeds now:',after.length);
console.log('  free ones added   :',after.includes('Marketplace'),'(Marketplace, free)');
console.log('  paid ones added   :',after.filter(n=>['FT Markets','WSJ Business','Bloomberg Markets','Financial Post','Economist Finance'].includes(n)));
if(after.some(n=>['FT Markets','WSJ Business','Bloomberg Markets','Financial Post','Economist Finance'].includes(n)))
  console.log('*** "Add all" subscribed the reader to a paywalled feed');
if(!after.includes('Marketplace')) console.log('*** "Add all" did not add the free feeds');
const label=await page.evaluate(()=>[...document.querySelectorAll('#library .cat')]
  .find(d=>d.textContent.startsWith('Business')).querySelector('button').textContent);
console.log('  button now says   :',label,'(all the free ones are in, so: Remove all)');
if(label!=='Remove all') console.log('*** the button did not flip once every free feed was added');

console.log('\n=== a paywalled feed, once chosen, says so in the feed list ===');
await page.evaluate(()=>[...document.querySelectorAll('#library .lib button')]
  .find(b=>b.textContent.startsWith('WSJ Business')).click());
await page.waitForTimeout(600);
const chips=await page.evaluate(()=>[...document.querySelectorAll('#feeds .row')]
  .filter(r=>r.textContent.includes('WSJ Business')).map(r=>[...r.querySelectorAll('.route')].map(s=>s.textContent)));
console.log('  WSJ row chips    :',chips);
if(!chips.some(c=>c.includes('paywall'))) console.log('*** the paywall chip is missing from the feed row');

console.log('\npage errors:',errs.length?errs:'none');
if(errs.length) console.log('***',errs[0]);
await b.close();srv.close();
