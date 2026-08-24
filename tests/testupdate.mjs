// A new build is picked up rather than served from cache
//
// Run with:  node tests/testupdate.mjs
// See tests/README.md.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import os from 'node:os';

const CHROME=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}
  :fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ?{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{};
const SRC=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
// A copy is served, so the test can swap in a new build mid-session.
const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'newsapp-'));
fs.rmSync(WORK,{recursive:true,force:true});
fs.mkdirSync(WORK+'/icons',{recursive:true});
for (const f of ['index.html','sw.js','manifest.webmanifest'])
  fs.copyFileSync(path.join(SRC,f), path.join(WORK,f));
if (process.env.OLD_SW) fs.copyFileSync(process.env.OLD_SW, path.join(WORK,'sw.js'));
for (const f of fs.readdirSync(SRC+'/icons'))
  fs.copyFileSync(SRC+'/icons/'+f, WORK+'/icons/'+f);

const T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'};
// Mimic GitHub Pages: HTML and assets carry a 10 minute max-age.
const srv=http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(WORK,p);
  if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain','Cache-Control':'max-age=600'});
  r.end(fs.readFileSync(f));
});
await new Promise(r=>srv.listen(process.env.PORT||8070,r));

const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:'+(process.env.PORT||8070)))return route.continue();
 return route.abort('failed');});          // no feeds; we only care about the shell

const stamp = () => page.evaluate(()=>{
  const m=document.documentElement.innerHTML.match(/const BUILD = "([^"]+)"/); return m&&m[1];});

await page.goto('http://localhost:'+(process.env.PORT||8070)+'/index.html');
await page.waitForTimeout(2500);
console.log('first load build        :', await stamp());
console.log('service worker active   :', await page.evaluate(()=>!!navigator.serviceWorker.controller));

// --- ship a new build, exactly as a Pages deploy would ---
let html=fs.readFileSync(WORK+'/index.html','utf8');
html=html.replace(/const BUILD = "[^"]+"/,'const BUILD = "9999-NEW-BUILD"');
fs.writeFileSync(WORK+'/index.html',html);
let sw=fs.readFileSync(WORK+'/sw.js','utf8');
sw=sw.replace(/news-shell-v\d+/,'news-shell-v999');
fs.writeFileSync(WORK+'/sw.js',sw);
console.log('\n-- new build deployed, HTML still cacheable for 600s --');

// "kill the app and restart": a fresh page load of the same URL
const page2=await ctx.newPage();
await ctx.route('**/*',route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:'+(process.env.PORT||8070)))return route.continue();
 return route.abort('failed');});
await page2.goto('http://localhost:'+(process.env.PORT||8070)+'/index.html');
await page2.waitForTimeout(3500);
const got=await page2.evaluate(()=>{
  const m=document.documentElement.innerHTML.match(/const BUILD = "([^"]+)"/); return m&&m[1];});
console.log('after restart build     :', got);
console.log(got==='9999-NEW-BUILD' ? 'PASS - picked up the new build'
                                   : 'FAIL - still serving the old build');
await b.close(); srv.close();
