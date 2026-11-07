import puppeteer from 'puppeteer-core';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import worker from '../dist/_worker.js';import {serve} from './local-server.mjs';
const server=await serve(worker),scratch=await mkdtemp(path.join(tmpdir(),'checks-marker-ui-'));
const output=process.env.MARKER_OUTPUT||await mkdtemp(path.join(tmpdir(),'checks-marker-review-'));await mkdir(output,{recursive:true});
let browser;const report={kind:'functional-browser-QA-not-provider-measurement',checks:[],errors:[],output};
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:process.env.HEADED!=='1',userDataDir:path.join(scratch,'profile'),args:['--no-sandbox'],env:{...process.env,MESA_SHADER_CACHE_DIR:path.join(scratch,'mesa')}});
 const context=await browser.createBrowserContext(),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(server.url+'/shader-cache');
 assert.equal(await page.evaluate(()=>window.__PROBE_READY__),undefined);assert.equal(await page.$('#probe-complete'),null);report.checks.push('default page performs no marker operation');
 await page.$eval('#namespace',e=>{e.value='functional_'+crypto.randomUUID().replaceAll('-','')});await page.$eval('#marker',e=>{e.value='BADC0FFE'});await page.click('#plant');await page.waitForSelector('#probe-complete[data-status="complete"]',{timeout:30000});const plant=await page.evaluate(()=>window.__PROBE_RESULT__);
 assert.equal(plant.status,'planted');assert.equal(plant.marker,'BADC0FFE');assert.equal(await page.$eval('#plant-url',e=>new URL(e.value).searchParams.get('marker')),plant.marker);
 const readerURL=await page.$eval('#read-url',e=>e.value);assert(!new URL(readerURL).searchParams.has('marker'));await context.close();
 const next=await browser.createBrowserContext(),reader=await next.newPage();reader.on('pageerror',e=>report.errors.push(e.message));await reader.goto(readerURL);await reader.waitForSelector('#probe-complete[data-status="complete"]',{timeout:30000});const recovered=await reader.evaluate(()=>window.__PROBE_RESULT__);assert.equal(recovered.status,'recovered');assert.equal(recovered.marker,'BADC0FFE');report.checks.push('manual writer -> generated blind-reader URL -> matching marker in a new context');
 assert.equal(await reader.$eval('#marker-result',e=>e.textContent),'BADC0FFE');assert.equal(await reader.$eval('#marker',e=>e.value),'BADC0FFE');assert.equal(await reader.$eval('#plant-url',e=>new URL(e.value).searchParams.get('marker')),'BADC0FFE');assert.equal(await reader.$eval('#integrity',e=>e.textContent),'Tag matched');assert.equal(await reader.$eval('#timings',e=>e.children.length),64);
 for(const width of [1440,768,390,320]){
  await reader.setViewport({width,height:1000});await reader.evaluate(()=>document.fonts.ready);assert(!await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert(await reader.$eval('.checks-brand img',e=>e.naturalWidth>0));
  await reader.$eval('.result',e=>e.scrollIntoView({block:'start'}));if(process.env.SKIP_SCREENSHOTS!=='1')await reader.screenshot({path:path.join(output,'result-'+width+'.png')});report.checks.push('result layout fits '+width+'px');
 }
 const exported=await reader.$eval('#report-json',e=>JSON.parse(e.textContent));assert.equal(exported.marker,recovered.marker);assert(exported.complete);assert.equal(await reader.$eval('#download',e=>e.disabled),false);report.checks.push('visible JSON/result/completion and enabled download agree');
 const renewalNS='renewal_'+randomUUID().replaceAll('-','');
 const initial=new URL('/shader-cache',server.url);initial.search=new URLSearchParams({mode:'plant',namespace:renewalNS,bank:'0',marker:'CAFE2026',autorun:'1'});
 await reader.goto(initial.href);await reader.waitForSelector('#probe-complete[data-status="complete"]',{timeout:30000});assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.status),'planted');
 let renewURL=await reader.$eval('#renew-url',e=>e.value);report.renewalRuns=[];
 for(let bank=0;bank<3;bank++){
  assert.equal(new URL(renewURL).searchParams.get('mode'),'read-renew');assert.equal(new URL(renewURL).searchParams.get('bank'),String(bank));assert(!new URL(renewURL).searchParams.has('marker'));
  const ctx=await browser.createBrowserContext(),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(renewURL);await p.waitForSelector('#probe-complete[data-status="complete"]',{timeout:60000});
  const value=await p.evaluate(()=>window.__PROBE_RESULT__);assert.equal(value.status,'recovered');assert.equal(value.marker,'CAFE2026');assert.equal(value.renewal.status,'planted');assert.equal(value.renewal.nextBank,bank+1);assert.equal(value.renewal.result.marker,value.marker);assert.equal(await p.$eval('#bank',e=>e.value),String(bank+1));
  report.renewalRuns.push(value);renewURL=await p.$eval('#renew-url',e=>e.value);assert((await p.$eval('#headline',e=>e.textContent)).includes('renewed'));await ctx.close();
 }
 const last=new URL(renewURL);last.searchParams.set('mode','read');await reader.goto(last.href);await reader.waitForSelector('#probe-complete[data-status="complete"]',{timeout:30000});assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.marker),'CAFE2026');
 report.checks.push('three autorun renewal requests across fresh contexts preserve marker and provide blind next-bank links; final plain reader validates last write');
 const exhausted=new URL(renewURL);exhausted.searchParams.set('bank','63');await reader.goto(exhausted.href);await reader.waitForSelector('#probe-complete[data-status="complete"]');assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.status),'invalid-input');report.checks.push('final-bank renewal rejected before consuming a record');
 const invalid=new URL('/shader-cache',server.url);invalid.search=new URLSearchParams({mode:'read',namespace:'invalid_control',marker:'12345678',autorun:'1'}).toString();await reader.goto(invalid.href);await reader.waitForSelector('#probe-complete[data-status="complete"]');assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.status),'invalid-input');report.checks.push('reader rejects URL-carried expected marker');
 await reader.goto(server.url+'/shader-cache?mode=read&namespace=unsupported_case&autorun=1');await reader.waitForSelector('#probe-complete[data-status="complete"]');assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.status),'no-valid-record');
 // Controlled API absence checks page-level completion, not actual GPU behavior.
 await reader.evaluateOnNewDocument(()=>{HTMLCanvasElement.prototype.getContext=function(kind){return kind==='webgl2'?null:null}});await reader.goto(server.url+'/shader-cache?mode=read&namespace=unsupported_case&autorun=1');await reader.waitForSelector('#probe-complete[data-status="complete"]');assert.equal(await reader.evaluate(()=>window.__PROBE_RESULT__.status),'unsupported');assert((await reader.$eval('#headline',e=>e.textContent)).includes('unavailable'));report.checks.push('unsupported WebGL still completes with an explicit outcome');
 await next.close();assert.deepEqual(report.errors,[]);report.browser=await browser.version();report.passed=true;
}finally{await browser?.close();await server.close();await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'ui-report.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({...report,renewalRuns:report.renewalRuns?.map(r=>({bank:r.request.bank,marker:r.marker,status:r.status,renewal:r.renewal.status,nextBank:r.renewal.nextBank}))},null,2));
