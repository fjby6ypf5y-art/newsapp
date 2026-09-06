// Hacker News: the row opens the discussion, the headline opens the article
//
// Run with:  node tests/testhn.mjs
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
await new Promise(r=>srv.listen(8093,r));
const NOW=new Date().toUTCString();

const HN = `<?xml version="1.0"?><rss version="2.0"><channel><title>Hacker News</title>
  <item><title>An Article Worth Reading</title><link>https://elsewhere.test/article</link>
  <comments>https://news.ycombinator.com/item?id=1</comments><pubDate>${NOW}</pubDate></item>
  </channel></rss>`;

// hnrss.org mirrors Hacker News rather than being its own publication, so its
// <comments> gets the same treatment as the official feed's - a separate,
// opt-in "HN Active Threads" catalogue entry, not a replacement for it.
const HNRSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>HN Active Threads</title>
  <item><title>A Busy Thread</title><link>https://elsewhere.test/thread-article</link>
  <comments>https://news.ycombinator.com/item?id=2</comments><pubDate>${NOW}</pubDate></item>
  </channel></rss>`;

// An ordinary feed's <comments> tag is its own comment thread, not a second
// link worth surfacing - the row and the headline stay the one link.
const BLOG = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>
  <item><title>A Blog Post</title><link>https://blog.test/post</link>
  <comments>https://blog.test/post#comments</comments><pubDate>${NOW}</pubDate></item>
  </channel></rss>`;

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8093'))return route.continue();
 if(u.startsWith('https://news.ycombinator.com/rss'))
   return route.fulfill({status:200,contentType:'application/xml',body:HN});
 if(u.startsWith('https://blog.test/feed'))
   return route.fulfill({status:200,contentType:'application/xml',body:BLOG});
 if(u.startsWith('https://hnrss.org/active'))
   return route.fulfill({status:200,contentType:'application/xml',body:HNRSS});
 // The destinations a tap can open - fulfilled so the popup actually lands
 // (and its final url can be checked) instead of erroring out.
 if(['https://news.ycombinator.com/item?id=1','https://news.ycombinator.com/item?id=2',
     'https://elsewhere.test/article','https://elsewhere.test/thread-article'].includes(u))
   return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>ok</body>'});
 return route.abort('failed');});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:21,idleResetMin:0,
  proxies:[],
  feeds:[{id:'hn',cat:'Tech',name:'Hacker News',url:'https://news.ycombinator.com/rss'},
          {id:'bl',cat:'Tech',name:'Blog',url:'https://blog.test/feed'},
          {id:'hr',cat:'Tech',name:'HN Active Threads',url:'https://hnrss.org/active'}]})));
await page.goto('http://localhost:8093/index.html');await page.waitForTimeout(2500);

const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')));
const hn=items.find(i=>i.source==='Hacker News');
const bl=items.find(i=>i.source==='Blog');
const hr=items.find(i=>i.source==='HN Active Threads');
const say=(label,got,want)=>console.log('  '+label.padEnd(42)+JSON.stringify(got)
  +(got===want?'  ok':'  *** expected '+JSON.stringify(want)));

console.log('=== parseXmlFeed: HN and hnrss.org both get a titleLink, an ordinary feed does not ===');
say('HN row link -> the discussion', hn && hn.link, 'https://news.ycombinator.com/item?id=1');
say('HN titleLink -> the article', hn && hn.titleLink, 'https://elsewhere.test/article');
say('hnrss row link -> the discussion', hr && hr.link, 'https://news.ycombinator.com/item?id=2');
say('hnrss titleLink -> the article', hr && hr.titleLink, 'https://elsewhere.test/thread-article');
say('Blog link unaffected', bl && bl.link, 'https://blog.test/post');
say('Blog has no titleLink', bl && bl.titleLink, undefined);

await page.waitForSelector('.item');

console.log('\n=== on screen: two real anchors, not a click trick ===');
// A click intercept can fake the click, but not what a hover or a long-press
// preview reads - only a real href on each anchor gets those right too. So
// this checks the actual href attributes, not just what clicking does.
const rows = await page.locator('.item').all();
let hnRow = null;
for (const r of rows) { if ((await r.locator('.cardlink').getAttribute('href')) === 'https://news.ycombinator.com/item?id=1') hnRow = r; }
if (!hnRow) console.log('  *** Hacker News row not found on screen');
else {
  say('cardlink href (covers the row)', await hnRow.locator('.cardlink').getAttribute('href'),
    'https://news.ycombinator.com/item?id=1');
  say('headline\'s own href', await hnRow.locator('.ttl a').getAttribute('href'),
    'https://elsewhere.test/article');

  // .meta itself has no anchor of its own - a real tap there hits the
  // cardlink stretched underneath it, which is exactly the point, but
  // Playwright's actionability check refuses to click a covered element
  // even when the cover is the intended target, hence force:true here.
  const [rowPopup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    hnRow.locator('.meta').click({ force: true }),
  ]);
  console.log('  tap on the meta line opened               '+(rowPopup ? rowPopup.url() : '(nothing)')
    + (rowPopup && rowPopup.url() === 'https://news.ycombinator.com/item?id=1' ? '  ok' : '  *** expected the discussion'));
  if (rowPopup) await rowPopup.close();

  const [titlePopup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    hnRow.locator('.ttl a').click(),
  ]);
  console.log('  tap on the headline opened                '+(titlePopup ? titlePopup.url() : '(nothing)')
    + (titlePopup && titlePopup.url() === 'https://elsewhere.test/article' ? '  ok' : '  *** expected the article'));
  if (titlePopup) await titlePopup.close();
}

console.log('\n=== an ordinary feed still behaves as one link ===');
let blRow = null;
for (const r of rows) { if ((await r.locator('.cardlink').getAttribute('href')) === 'https://blog.test/post') blRow = r; }
if (!blRow) console.log('  *** Blog row not found on screen');
else say('headline href same as the row\'s', await blRow.locator('.ttl a').getAttribute('href'), 'https://blog.test/post');

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
