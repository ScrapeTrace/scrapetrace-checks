import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FALLBACK,US_CORE,WRITING_KEYS,analyze,measure} from '../site/keyboard/probe.js';
import worker from '../dist/_worker.js';
import {serve} from './local-server.mjs';
const checks=[];
assert.equal(WRITING_KEYS.length,50);assert.equal(new Set(WRITING_KEYS).size,50);assert.equal(Object.keys(US_CORE).length,47);assert.equal(Object.keys(FALLBACK).length,49);
const western={...US_CORE,IntlBackslash:'<'};
const sample=map=>({status:'measured',environment:{userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/154.0',platform:'Linux x86_64',clientHintPlatform:'Linux'},api:{},entries:Object.entries(map)});
let analysis=analyze(sample(FALLBACK));assert(analysis.fallbackMatch);assert.equal(analysis.originHint,'unknown');assert.equal(analysis.compatibility,'Not assessed');
assert.equal(analyze(sample(western)).originHint,'unix');assert.equal(analyze(sample(western)).compatibility,'Compatible with profile');
assert.equal(analyze(sample({...western,IntlBackslash:'§'})).compatibility,'Profile / claim difference');
assert.equal(analyze(sample({...western,Backslash:'#',IntlBackslash:'\\'})).originHint,'unknown');
assert.equal(analyze(sample({...FALLBACK,KeyB:'x'})).fallbackMatch,false);
assert.equal(analyze(sample({...western,IntlRo:'/'})).originHint,'unknown');
assert.equal(analyze(sample({...western,IntlRo:'/'})).fallbackMatch,false);
assert.equal(analyze(sample({...FALLBACK,IntlRo:'_'})).fallbackMatch,false);
assert.equal(analyze(sample({...western,KeyQ:'a',KeyW:'z',KeyA:'q'})).layoutFamily,'AZERTY');
const fake=fn=>({isSecureContext:true,navigator:{keyboard:{getLayoutMap:fn},userAgent:'Linux',platform:'Linux x86_64'}});
assert.equal((await measure(fake(()=>new Map(Object.entries(FALLBACK))))).status,'measured');
assert.equal((await measure(fake(()=>new Map()))).status,'empty');
assert.equal((await measure(fake(()=>new Promise(()=>{})),5)).status,'timeout');
assert.equal((await measure(fake(()=>({KeyA:'a'})))).status,'invalid-result');
assert.equal((await measure(fake(()=>Promise.reject(new DOMException('blocked','SecurityError'))))).status,'denied');
assert.equal((await measure({isSecureContext:false,navigator:{}})).status,'insecure-context');
assert.equal((await measure({isSecureContext:true,navigator:{keyboard:{}}})).status,'method-unavailable');
checks.push('exact 49-entry reference; 48-key profiles; UK, modified, JIS-like and ABNT-like controls; empty/unsupported/denied/timeout distinctions');
const server=await serve(worker),profile=await mkdtemp('/tmp/checks-keyboard-profile-'),output=process.env.KEYBOARD_OUTPUT||await mkdtemp('/tmp/checks-keyboard-review-');await mkdir(output,{recursive:true});let browser,headed;
const errors=[];
try{
 const p=process.env.PUPPETEER_MODULE?(await import(pathToFileURL(process.env.PUPPETEER_MODULE))).default:(await import('puppeteer-core')).default;
 browser=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,userDataDir:profile,args:process.env.ST005_NO_SANDBOX==='1'?['--no-sandbox']:[]});
 async function open(kind,owner=browser){
  const context=await owner.createBrowserContext();
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.setViewport({width:1440,height:1000});
  await page.evaluateOnNewDocument(({kind,fallback,western})=>{
   addEventListener('load',()=>{window.completeAtLoad=Boolean(window.__PROBE_RESULT__?.complete);});
   if(kind==='real')return;
   const fixtures={fallback,western,uk:{...western,Backslash:'#',IntlBackslash:'\\'},abnt:{...western,IntlRo:'/'},empty:{}};
   const keyboard=kind==='absent'?undefined:kind==='missing'?{}:{getLayoutMap(){
    if(kind==='denied')return Promise.reject(new DOMException('controlled denial','SecurityError'));
    if(kind==='timeout')return new Promise(()=>{});
    if(kind==='malicious')return Promise.resolve(new Map([['KeyA','<img src=x onerror=alert(1)>']]));
    return Promise.resolve(new Map(Object.entries(fixtures[kind])));
   }};
   Object.defineProperty(navigator,'keyboard',{configurable:true,value:keyboard});
  },{kind,fallback:FALLBACK,western});
  await page.goto(server.url+'/keyboard',{waitUntil:'load',timeout:20000});
  assert.equal(await page.evaluate(()=>window.completeAtLoad),true);
  assert.equal(await page.evaluate(()=>window.__NETWORK_GATE__.released),true);
  return page;
 }
 // Isolated contexts also keep HTTP/1 connection pools independent of the three network gates.
 const kinds=['real','fallback','western','uk','abnt','empty','absent','missing','denied','timeout','malicious'];
 const pages=await Promise.all(kinds.map(kind=>open(kind)));
 const byKind=Object.fromEntries(kinds.map((kind,i)=>[kind,pages[i]]));
 const result=async kind=>byKind[kind].evaluate(()=>window.__PROBE_RESULT__);
 assert((await result('fallback')).analysis.fallbackMatch);assert.equal((await result('western')).entries.length,48);
 assert.equal((await result('uk')).analysis.originHint,'unknown');assert.equal((await result('abnt')).analysis.originHint,'unknown');
 for(const[kind,status]of [['empty','empty'],['absent','keyboard-unavailable'],['missing','method-unavailable'],['denied','denied'],['timeout','timeout']])assert.equal((await result(kind)).status,status);
 assert.equal(await byKind.malicious.$('#keyboard img'),null);
 assert.equal(await byKind.fallback.$$eval('#keyboard .key',keys=>keys.length),50);
 const html=await byKind.fallback.content();assert(html.includes('Chromium US fallback map match'));assert(html.includes('IntlYen'));assert(html.includes('data-status="complete"'));
 await byKind.fallback.screenshot({path:output+'/controlled-fallback-desktop.png',fullPage:true});
 await byKind.western.screenshot({path:output+'/controlled-western-desktop.png',fullPage:true});
 for(const width of [1360,1150,390]){await byKind.fallback.setViewport({width,height:844});assert.equal(await byKind.fallback.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await byKind.fallback.screenshot({path:output+'/controlled-fallback-mobile.png',fullPage:true});
 const real=await result('real');await writeFile(output+'/real-headless-result.json',JSON.stringify(real,null,2));
 const networkContext=await browser.createBrowserContext();const networkPage=await networkContext.newPage();await networkPage.goto(server.url+'/keyboard',{waitUntil:'networkidle2',timeout:20000});assert.equal(await networkPage.evaluate(()=>window.__PROBE_RESULT__?.complete),true);
 const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await nojs.goto(server.url+'/keyboard');assert.equal(await nojs.$('#probe-complete'),null);
 checks.push('networkidle2 waits through completion; no-JavaScript page remains unmeasured');
 checks.push('real API plus controlled full-map/profile/error cases; ready at load; network gates released; safe text and serialized HTML; desktop/mobile layouts');
 await byKind.fallback.click('#run');await byKind.fallback.waitForFunction(()=>window.__PROBE_RESULT__?.complete);assert((await result('fallback')).analysis.fallbackMatch);
 if(process.env.DISPLAY){
  headed=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:false,args:process.env.ST005_NO_SANDBOX==='1'?['--no-sandbox']:[]});
  const page=await open('real',headed);const result=await page.evaluate(()=>window.__PROBE_RESULT__);await writeFile(output+'/real-headed-result.json',JSON.stringify(result,null,2));
  checks.push('task-owned headed Chrome API call recorded separately from synthetic fixtures');
 }
 assert.deepEqual(errors,[]);
 await writeFile(output+'/verification.json',JSON.stringify({browser:await browser.version(),checks,purpose:'Functional/UI verification. Synthetic fixtures are not provider measurements; real task-owned browser results are separately labeled.'},null,2));
 console.log(checks.join('\n')+'\nHeadless API: '+real.status+'; entries: '+real.entries.length+'; fallback match: '+real.analysis.fallbackMatch+'\nReview files: '+output);
}finally{await headed?.close();await browser?.close();await rm(profile,{recursive:true,force:true});await server.close();}
