import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import worker from '../dist/_worker.js';
import legacy from '../legacy/dist/_worker.js';
import {serve} from './local-server.mjs';
const checks=[];
for(const route of ['/battery','/battery/workload','/environment','/cpu-workload.js','/realm','/unknown']){
 const request=new Request('http://localhost'+route,{method:'HEAD'});
 const a=await worker.fetch(request),b=await legacy.fetch(request);
 assert.equal(a.status,b.status);assert.deepEqual([...a.headers],[...b.headers]);checks.push('preserved HEAD '+route);
}
for(const route of ['/battery?seconds=5','/battery/workload?phaseSeconds=5','/environment','/cpu-workload.js','/realm']){
 const a=await worker.fetch(new Request('http://localhost'+route));const b=await legacy.fetch(new Request('http://localhost'+route));
 // Legacy run UUID is generated separately for each response.
 const normalize=s=>s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'UUID').replace(/<style>[\s\S]*?<\/style>/g,'').replace(/<header[^>]*>[\s\S]*?<\/header>/g,'').replace(/<footer[^>]*>[\s\S]*?<\/footer>/g,'').replace(/<a class="skip-link"[^>]*>[\s\S]*?<\/a>/g,'').replace(/<link rel="icon"[^>]*>/g,'').replace(/<meta name="theme-color"[^>]*>/g,'').replace(/<main id="main">/g,'<main>');
 assert.equal(normalize(await a.text()),normalize(await b.text()));checks.push('preserved behavior markup '+route);
}
const modulePath=process.env.PUPPETEER_MODULE;
const p=modulePath?(await import(pathToFileURL(modulePath))).default:(await import('puppeteer-core')).default;
const server=await serve(worker);const profile=await mkdtemp('/tmp/st005-profile-');let browser;
try{
 browser=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,userDataDir:profile,args:process.env.ST005_NO_SANDBOX==='1'?['--no-sandbox']:[]});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(server.url+'/incognito');
 assert.equal(await page.evaluate(()=>window.__ST005_RESULT__??null),null);checks.push('no automatic measurement');
 await page.select('#runs','1');await page.click('#start');await waitComplete(page);
 const result=await page.evaluate(()=>window.__ST005_RESULT__.reports[0]);assert.equal(result.cleanup.status,'deleted');assert.equal(result.status,'measured');assert(result.rounds.length>=7);assert(result.rounds.every(r=>r.strict.commitsMs.length===15&&r.relaxed.commitsMs.length===15));
 const leftovers=await page.evaluate(async()=>(await indexedDB.databases()).filter(d=>d.name?.startsWith('__st005_')));assert.equal(leftovers.length,0);checks.push('real transactions, raw commits, awaited cleanup');
 await page.evaluate(()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined}));
 const unsupported=await page.evaluate(()=>ST005.measure());assert.equal(unsupported.status,'inconclusive');assert.equal(unsupported.inferredMode,'unknown');checks.push('missing API abstains');
 await page.reload();await page.evaluate(()=>{Object.defineProperty(IDBTransaction.prototype,'durability',{configurable:true,get(){return 'default';}});return true;});
 const hints=await page.evaluate(()=>ST005.measure());assert.equal(hints.status,'inconclusive');assert.equal(hints.cleanup.status,'deleted');checks.push('unrecognized durability abstains and cleans');
 await page.reload();await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('controlled test failure','QuotaExceededError');};});
 const failed=await page.evaluate(()=>ST005.measure());assert.equal(failed.status,'inconclusive');assert.equal(failed.cleanup.status,'deleted');checks.push('write failure abstains and cleans');
 await page.reload();await page.select('#runs','1');await page.click('#start');await waitComplete(page);
 await mkdir(new URL('../raw/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../raw/theme/incognito-results-desktop.png',import.meta.url).pathname,fullPage:true});
 await page.setViewport({width:390,height:844});await page.screenshot({path:new URL('../raw/theme/incognito-results-mobile.png',import.meta.url).pathname,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('mobile viewport fits');
 assert.deepEqual(errors,[]);checks.push('no page errors');
 // Existing passive battery retains its real browser completion contract.
 await page.goto(server.url+'/battery?seconds=5',{waitUntil:'load',timeout:25000});
 assert(await page.evaluate(()=>window.__PROBE_RESULT__?.ready));checks.push('battery real browser load completion');
}finally{await browser?.close();await rm(profile,{recursive:true,force:true});await server.close();}
await writeFile(new URL('../raw/theme/verification.json',import.meta.url),JSON.stringify({checks,passed:checks.length,timestamp:new Date().toISOString(),profileCleanup:'removed'},null,2));
console.log(checks.join('\n'));

async function waitComplete(page){const until=Date.now()+60000;while(Date.now()<until){if(await page.evaluate(()=>Boolean(window.__ST005_RESULT__?.complete)))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Completion deadline exceeded');}
