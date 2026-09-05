// Source switches and the keyword filter
//
// Asks: does switching a source off take its stories out of the category (and
// out of the parked panel either side of it), does it survive a reload, does
// the keyword wait for a submit, and is it gone the moment you leave the tab?
//
// Run with:  node tests/testfilter.mjs
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
await new Promise(r=>srv.listen(8073,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();

// Three feeds in World, one in Tech. Each serves titles that make the source
// obvious, plus one shared word ("budget") for the keyword to find.
const STORIES={
  a:['Alpha budget vote','Alpha flood warning','Alpha election night'],
  b:['Bravo budget leak','Bravo storm damage'],
  c:['Charlie ferry delay'],
  t:['Tango chip budget','Tango phone launch'],
  // Same source name as b, on a different URL: what a feed added twice under
  // two addresses looks like. It is one source to the reader, so one switch.
  d:['Bravo late edition']
};
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8073'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'a';
 const items=(STORIES[id]||[]).map((t,i)=>`<item><title>${t}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
// Seed once: the reload below is checking what the app kept, not what
// the test put back.
await page.addInitScript(()=>localStorage.getItem('breaking.v1')||localStorage.setItem('breaking.v1',JSON.stringify({migrated:18,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{id:'1',cat:'World',name:'Alpha',url:'https://a.test/f'},
        {id:'2',cat:'World',name:'Bravo',url:'https://b.test/f'},
        {id:'3',cat:'World',name:'Charlie',url:'https://c.test/f'},
        {id:'4',cat:'Tech', name:'Tango',url:'https://t.test/f'},
        {id:'5',cat:'World',name:'Bravo',url:'https://d.test/f'}]})));
await page.goto('http://localhost:8073/index.html');await page.waitForTimeout(2500);

const shown=()=>page.evaluate(()=>[...document.querySelectorAll('#list .item .ttl')].map(n=>n.textContent));
const parked=()=>page.evaluate(()=>[...document.querySelectorAll('.panel[aria-hidden] .ttl')].map(n=>n.textContent));
const say=(label,v)=>console.log(label.padEnd(26),JSON.stringify(v));
const want=(label,got,exp)=>console.log(label.padEnd(26),
  JSON.stringify(got)+(JSON.stringify(got)===JSON.stringify(exp)?'  ok':'  *** expected '+JSON.stringify(exp)));

console.log('--- the bar is folded away until asked for ---');
say('filters hidden', await page.evaluate(()=>document.querySelector('#filters').hidden));
await page.click('#open-filter'); await page.waitForTimeout(200);
say('after tapping filter', await page.evaluate(()=>document.querySelector('#filters').hidden));
// Five World feeds, but only three names: two of them are both called Bravo.
want('one switch per name', await page.evaluate(()=>[...document.querySelectorAll('#srcs button')]
  .map(b=>b.textContent)), ['Alpha','Bravo','Charlie']);

console.log('\n--- switching a source off ---');
say('before', await shown());
await page.evaluate(()=>[...document.querySelectorAll('#srcs button')].find(b=>b.textContent==='Alpha').click());
await page.waitForTimeout(400);
const after=await shown();
want('no Alpha stories left', after.filter(t=>t.startsWith('Alpha')), []);
say('still showing', after);
say('header button lit', await page.evaluate(()=>document.querySelector('#open-filter').classList.contains('on')));

console.log('\n--- one switch covers every feed with that name ---');
await page.evaluate(()=>[...document.querySelectorAll('#srcs button')].find(b=>b.textContent==='Bravo').click());
await page.waitForTimeout(400);
want('both Bravo feeds off', (await shown()).filter(t=>t.startsWith('Bravo')), []);
await page.evaluate(()=>[...document.querySelectorAll('#srcs button')].find(b=>b.textContent==='Bravo').click());
await page.waitForTimeout(400);
want('and both back on', (await shown()).filter(t=>t.startsWith('Bravo')).length, 3);

console.log('\n--- closing the bar by hand keeps it closed, even after leaving and returning ---');
// Alpha is still off from above, so World's filter is on and the bar - opened
// at the very top of this test - is still showing. Fold it by hand, leave
// for Tech, come back: it must still be folded. The button itself staying
// lit is not the bug (see "header button lit" above; a filter left on is
// meant to keep saying so) - only the bar reopening on its own is.
await page.click('#open-filter'); await page.waitForTimeout(200);
say('closed by hand', await page.evaluate(()=>document.querySelector('#filters').hidden));
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Tech').click());
await page.waitForTimeout(300);
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='World').click());
await page.waitForTimeout(300);
want('still closed back on World', await page.evaluate(()=>document.querySelector('#filters').hidden), true);
say('button still lit (Alpha still off)', await page.evaluate(()=>document.querySelector('#open-filter').classList.contains('on')));
await page.click('#open-filter'); await page.waitForTimeout(200);
want('reopens by hand', await page.evaluate(()=>document.querySelector('#filters').hidden), false);

console.log('\n--- and it survives a reload ---');
await page.reload(); await page.waitForTimeout(2500);
const back=await shown();
want('Alpha still off', back.filter(t=>t.startsWith('Alpha')), []);
say('bar unfolds itself', await page.evaluate(()=>!document.querySelector('#filters').hidden));
await page.evaluate(()=>[...document.querySelectorAll('#srcs button')].find(b=>b.textContent==='Alpha').click());
await page.waitForTimeout(400);
want('switched back on', (await shown()).filter(t=>t.startsWith('Alpha')).length>0, true);

console.log('\n--- one button hides or shows every source in the category ---');
say('label with everything on', await page.evaluate(()=>document.querySelector('#srcs-all').textContent));
await page.click('#srcs-all'); await page.waitForTimeout(400);
want('every World story gone', (await shown()).length, 0);
want('every switch off', await page.evaluate(()=>[...document.querySelectorAll('#srcs button')]
  .every(b=>b.getAttribute('aria-pressed')==='false')), true);
say('label flips to Show all', await page.evaluate(()=>document.querySelector('#srcs-all').textContent));
await page.click('#srcs-all'); await page.waitForTimeout(400);
want('every World story back', (await shown()).length, 7);
want('every switch back on', await page.evaluate(()=>[...document.querySelectorAll('#srcs button')]
  .every(b=>b.getAttribute('aria-pressed')==='true')), true);

console.log('\n--- the keyword waits for the submit ---');
await page.fill('#kw','budget'); await page.waitForTimeout(400);
say('typed, not submitted', (await shown()).length);
await page.press('#kw','Enter'); await page.waitForTimeout(400);
const hits=await shown();
want('only budget stories', hits, ['Alpha budget vote','Bravo budget leak']);

console.log('\n--- a keyword with no hits explains itself ---');
await page.fill('#kw','zzz'); await page.press('#kw','Enter'); await page.waitForTimeout(400);
say('empty state', await page.evaluate(()=>document.querySelector('#list .empty').textContent.trim().slice(0,80)));
await page.evaluate(()=>document.querySelector('#list .empty .btn').click());
await page.waitForTimeout(400);
want('Clear filters brings them back', (await shown()).length, 7);

console.log('\n--- and it does not follow you to the next tab ---');
await page.fill('#kw','budget'); await page.press('#kw','Enter'); await page.waitForTimeout(400);
say('World, filtered', await shown());
say('parked panels untouched', (await parked()).length);
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Tech').click());
await page.waitForTimeout(600);
want('Tech is whole', await shown(), ['Tango chip budget','Tango phone launch']);
want('box is empty again', await page.inputValue('#kw'), '');

console.log('\n--- the feeds page says how old each feed\'s newest story is ---');
await page.click('#open-feeds'); await page.waitForTimeout(600);
const ages=await page.evaluate(()=>[...document.querySelectorAll('#feeds .row')]
  .map(r=>[r.querySelector('.n span').textContent,(r.querySelector('.route.age')||{}).textContent]));
say('newest per feed', ages);
want('every working feed dated', ages.every(([,a])=>a&&/newest/.test(a)), true);

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
