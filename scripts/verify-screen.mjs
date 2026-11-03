import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {analyze,capture} from '../site/screen/geometry.js';
import worker from '../dist/_worker.js';
import {serve} from './local-server.mjs';
const checks=[];
const fixture={
 screen:{width:1920,height:1080,availWidth:1920,availHeight:1040,availLeft:0,availTop:0,left:0,top:0,colorDepth:24,pixelDepth:24},
 window:{screenX:120,screenY:60,outerWidth:1440,outerHeight:900,innerWidth:1424,innerHeight:800,devicePixelRatio:2,scrollX:0,scrollY:0},
 document:{clientWidth:1409,clientHeight:800,scrollWidth:1409,scrollHeight:2200,fullscreen:false},
 visualViewport:{status:'available',width:1409,height:800,offsetLeft:0,offsetTop:0,pageLeft:0,pageTop:0,scale:1},errors:{}
};
let model=analyze(fixture);
assert.equal(model.drawable,true);
assert.equal(model.differences.find(d=>d.id==='ui-height').delta,100);
assert.equal(model.differences.find(d=>d.id==='reserved-height').delta,40);
assert.equal(model.differences.find(d=>d.id==='scrollbar-width').delta,15);
assert.equal(model.rects.find(r=>r.id==='page').x,128);
assert.equal(model.rects.find(r=>r.id==='page').y,160);
assert.equal(model.visualDifferent,true);
assert.deepEqual(model.windowMargins,{left:120,top:60,right:360,bottom:120});
const equal=structuredClone(fixture);
Object.assign(equal.screen,{width:1280,height:720,availWidth:1280,availHeight:720});
Object.assign(equal.window,{screenX:0,screenY:0,outerWidth:1280,outerHeight:720,innerWidth:1280,innerHeight:720});
Object.assign(equal.document,{clientWidth:1280,clientHeight:720});
Object.assign(equal.visualViewport,{width:1280,height:720});
model=analyze(equal);assert(model.allEqual);assert(!model.visualDifferent);assert.equal(model.differences.length,0);
const overflow=structuredClone(fixture);overflow.window.innerHeight=1000;overflow.window.screenX=-200;
model=analyze(overflow);assert(model.drawable);assert(model.issues.length);assert.equal(model.rects.find(r=>r.id==='window').x,-200);assert.equal(model.differences.find(d=>d.id==='ui-height').delta,-100);
const zero=structuredClone(equal);zero.screen.width=0;assert.equal(analyze(zero).drawable,false);
const unknown=structuredClone(equal);unknown.screen.left=null;unknown.screen.top=null;assert(analyze(unknown).origin.assumed);
const zoom=structuredClone(fixture);Object.assign(zoom.visualViewport,{width:700,height:350,scale:2,offsetLeft:20,offsetTop:30});
assert.equal(analyze(zoom).rects.find(r=>r.id==='visual').x,148);
const nonfinite=structuredClone(equal);nonfinite.window.outerWidth=Infinity;assert(!analyze(nonfinite).drawable);
const failed=capture({screen:{get width(){throw new Error('controlled');}}});assert.equal(failed.screen.width,null);assert(failed.errors['screen.width']);
checks.push('geometry formulas, coincident dimensions, negative positions, overflow, zoom offsets, unknown origin and invalid readings');
const server=await serve(worker),profile=await mkdtemp('/tmp/checks-screen-profile-');
const output=process.env.SCREEN_OUTPUT||await mkdtemp('/tmp/checks-screen-review-');await mkdir(output,{recursive:true});
let browser;
try{
 for(const route of ['/screen','/screen/','/screen/app.js','/screen/geometry.js','/screen/style.css']){
  assert.equal((await worker.fetch(new Request(server.url+route))).status,200);
  assert.equal((await worker.fetch(new Request(server.url+route,{method:'POST'}))).status,405);
 }
 const p=process.env.PUPPETEER_MODULE?(await import(pathToFileURL(process.env.PUPPETEER_MODULE))).default:(await import('puppeteer-core')).default;
 browser=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,userDataDir:profile,args:process.env.ST005_NO_SANDBOX==='1'?['--no-sandbox']:[]});
 const errors=[];
 async function pageWith(data){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.setViewport({width:1360,height:900});
  if(data)await page.evaluateOnNewDocument(readings=>{
   for(const [key,value]of Object.entries(readings.screen))Object.defineProperty(screen,key,{configurable:true,get:()=>value});
   for(const [key,value]of Object.entries(readings.window))Object.defineProperty(window,key,{configurable:true,get:()=>value});
   addEventListener('DOMContentLoaded',()=>{for(const [key,value]of Object.entries(readings.document))if(key!=='fullscreen')Object.defineProperty(document.documentElement,key,{configurable:true,get:()=>value});},{once:true});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:readings.visualViewport.status==='available'?Object.assign(new EventTarget(),readings.visualViewport):undefined});
  },data);
  await page.goto(server.url+'/screen');await page.waitForFunction(()=>window.__PROBE_RESULT__?.complete);
  return page;
 }
 const real=await pageWith();
 assert.equal(await real.$eval('#drawing svg',svg=>svg.getAttribute('role')),'img');
 assert.equal(await real.evaluate(()=>window.__PROBE_RESULT__.readings.window.innerWidth),1360);
 await real.setViewport({width:1150,height:900});
 await real.waitForFunction(()=>window.__PROBE_RESULT__.readings.window.innerWidth===1150);
 assert.equal(await real.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await real.setViewport({width:390,height:844});
 await real.waitForFunction(()=>window.__PROBE_RESULT__.readings.window.innerWidth===390);
 assert.equal(await real.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await real.screenshot({path:output+'/real-mobile.png',fullPage:true});
 checks.push('real browser capture, live resize and intermediate/mobile widths without horizontal overflow');
 const desktop=await pageWith(fixture);
 assert.equal(await desktop.$eval('[data-layer="window"]',el=>el.getAttribute('data-x')),'120');
 assert.equal(await desktop.evaluate(()=>window.__PROBE_RESULT__.readings.visualViewport.width),1409);
 assert.equal(await desktop.evaluate(()=>window.__PROBE_RESULT__.readings.document.clientWidth),1409);
 assert.equal(await desktop.$eval('#visual-section',el=>el.hidden),false);
 await desktop.screenshot({path:output+'/controlled-desktop.png',fullPage:true});
 await desktop.click('#freeze');
 const timestamp=await desktop.evaluate(()=>window.__PROBE_RESULT__.capturedAt);
 await desktop.evaluate(()=>{Object.defineProperty(window,'screenX',{configurable:true,value:250});dispatchEvent(new Event('resize'));});
 await new Promise(r=>setTimeout(r,1100));
 assert.equal(await desktop.evaluate(()=>window.__PROBE_RESULT__.capturedAt),timestamp);
 await desktop.click('#refresh');assert.equal(await desktop.evaluate(()=>window.__PROBE_RESULT__.readings.window.screenX),250);
 await desktop.click('#freeze');
 await desktop.evaluate(()=>{Object.defineProperty(window,'screenX',{configurable:true,value:400});dispatchEvent(new Event('resize'));});
 await desktop.waitForFunction(()=>window.__PROBE_RESULT__.readings.window.screenX===400);
 const client=await desktop.createCDPSession();await client.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output});
 await desktop.click('#download');
 let exported;
 for(let i=0;i<30;i++){if((await readdir(output)).includes('scrapetrace-screen-geometry.json')){exported=JSON.parse(await readFile(output+'/scrapetrace-screen-geometry.json','utf8'));break;}await new Promise(r=>setTimeout(r,100));}
 assert.equal(exported.readings.window.screenX,400);
 checks.push('positioned window, UI and reserved-area gaps, freeze/refresh/resume, and local JSON export');
 const identical=await pageWith(equal);
 assert.match(await identical.$eval('#headline',el=>el.textContent),/same size/);
 assert.equal(await identical.$eval('#visual-section',el=>el.hidden),true);
 assert.equal(await identical.$('[data-layer="visual"]'),null);
 await identical.screenshot({path:output+'/controlled-identical.png',fullPage:true});
 const absent=structuredClone(equal);absent.visualViewport={status:'unavailable'};
 const unsupported=await pageWith(absent);assert.match(await unsupported.$eval('#issues',el=>el.textContent),/unavailable/);
 const invalid=await pageWith(zero);assert.equal(await invalid.$('#drawing svg'),null);assert.match(await invalid.$eval('#drawing',el=>el.textContent),/positive/);
 const mobile=structuredClone(equal);Object.assign(mobile.screen,{width:390,height:844,availWidth:390,availHeight:844});Object.assign(mobile.window,{outerWidth:390,outerHeight:844,innerWidth:390,innerHeight:750});Object.assign(mobile.document,{clientWidth:390,clientHeight:750});Object.assign(mobile.visualViewport,{width:390,height:460});
 const mobilePage=await pageWith(mobile);await mobilePage.setViewport({width:390,height:844});await mobilePage.click('#refresh');await mobilePage.screenshot({path:output+'/controlled-mobile-keyboard.png',fullPage:true});
 assert.equal(await mobilePage.$eval('#visual-section',el=>el.hidden),false);
 const zoomPage=await pageWith(zoom);assert.equal(await zoomPage.$('[data-layer="visual"]')!==null,true);
 await zoomPage.screenshot({path:output+'/controlled-visual-zoom.png',fullPage:true});
 assert.deepEqual(errors,[]);
 checks.push('identical layers hide redundant visual viewport; missing API, zero screen and zoomed viewport remain explicit');
 await writeFile(output+'/verification.json',JSON.stringify({browser:await browser.version(),checks,purpose:'Functional and layout checks. Controlled screenshots use synthetic fixtures, not scraper measurements.'},null,2));
 console.log(checks.join('\n')+'\nReview files: '+output);
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});await server.close();}
