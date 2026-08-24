// Finding a feed from an ordinary page address
//
// Run with:  node tests/testdiscover.mjs
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
await new Promise(r=>srv.listen(8062,r));
const NOW=new Date().toUTCString();
const RSS = t => `<?xml version="1.0"?><rss version="2.0"><channel><title>${t}</title>
  <item><title>${t} story</title><link>https://x.test/1</link><pubDate>${NOW}</pubDate></item></channel></rss>`;

// paper.test  -> homepage advertising its feed at /feeds/all.xml
// bare.test    -> homepage with no <link>, but /feed works (guess path)
// nothing.test -> homepage with no feed anywhere
const ROUTES = {
 'https://paper.test/':              ['text/html', `<!doctype html><html><head><title>Paper</title>
    <link rel="alternate" type="application/rss+xml" title="Paper — World" href="/feeds/all.xml">
    </head><body>hi</body></html>`],
 'https://paper.test/feeds/all.xml': ['application/xml', RSS('The Daily Paper')],
 'https://bare.test/':               ['text/html', '<!doctype html><html><head><title>Bare</title></head><body>hi</body></html>'],
 'https://bare.test/feed':           ['application/xml', RSS('Bare Blog')],
 'https://nothing.test/':            ['text/html', '<!doctype html><html><head><title>Nope</title></head><body>hi</body></html>'],
 'https://direct.test/rss.xml':      ['application/xml', RSS('Direct Feed')],
};

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8062'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const d=decodeURIComponent(u);
 let target=(d.match(/url=(https:\/\/.*)$/)||[])[1]||'';
 // real servers serve https://host and https://host/ alike
 const hit=ROUTES[target] || ROUTES[target+'/'] || ROUTES[target.replace(/\/$/,'')];
 if(!hit) return route.fulfill({status:404,contentType:'text/plain',body:'not found'});
 return route.fulfill({status:200,contentType:hit[0],body:hit[1]});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:10,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[]})));
await page.goto('http://localhost:8062/index.html');await page.waitForTimeout(1500);
await page.click('#open-feeds');await page.waitForTimeout(400);

const add = async (what) => {
  await page.fill('#f-url', what);
  await page.fill('#f-name', '');
  await page.click('#f-add');
  await page.waitForFunction(()=>!document.querySelector('#f-add').disabled,{timeout:20000});
  await page.waitForTimeout(200);
  const msg=await page.evaluate(()=>document.querySelector('#f-add-msg').textContent);
  console.log(('  ' + what).padEnd(32), '->', msg);
};

console.log('=== add by URL, with discovery ===');
await add('paper.test');            // bare domain, feed advertised
await add('https://bare.test');     // no link tag, conventional path
await add('direct.test/rss.xml');   // an exact feed URL
await add('nothing.test');          // no feed at all
await add('paper.test');            // duplicate

console.log('\n  feeds now:',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.map(f=>f.name+' -> '+f.url)));

console.log('\n=== OPML round trip ===');
await page.click('#close-feeds');await page.waitForTimeout(2000);
await page.click('#open-settings');await page.waitForTimeout(400);
await page.click('#opml-export');await page.waitForTimeout(200);
const opml=await page.evaluate(()=>document.querySelector('#io').value);
console.log(opml.split('\n').slice(0,9).map(l=>'  '+l).join('\n'));
// wipe feeds, then import the OPML back
await page.evaluate(()=>{cfg.feeds=[];save();renderFeeds();render()});
await page.click('#opml-import');await page.waitForTimeout(500);
console.log('  after import:',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.map(f=>f.cat+'/'+f.name)));
// importing again must not duplicate
await page.click('#opml-import');await page.waitForTimeout(500);
console.log('  import twice:',await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.length),'feeds');
console.log('  status      :',await page.evaluate(()=>document.querySelector('#status').textContent));
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
