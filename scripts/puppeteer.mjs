import {readFile,writeFile,mkdir,mkdtemp,rm,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {serve} from './local-server.mjs';
import worker from '../dist/_worker.js';
const modulePath=process.env.PUPPETEER_MODULE;
const puppeteer=modulePath?(await import(pathToFileURL(modulePath))).default:(await import('puppeteer-core')).default;
const executablePath=process.env.CHROME_PATH || '/usr/bin/google-chrome';
const out=new URL('../raw/',import.meta.url);const label=process.env.ST005_LABEL||'disk';const profileRoot=process.env.ST005_PROFILE_ROOT||new URL('../.profiles/',import.meta.url).pathname;await mkdir(profileRoot,{recursive:true});await mkdir(out,{recursive:true});
const server=await serve(worker);const runs=Number(process.env.ST005_RUNS || 20),sensitivity=Number(process.env.ST005_SENSITIVITY || 10);
const report={schema:'scrapetrace/st005-benchmark/v1',startedAt:new Date().toISOString(),
 host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpus:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalMemory:os.totalmem(),loadAverage:os.loadavg(),profileFilesystem:execFileSync('df',['-T',profileRoot],{encoding:'utf8'})},
 environmentScope:'One Linux host; task-owned Chrome processes; no personal Chrome console runs; no providers.',runs:[],launches:[],cleanup:[]};
try{
 for(const headless of [false,true]){
  const userDataDir=await mkdtemp(profileRoot+'/st005-profile-');let browser;
  try{
   const args=['--no-first-run','--no-default-browser-check'];
   if(process.env.ST005_NO_SANDBOX==='1')args.push('--no-sandbox');
   const launch=async()=>puppeteer.launch({executablePath,userDataDir,headless,args,defaultViewport:{width:1280,height:1000}});
   browser=await launch();
   report.launches.push({headless,version:await browser.version(),executablePath,spawnArgs:browser.process().spawnargs,userDataDir});
   const normal=await browser.newPage();await normal.goto(server.url+'/incognito');
   await normal.evaluate(()=>localStorage.setItem('st005-persistence','sentinel'));
   await browser.close();browser=await launch();
   const page=await browser.newPage();await page.goto(server.url+'/incognito');
   const retained=await page.evaluate(()=>localStorage.getItem('st005-persistence'));
   if(retained!=='sentinel')throw new Error('Default context failed persistence check');
   const context=await browser.createBrowserContext();const privatePage=await context.newPage();await privatePage.goto(server.url+'/incognito');
   const isolated=await privatePage.evaluate(()=>localStorage.getItem('st005-persistence'));
   if(isolated!==null)throw new Error('Nondefault context unexpectedly shares storage');
   report.launches.at(-1).checks={defaultStorageSurvivedRestart:true,nondefaultStorageIsolated:true};
   // Keep one measurement page at a time active; activate before every series.
   for(const [kind,target] of [['persistent-default',page],['nonpersistent-context',privatePage]]){
    await target.bringToFront();
    for(const [order,count] of [['relaxed-first',runs],['alternating',sensitivity]]){
     for(let i=0;i<count;i++){
      const result=await target.evaluate(opts=>ST005.measure(opts),{order});
      report.runs.push({headless,kind,order,index:i+1,result});
      if(result.cleanup.status!=='deleted')throw new Error('Temporary database not cleaned');
      console.log(JSON.stringify({headless,kind,order,run:i+1,ratio:result.medianRatio,status:result.status}));
      await writeFile(new URL(label+'-measurements.json',out),JSON.stringify(report,null,2));
     }
    }
   }
   await privatePage.bringToFront();await privatePage.select('#runs','5');await privatePage.click('#start');
   await waitComplete(privatePage);
   await privatePage.screenshot({path:new URL(label+'-'+(headless?'headless':'headed')+'-nonpersistent.png',out).pathname,fullPage:true});
   await writeFile(new URL(label+'-ui-'+(headless?'headless':'headed')+'.json',out),JSON.stringify(await privatePage.evaluate(()=>window.__ST005_RESULT__),null,2));
   report.launches.at(-1).indexedDbFiles=await readdir(userDataDir+'/Default/IndexedDB',{recursive:true}).catch(e=>[String(e)]);await context.close();
  } finally{if(browser)await browser.close().catch(()=>{});await rm(userDataDir,{recursive:true,force:true});report.cleanup.push({path:userDataDir,status:'removed'});}
 }
}finally{await server.close();report.finishedAt=new Date().toISOString();await writeFile(new URL(label+'-measurements.json',out),JSON.stringify(report,null,2));}

async function waitComplete(page){const until=Date.now()+60000;while(Date.now()<until){if(await page.evaluate(()=>Boolean(window.__ST005_RESULT__?.complete)))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Completion deadline exceeded');}
