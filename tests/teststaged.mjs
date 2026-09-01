// Near categories first behind the dimmed screen, the rest in the background
//
// Run with:  node tests/teststaged.mjs
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
await new Promise(r=>srv.listen(8076,r));
const b=await chromium.launch(CHROME);
const ctx=await b.newContext({...devices['iPhone 14 Pro']});const page=await ctx.newPage();
const order=[]; let delay=900;
await ctx.route('**/*',async route=>{const u=route.request().url();
 if(u.startsWith('http://localhost:8076'))return route.continue();
 if(!u.includes('allorigins'))return route.abort('failed');
 const id=(decodeURIComponent(u).match(/url=https:\/\/([^.]+)/)||[])[1]||'f';
 order.push(id);
 await new Promise(r=>setTimeout(r,delay));
 const items=Array.from({length:6},(_,i)=>`<item><title>${id} story ${i}</title><link>https://x/${id}/${i}</link><pubDate>${new Date(Date.now()-i*20*60000).toUTCString()}</pubDate></item>`).join('');
 return route.fulfill({status:200,contentType:'application/xml',
  body:`<?xml version="1.0"?><rss version="2.0"><channel><title>${id}</title>${items}</channel></rss>`});});
const errs=[];page.on('pageerror',e=>errs.push(e.message));
// The "returning from another app" section below is the home-screen-app
// scenario, so it needs to look like one.
await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
// six categories: World (active), Business, Tech, Canada, Science, Sport
await page.addInitScript(()=>localStorage.setItem('breaking.v1',JSON.stringify({migrated:11,idleResetMin:0,
 proxies:['https://api.allorigins.win/raw?url='],feeds:[
 {id:'1',cat:'World',name:'world',url:'https://world.test/f'},
 {id:'2',cat:'Business',name:'biz',url:'https://biz.test/f'},
 {id:'3',cat:'Technology',name:'tech',url:'https://tech.test/f'},
 {id:'4',cat:'Canada',name:'canada',url:'https://canada.test/f'},
 {id:'5',cat:'Science',name:'science',url:'https://science.test/f'},
 {id:'6',cat:'Entertainment',name:'ent',url:'https://ent.test/f'}]})));
const busy=()=>page.evaluate(()=>document.body.classList.contains('busy'));
const status=()=>page.evaluate(()=>document.querySelector('#status').textContent);
await page.goto('http://localhost:8076/index.html');
await page.waitForTimeout(400);
console.log('first pass fetches   :', order.join(', '));
console.log('  busy during it     :', await busy(), '·', await status());
await page.waitForTimeout(800);
console.log('after the near pass  :', await status(), '| busy', await busy());
console.log('  fetches so far     :', order.join(', '));
await page.waitForTimeout(1400);
console.log('after the background :', await status(), '| busy', await busy());
console.log('  all fetches        :', order.join(', '));
console.log('  stories on screen  :', await page.evaluate(()=>document.querySelectorAll('#list .item').length));

console.log('\n--- returning from another app ---');
const hide = async () => page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
  Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
const show = async () => page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
order.length=0;
await hide(); await page.waitForTimeout(300); await show(); await page.waitForTimeout(700);
console.log('back after 0.3s      : fetches', order.length, '| busy', await busy(), '|', await status());
// now pretend the stories are old
await page.evaluate(()=>localStorage.setItem('breaking.v1.fetchedAt', Date.now()-10*60000));
order.length=0;
await hide(); await page.waitForTimeout(200); await show();
await page.waitForTimeout(400);
console.log('back when stale      : fetches', order.length, '| busy', await busy(), '|', await status());
await page.waitForTimeout(1600);
console.log('  once it finishes   :', await status(), '| busy', await busy(), '| fetched', order.length);
console.log('\n'+(errs.length?'ERRORS '+errs.join(';'):'no JS errors'));
await b.close();srv.close();
