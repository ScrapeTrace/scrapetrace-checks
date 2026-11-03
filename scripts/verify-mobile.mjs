import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {analyze,collect,uaIdentity} from '../site/mobile/probe.js';
import worker from '../dist/_worker.js';
import {serve} from './local-server.mjs';
const checks=[];
const desktopUA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36';
const androidUA='Mozilla/5.0 (Linux; Android 13; Test Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
const partial={navigator:{userAgent:desktopUA,platform:'Linux x86_64',maxTouchPoints:1,vendor:'Google Inc.',languages:['en-US'],language:'en-US',hardwareConcurrency:8,deviceMemory:8,webdriver:true},userAgentData:{mobile:false,platform:'Linux',brands:[{brand:'Chromium',version:'155'}]},screen:{width:390,height:844,availWidth:390,availHeight:844,colorDepth:24},window:{innerWidth:390,innerHeight:844,outerWidth:390,outerHeight:844,devicePixelRatio:1},visualViewport:{width:390,height:844,scale:1,offsetLeft:0,offsetTop:0},media:{'(pointer: coarse)':false,'(pointer: fine)':true,'(pointer: none)':false,'(any-pointer: coarse)':false,'(any-pointer: fine)':true,'(hover: hover)':true,'(hover: none)':false,'(any-hover: hover)':true,'(orientation: portrait)':true},touchEventExposed:true,errors:{}};
let analysis=analyze(partial);assert(analysis.findings.some(f=>f.id==='compact-desktop'));assert(analysis.findings.some(f=>f.id==='mixed-input'));assert(analysis.headless);
const android=structuredClone(partial);android.navigator.userAgent=androidUA;android.navigator.platform='Linux armv8l';android.navigator.maxTouchPoints=5;android.userAgentData={mobile:true,platform:'Android',brands:[]};Object.assign(android.media,{'(pointer: coarse)':true,'(pointer: fine)':false,'(hover: hover)':false,'(any-hover: hover)':false});
assert.equal(analyze(android).findings.filter(f=>f.kind==='difference').length,0);
assert.equal(analyze(android).headless,false);
const wrongPlatform=structuredClone(android);wrongPlatform.navigator.platform='Win32';assert(analyze(wrongPlatform).findings.some(f=>f.id==='ua-navigator-platform'));
const ipad=structuredClone(android);ipad.navigator.userAgent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';ipad.userAgentData=null;
assert(analyze(ipad).findings.some(f=>f.id==='ipad-mode'));assert.equal(analyze(ipad).mobileHint,null);
const missing=collect({});assert.equal(analyze(missing).mobileHint,null);assert(!analyze(missing).findings.some(f=>f.kind==='difference'));
assert.equal(uaIdentity('Mozilla/5.0 (Windows Phone 10; Android 6.0)').os,'Windows Phone');
const headerMismatch=analyze(partial,{userAgent:androidUA,secChUaMobile:'?1',secChUaPlatform:'"Android"'});
for(const id of ['http-js-mobile','http-js-ua','http-js-platform'])assert(headerMismatch.findings.some(f=>f.id===id));
checks.push('partial mobile configuration, coherent Android signals, iPad desktop mode, missing APIs and request/JS disagreement rules');
const hostile='</pre><img src=x onerror=alert(1)>';
const response=await worker.fetch(new Request('https://test.local/mobile',{headers:{'user-agent':hostile,'sec-ch-ua-mobile':'?1','sec-ch-ua-platform':'"Android"'}}));
const html=await response.text();assert(!html.includes(hostile));assert(html.includes('&lt;/pre&gt;'));assert(!html.includes('%%REQUEST_DATA%%'));
assert.equal((await worker.fetch(new Request('https://test.local/mobile',{method:'POST'}))).status,405);
checks.push('per-request header injection is HTML-escaped; initial HTML contains no browser result');
const server=await serve(worker),profile=await mkdtemp('/tmp/checks-mobile-profile-'),output=process.env.MOBILE_OUTPUT||await mkdtemp('/tmp/checks-mobile-review-');await mkdir(output,{recursive:true});let browser;
try{
 const p=process.env.PUPPETEER_MODULE?(await import(pathToFileURL(process.env.PUPPETEER_MODULE))).default:(await import('puppeteer-core')).default;
 browser=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,userDataDir:profile,args:process.env.ST005_NO_SANDBOX==='1'?['--no-sandbox']:[]});
 const errors=[];
 async function open(fixture){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.setViewport({width:1440,height:1000});
  await page.evaluateOnNewDocument(data=>{
   addEventListener('load',()=>{window.completeAtLoad=Boolean(window.__PROBE_RESULT__?.complete);});
   if(!data)return;
   for(const[key,v]of Object.entries(data.navigator))Object.defineProperty(navigator,key,{configurable:true,value:v});
   Object.defineProperty(navigator,'userAgentData',{configurable:true,value:data.userAgentData});
   for(const[key,v]of Object.entries(data.screen))Object.defineProperty(screen,key,{configurable:true,value:v});
   for(const[key,v]of Object.entries(data.window))Object.defineProperty(window,key,{configurable:true,value:v});
   Object.defineProperty(window,'visualViewport',{configurable:true,value:data.visualViewport});
   const original=window.matchMedia.bind(window);window.matchMedia=query=>query in data.media?{matches:data.media[query],media:query}:original(query);
  },fixture);
  await page.goto(server.url+'/mobile',{waitUntil:'load'});return page;
 }
 const page=await open(partial);
 assert.equal(await page.evaluate(()=>window.completeAtLoad),true);
 assert.equal(await page.evaluate(()=>window.__PROBE_RESULT__.readings.navigator.maxTouchPoints),1);
 assert.equal(await page.evaluate(()=>window.__PROBE_RESULT__.request.userAgent!==null),true);
 assert.equal(await page.$eval('[data-finding="compact-desktop"]',el=>el.querySelector('h3').textContent),'Compact screen, desktop identity');
 const serialized=await page.content();assert(serialized.includes('navigator.userAgentData.mobile'));assert(serialized.includes('Linux x86_64'));assert(serialized.includes('"mobile": false'));assert(serialized.includes('data-status="complete"'));
 await page.screenshot({path:output+'/controlled-partial-mobile-desktop.png',fullPage:true});
 for(const width of [1250,1150,390]){await page.setViewport({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);}
 await page.screenshot({path:output+'/controlled-partial-mobile-narrow.png',fullPage:true});
 const before=await page.evaluate(()=>window.__PROBE_RESULT__.capturedAt);await page.click('#refresh');assert.notEqual(await page.evaluate(()=>window.__PROBE_RESULT__.capturedAt),before);
 checks.push('completed at navigation load; findings and JSON retained in serialized HTML; rerun and responsive widths');
 const phone=await open(android);assert.equal(await phone.$('[data-finding="headless"]'),null);
 // Request values are actual desktop headers here, so request/JS differences are expected.
 assert.equal(await phone.evaluate(()=>window.__PROBE_RESULT__.analysis.findings.some(f=>f.id==='compact-desktop')),false);
 await phone.screenshot({path:output+'/controlled-android-signals.png',fullPage:true});
 const noHints=await open(ipad);assert.equal(await noHints.evaluate(()=>window.__PROBE_RESULT__.analysis.mobileHint),null);assert(await noHints.$('[data-finding="ua-ch-unavailable"]'));
 const real=await open(null);assert.equal(await real.evaluate(()=>window.__PROBE_RESULT__.complete),true);
 const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await nojs.goto(server.url+'/mobile');assert.equal(await nojs.$('#probe-complete'),null);assert.match(await nojs.$eval('#headline',el=>el.textContent),/Not measured/);
 assert.deepEqual(errors,[]);
 checks.push('no headless notice without a marker; missing UA-CH stays unknown; real browser and no-JavaScript behavior');
 await writeFile(output+'/verification.json',JSON.stringify({browser:await browser.version(),checks,purpose:'Functional/UI verification. Controlled fixtures are synthetic and not provider measurements.'},null,2));
 console.log(checks.join('\n')+'\nReview files: '+output);
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});await server.close();}
