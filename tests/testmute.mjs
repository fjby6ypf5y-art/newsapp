// Muted words
//
// Asks: does a word in Settings take its stories out of every category -
// including the parked panels either side - matching whole words in any case
// and any script, but not the inside of another word? Does it survive a
// reload, keep "N new" honest, explain a category it has emptied, and travel
// in the setup link without being slipped in unannounced?
//
// Run with:  node tests/testmute.mjs
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
await new Promise(r=>srv.listen(8094,r));
const b=await chromium.launch(CHROME);

// [title, description]. Each title is unique, so a title names its story.
const STORIES={
  a:[['AI rules agreed in Brussels',''],
     ['Minister said talks will resume',''],          // "ai" inside "said"
     ['Taiwan strait patrol',''],                     // "ai" inside "Taiwan"
     ['Markets slide on cryptocurrency rout',''],     // crypto*
     ['Election night results','Turnout fell as AI-generated ads spread.'], // snippet
     ['Expos reunion game',''],
     ['Newspaper exposé wins award',''],              // "expos" then a non-ASCII letter
     ['Festival d’été opens','']],               // a word that is all non-ASCII at the edge
  t:[['AI chip launch',''],['Phone review','']],
  c:[['Ferry delay','']]
};
let extra=false;   // a second refresh brings one muted and one unmuted story
const route=ctx=>ctx.route('**/*',r=>{const u=r.request().url();
 if(u.startsWith('http://localhost:8094'))return r.continue();
 if(!u.includes('allorigins'))return r.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'a';
 const list=[...(STORIES[id]||[]), ...(extra&&id==='a'?[['AI summit opens',''],['Harbour reopens','']]:[])];
 const items=list.map(([t,d],i)=>`<item><title>${t}</title><description>${d}</description><link>https://x/${id}/${encodeURIComponent(t)}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return r.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});

const ctx=await b.newContext({...devices['iPhone 14 Pro'],permissions:['clipboard-read','clipboard-write']});
await route(ctx);
const page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>localStorage.getItem('breaking.v1')||localStorage.setItem('breaking.v1',JSON.stringify({migrated:21,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],
 feeds:[{id:'1',cat:'World', name:'Alpha',  url:'https://a.test/f'},
        {id:'2',cat:'Tech',  name:'Tango',  url:'https://t.test/f'},
        {id:'3',cat:'Canada',name:'Charlie',url:'https://c.test/f'}]})));
await page.goto('http://localhost:8094/index.html');await page.waitForTimeout(2500);

const shown=()=>page.evaluate(()=>[...document.querySelectorAll('#list .item .ttl')].map(n=>n.textContent));
const parked=()=>page.evaluate(()=>[...document.querySelectorAll('.panel[aria-hidden] .ttl')].map(n=>n.textContent));
const cfg=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
const msg=()=>page.evaluate(()=>document.querySelector('#mute-msg').textContent);
const say=(label,v)=>console.log(label.padEnd(30),JSON.stringify(v));
const want=(label,got,exp)=>console.log(label.padEnd(30),
  JSON.stringify(got)+(JSON.stringify(got)===JSON.stringify(exp)?'  ok':'  *** expected '+JSON.stringify(exp)));
// Leaves the sheet the way a thumb on the X does: no blur, so no change event.
const closeSettings=()=>page.evaluate(()=>document.querySelector('#close-settings').click());

console.log('--- nothing muted ---');
want('World, everything', (await shown()).length, 8);
await page.click('#open-settings'); await page.waitForTimeout(300);
want('settings says', await msg(), 'Nothing muted.');

console.log('\n--- muting, saved by closing the sheet with the box still focused ---');
await page.fill('#mute','ai\ncrypto*, expos\nété');
// The parked panels rebuild a quarter-second after things go quiet, one per
// pass, so the second one needs a moment longer than the list on screen.
await closeSettings(); await page.waitForTimeout(1200);
want('commas split too', (await cfg()).muted, ['ai','crypto*','expos','été']);
want('World', await shown(), ['Minister said talks will resume','Taiwan strait patrol','Newspaper exposé wins award']);
want('Tech, parked beside it', (await parked()).filter(t=>t.startsWith('AI') || t.startsWith('Phone')), ['Phone review']);
want('funnel not lit', await page.evaluate(()=>document.querySelector('#open-filter').classList.contains('on')), false);

console.log('\n--- what Settings shows on the way back in ---');
await page.click('#open-settings'); await page.waitForTimeout(300);
want('one per line', await page.inputValue('#mute'), 'ai\ncrypto*\nexpos\nété');
want('count', await msg(), 'Hiding 6 stories right now.');
await closeSettings(); await page.waitForTimeout(300);

console.log('\n--- "N new" leaves muted stories out ---');
extra=true;
await page.click('#refresh'); await page.waitForTimeout(2500);
const st=await page.evaluate(()=>document.querySelector('#status').textContent);
want('new in status', (st.match(/(\d+) new/)||[])[0], '1 new');
want('only the unmuted one shows', (await shown()).filter(t=>/summit|Harbour/.test(t)), ['Harbour reopens']);

console.log('\n--- it survives a reload ---');
await page.reload(); await page.waitForTimeout(2500);
want('World after reload', (await shown()).filter(t=>/^AI|crypto|Expos /.test(t)), []);

console.log('\n--- a category emptied by a muted word says so ---');
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.fill('#mute','ai\nferry');
await page.evaluate(()=>document.querySelector('#mute').blur());   // the change event path
await page.waitForTimeout(300);
// AI rules, Election night (its snippet), AI summit, AI chip launch, Ferry delay.
want('saved on blur', await msg(), 'Hiding 5 stories right now. · saved');
await closeSettings(); await page.waitForTimeout(300);
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Canada').click());
await page.waitForTimeout(500);
want('Canada empty state', await page.evaluate(()=>document.querySelector('#list .empty').textContent),
  'Every Canada story matches a muted word.Muted words are in Settings.');

console.log('\n--- taking the words out brings everything back ---');
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.fill('#mute','');
await closeSettings(); await page.waitForTimeout(400);
want('Canada back', await shown(), ['Ferry delay']);
await page.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='World').click());
await page.waitForTimeout(500);
want('World back', (await shown()).length, 10);

console.log('\n--- quotes around a phrase are dropped, and either apostrophe matches ---');
// What was typed on the phone: phrases in quotes, straight and curly, which
// used to become part of the phrase and match nothing. The last one is typed
// with a straight apostrophe against a headline that curls it.
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.fill('#mute','"minister said"\n“Taiwan strait”\nfestival d\'été');
await closeSettings(); await page.waitForTimeout(400);
want('stored without quotes', (await cfg()).muted, ['minister said','Taiwan strait','festival d\'été']);
want('all three muted', (await shown()).filter(t=>/Minister|Taiwan|Festival/.test(t)), []);
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.fill('#mute','');
await closeSettings(); await page.waitForTimeout(400);

console.log('\n--- a JSON import with the sheet open is not overwritten on the way out ---');
// Quoted, the way a list saved by build 102 can be: the same normalise that
// runs on every launch has to clean it.
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('breaking.v1'));c.muted=['"phone"'];
  document.querySelector('#io').value=JSON.stringify(c);document.querySelector('#io-import').click();});
await page.waitForTimeout(300);
await closeSettings(); await page.waitForTimeout(300);
want('kept the imported list', (await cfg()).muted, ['phone']);
want('box shows it', await page.inputValue('#mute'), 'phone');

console.log('\n--- and a malformed one does not break anything ---');
await page.click('#open-settings'); await page.waitForTimeout(300);
await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('breaking.v1'));c.muted='phone';
  document.querySelector('#io').value=JSON.stringify(c);document.querySelector('#io-import').click();});
await page.waitForTimeout(300);
want('not a list -> nothing muted', (await cfg()).muted, []);
await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('breaking.v1'));c.muted=['phone'];
  document.querySelector('#io').value=JSON.stringify(c);document.querySelector('#io-import').click();});
await page.waitForTimeout(300);

console.log('\n--- the setup link carries the list, and says so before restoring ---');
await page.click('#link-copy'); await page.waitForTimeout(300);
const link=await page.inputValue('#io');
const ctx2=await b.newContext({...devices['iPhone 14 Pro']});
await route(ctx2);
const p2=await ctx2.newPage(); p2.on('pageerror',e=>errs.push(e.message));
await p2.goto(link); await p2.waitForSelector('.restore',{timeout:10000});
want('offer names it', await p2.evaluate(()=>[...document.querySelectorAll('.restore div')]
  .map(d=>d.textContent).find(t=>t.startsWith('And mutes'))), 'And mutes: phone');
await p2.evaluate(()=>[...document.querySelectorAll('.restore .btn')].find(b=>b.textContent==='Restore').click());
await p2.waitForTimeout(2500);
want('restored', JSON.parse(await p2.evaluate(()=>localStorage.getItem('breaking.v1'))).muted, ['phone']);
await p2.evaluate(()=>[...document.querySelectorAll('.chip')].find(c=>c.textContent==='Tech').click());
await p2.waitForTimeout(500);
want('and applied', await p2.evaluate(()=>[...document.querySelectorAll('#list .item .ttl')].map(n=>n.textContent)), ['AI chip launch']);

console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
