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
 // The two destinations a tap can open - fulfilled so the popup actually
 // lands (and its final url can be checked) instead of erroring out.
 if(u==='https://news.ycombinator.com/item?id=1' || u==='https://elsewhere.test/article')
   return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><body>ok</body>'});
 return route.abort('failed');});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:21,idleResetMin:0,
  proxies:[],
  feeds:[{id:'hn',cat:'Tech',name:'Hacker News',url:'https://news.ycombinator.com/rss'},
          {id:'bl',cat:'Tech',name:'Blog',url:'https://blog.test/feed'}]})));
await page.goto('http://localhost:8093/index.html');await page.waitForTimeout(2500);

const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')));
const hn=items.find(i=>i.source==='Hacker News');
const bl=items.find(i=>i.source==='Blog');
const say=(label,got,want)=>console.log('  '+label.padEnd(42)+JSON.stringify(got)
  +(got===want?'  ok':'  *** expected '+JSON.stringify(want)));

console.log('=== parseXmlFeed: HN gets a titleLink, an ordinary feed does not ===');
say('HN row link -> the discussion', hn && hn.link, 'https://news.ycombinator.com/item?id=1');
say('HN titleLink -> the article', hn && hn.titleLink, 'https://elsewhere.test/article');
say('Blog link unaffected', bl && bl.link, 'https://blog.test/post');
say('Blog has no titleLink', bl && bl.titleLink, undefined);

await page.waitForSelector('a.item');

console.log('\n=== on screen: the row opens the discussion, the headline opens the article ===');
const rows = await page.locator('a.item').all();
let hnRow = null;
for (const r of rows) { if ((await r.getAttribute('href')) === 'https://news.ycombinator.com/item?id=1') hnRow = r; }
if (!hnRow) console.log('  *** Hacker News row not found on screen');
else {
  console.log('  row href                                  '+await hnRow.getAttribute('href'));

  const [rowPopup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    hnRow.locator('.meta').click(),
  ]);
  console.log('  tap on the meta line opened               '+(rowPopup ? rowPopup.url() : '(nothing)')
    + (rowPopup && rowPopup.url() === 'https://news.ycombinator.com/item?id=1' ? '  ok' : '  *** expected the discussion'));
  if (rowPopup) await rowPopup.close();

  const [titlePopup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    hnRow.locator('.ttl').click(),
  ]);
  console.log('  tap on the headline opened                '+(titlePopup ? titlePopup.url() : '(nothing)')
    + (titlePopup && titlePopup.url() === 'https://elsewhere.test/article' ? '  ok' : '  *** expected the article'));
  if (titlePopup) await titlePopup.close();
}

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
