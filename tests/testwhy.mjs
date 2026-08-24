// Traces every refresh call and what asked for it, on the real default feed list
//
// Run with:  node tests/testwhy.mjs
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
await new Promise(r=>srv.listen(8080,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8080'))return route.continue();
 if(!u.includes('allorigins')&&!u.includes('http'))return route.abort('failed');
 const d=decodeURIComponent(u); const h=(d.match(/https?:\/\/([^\/]+)/g)||[]).pop()||'x';
 const items=`<item><title>${h} story</title><link>https://x/1</link><pubDate>${new Date().toUTCString()}</pubDate></item>`;
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${h}</title>${items}</channel></rss>`});});
page.on('console',m=>{const t=m.text(); if(t.startsWith('REFRESH')) console.log('   '+t);});
// real default feed set: no seeded config at all
await page.addInitScript(()=>{
  window.addEventListener('DOMContentLoaded',()=>{},{once:true});
  const patch=()=>{
    if(!window.refresh||window.__patched) return setTimeout(patch,10);
    window.__patched=true;
    const orig=window.refresh;
    window.refresh=function(scope,opts){
      const n=Array.isArray(scope)?scope.length:'ALL';
      const where=(new Error().stack||'').split('\n').slice(2,4).map(s=>s.trim().replace(/https?:\/\/[^ )]+/,'')).join(' <- ');
      console.log('REFRESH '+n+' feeds '+(opts&&opts.quiet?'(quiet)':'(HOLDS SCREEN)')+'  from: '+where);
      return orig.apply(this,arguments);};};
  patch();
});
await page.goto('http://localhost:8080/index.html');
console.log('cold start:');
await page.waitForTimeout(4000);
console.log('   feeds configured:', await page.evaluate(()=>cfg.feeds.length), '| build', await page.evaluate(()=>BUILD));
console.log('\nopen Feeds, touch nothing, close:');
await page.click('#open-feeds'); await page.waitForTimeout(800);
await page.click('#close-feeds'); await page.waitForTimeout(2500);
console.log('   (nothing above = nothing fetched)');
console.log('\nopen Feeds, Test all feeds, close:');
await page.click('#open-feeds'); await page.waitForTimeout(400);
await page.click('#f-test'); await page.waitForTimeout(3000);
await page.click('#close-feeds'); await page.waitForTimeout(2500);
console.log('\nopen Settings, close:');
await page.click('#open-settings'); await page.waitForTimeout(500);
await page.click('#close-settings'); await page.waitForTimeout(2000);
console.log('\nleave the app and come back after a moment:');
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));});
await page.waitForTimeout(600);
await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));});
await page.waitForTimeout(2500);
console.log('\nopen Feeds *while the app is still loading*, then close:');
await page.evaluate(()=>localStorage.setItem('breaking.v1.fetchedAt','0'));
await page.reload();
await page.waitForTimeout(250);
await page.click('#open-feeds'); await page.waitForTimeout(600);
await page.click('#close-feeds'); await page.waitForTimeout(3000);
await b.close();srv.close();
