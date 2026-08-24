// RSS, Atom, RDF, JSON Feed, and what a broken feed does
//
// Run with:  node tests/testformats.mjs
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
await new Promise(r=>srv.listen(8067,r));
const NOW=new Date().toUTCString();
const ISO=new Date().toISOString();

const FEEDS = {
 'rss2': `<?xml version="1.0"?><rss version="2.0"><channel><title>c</title>
   <item><title>RSS 2.0 story</title><link>https://e.test/1</link><pubDate>${NOW}</pubDate><description>d</description></item>
   </channel></rss>`,

 'atom': `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>c</title>
   <entry><title>Atom story</title><link rel="alternate" href="https://e.test/2"/><updated>${ISO}</updated><summary>s</summary></entry>
   </feed>`,

 'rss1rdf': `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <channel rdf:about="https://e.test"><title>c</title></channel>
   <item rdf:about="https://e.test/3"><title>RSS 1.0 RDF story</title><link>https://e.test/3</link>
   <dc:date>${ISO}</dc:date><description>d</description></item></rdf:RDF>`,

 'dcdate': `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>c</title>
   <item><title>dc:date only story</title><link>https://e.test/4</link><dc:date>${ISO}</dc:date></item>
   </channel></rss>`,

 'cdata': `<?xml version="1.0"?><rss version="2.0"><channel><title>c</title>
   <item><title><![CDATA[CDATA & <b>markup</b> title]]></title><link>https://e.test/5</link><pubDate>${NOW}</pubDate></item>
   </channel></rss>`,

 'nodate': `<?xml version="1.0"?><rss version="2.0"><channel><title>c</title>
   <item><title>No date at all</title><link>https://e.test/6</link></item></channel></rss>`,

 'jsonfeed': JSON.stringify({version:"https://jsonfeed.org/version/1.1",title:"c",
   items:[{id:"7",url:"https://e.test/7",title:"JSON Feed story",date_published:ISO,
           content_html:"<p>Body <b>with</b> markup</p>"}]}),

 'json10': JSON.stringify({version:"https://jsonfeed.org/version/1",title:"c",
   items:[{id:"8",url:"https://e.test/8",title:"JSON Feed 1.0 story",date_published:ISO}]}),

 // microblog style: no title at all, body only
 'jsonnotitle': JSON.stringify({version:"https://jsonfeed.org/version/1.1",title:"c",
   items:[{id:"9",url:"https://e.test/9",content_text:"A short note with no title field whatsoever",
           date_published:ISO}]}),

 // link post: url is the permalink, external_url is where it points
 'jsonexternal': JSON.stringify({version:"https://jsonfeed.org/version/1.1",title:"c",
   items:[{id:"10",external_url:"https://elsewhere.test/piece",title:"Link post",date_published:ISO}]}),

 // relative url, and a date the parser cannot read
 'jsonrelative': JSON.stringify({version:"https://jsonfeed.org/version/1.1",title:"c",
   items:[{id:"11",url:"/relative/11",title:"Relative JSON story",date_published:"not a date"}]}),

 'jsonbroken': '{"version":"https://jsonfeed.org/version/1.1", "items":[',

 'jsonnotfeed': JSON.stringify({ok:true,data:[1,2,3]}),

 'broken': `<?xml version="1.0"?><rss version="2.0"><channel><title>c</title>
   <item><title>Unclosed tag<link>https://e.test/8</link></item></channel></rss>`,

 'htmlpage': `<!doctype html><html><head><title>Not a feed</title></head><body><h1>hello</h1></body></html>`,

 'relative': `<?xml version="1.0"?><rss version="2.0"><channel><title>c</title>
   <item><title>Relative link story</title><link>/story/9</link><pubDate>${NOW}</pubDate></item></channel></rss>`,
};

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8067'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const d=decodeURIComponent(u);
 const key=Object.keys(FEEDS).find(k=>d.includes('//'+k+'.test'));
 if(!key) return route.abort('failed');
 // deliberately the wrong content type for one case, to show it does not matter
 const ct = key==='jsonfeed' ? 'application/json' : key==='htmlpage' ? 'text/html' : 'application/xml';
 return route.fulfill({status:200,contentType:ct,body:FEEDS[key]});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(f=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:10,
  proxies:['https://api.allorigins.win/raw?url='],idleResetMin:0,
  feeds:JSON.parse(f).map((k,i)=>({id:'id'+i,cat:'World',name:k,url:'https://'+k+'.test/feed'}))})),
  JSON.stringify(Object.keys(FEEDS)));
await page.goto('http://localhost:8067/index.html');await page.waitForTimeout(6000);

const health=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.health')));
const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1.items')));
console.log('format      result');
console.log('----------  ----------------------------------------------');
for (const k of Object.keys(FEEDS)) {
  const h=health['https://'+k+'.test/feed'];
  const mine=items.filter(i=>i.source===k);
  const dated=mine.filter(i=>i.ts>0).length;
  console.log(k.padEnd(11),
    (h&&h.ok ? 'OK  ' : 'FAIL') + '  ' +
    (h&&h.ok ? `${mine.length} story, ${dated} with a usable date` : h ? h.err : 'no result'));
  if (mine.length) console.log(' '.repeat(17)+'title: '+JSON.stringify(mine[0].title)+'  link: '+JSON.stringify(mine[0].link));
}
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
