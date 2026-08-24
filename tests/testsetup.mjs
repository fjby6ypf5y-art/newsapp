// The setup link restores feeds, and refuses a corrupt one
//
// Run with:  node tests/testsetup.mjs
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
await new Promise(r=>srv.listen(8061,r));
const b=await chromium.launch(CHROME);

const route = ctx => ctx.route('**/*',r=>{const u=r.request().url();
 if(u.startsWith('http://localhost:8061'))return r.continue();
 if(!u.includes('allorigins'))return r.abort('failed');
 const d=decodeURIComponent(u),h=(d.match(/url=https:\/\/([^\/]+)/)||[])[1]||'f';
 const id=h.replace(/[^a-z0-9]/gi,'').slice(0,12);
 return r.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title><item><title>${id} story</title><link>https://x/${id}</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`});});

// A configured device: 16 feeds across categories, non-default settings
const FEEDS=[];
const CATS=['World','Business','Tech','Canada','Science','Entertainment'];
for (let i=0;i<16;i++) FEEDS.push({id:'i'+i,cat:CATS[i%CATS.length],
  name:'Publisher Name '+i, url:'https://publisher'+i+'.example.com/feeds/all.xml'});

const ctx1=await b.newContext({...devices['iPhone 14 Pro'],permissions:['clipboard-read','clipboard-write']});
await route(ctx1);
const page=await ctx1.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(f=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:10,
  idleResetMin:120, directOnly:true, groupDupes:false, autoRefresh:false,
  proxies:['https://api.allorigins.win/raw?url='], feeds:JSON.parse(f)})),JSON.stringify(FEEDS));
await page.goto('http://localhost:8061/index.html');await page.waitForTimeout(2500);
await page.click('#open-settings');await page.waitForTimeout(400);
await page.click('#link-copy');await page.waitForTimeout(400);
const link=await page.evaluate(()=>document.querySelector('#io').value);
console.log('setup link length      :', link.length, 'characters', link.length<8000?'(fits a URL comfortably)':'*** LONG ***');
console.log('message                :', await page.evaluate(()=>document.querySelector('#link-msg').textContent));
await ctx1.close();

// --- a wiped device opens the link ----------------------------------------
const ctx2=await b.newContext({...devices['iPhone 14 Pro']});
await route(ctx2);
const p2=await ctx2.newPage();
p2.on('pageerror',e=>errs.push(e.message));
await p2.goto(link);
await p2.waitForSelector('.restore',{timeout:10000});
console.log('\n--- fresh device, link opened ---');
console.log('banner shown           :', await p2.evaluate(()=>{const r=document.querySelector('.restore');return r?r.textContent.slice(0,52):'(none)'}));
console.log('feeds before restoring :', await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.length), '(the defaults)');
console.log('hash cleared from URL  :', await p2.evaluate(()=>location.hash===''));
await p2.evaluate(()=>[...document.querySelectorAll('.restore .btn')].find(b=>b.textContent==='Restore').click());
await p2.waitForTimeout(2500);
const after=await p2.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')));
console.log('feeds after restoring  :', after.feeds.length);
console.log('names/categories kept  :', after.feeds.slice(0,2).map(f=>f.cat+'/'+f.name).join(' | '));
console.log('settings kept          :', 'idle='+after.idleResetMin, 'directOnly='+after.directOnly,
            'groupDupes='+after.groupDupes, 'autoRefresh='+after.autoRefresh);
console.log('banner gone            :', await p2.evaluate(()=>!document.querySelector('.restore')));
console.log('chips rebuilt          :', await p2.evaluate(()=>[...document.querySelectorAll('.chip')].map(c=>c.textContent).join(' | ')));

// --- ignoring the link leaves the device alone ----------------------------
const ctx3=await b.newContext({...devices['iPhone 14 Pro']});
await route(ctx3);
const p3=await ctx3.newPage();
await p3.goto(link); await p3.waitForSelector('.restore',{timeout:10000});
const before=await p3.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.length);
await p3.evaluate(()=>[...document.querySelectorAll('.restore .btn')].find(b=>b.textContent==='Ignore').click());
await p3.waitForTimeout(500);
console.log('\nIgnore -> feeds unchanged:', await p3.evaluate(()=>JSON.parse(localStorage.getItem('breaking.v1')).feeds.length), '(was '+before+')');

// --- a corrupt link must not break the app --------------------------------
const ctx4=await b.newContext({...devices['iPhone 14 Pro']});
await route(ctx4);
const p4=await ctx4.newPage();
p4.on('pageerror',e=>errs.push('CORRUPT: '+e.message));
await p4.goto('http://localhost:8061/index.html#s=not-valid-base64!!');
await p4.waitForTimeout(2500);
console.log('corrupt link -> banner  :', await p4.evaluate(()=>!!document.querySelector('.restore')), '(false = ignored)');
console.log('corrupt link -> app runs:', await p4.evaluate(()=>document.querySelectorAll('.chip').length>0));
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
