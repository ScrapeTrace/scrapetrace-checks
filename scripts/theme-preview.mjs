import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {serve} from './local-server.mjs';
import worker from '../dist/_worker.js';
const p=process.env.PUPPETEER_MODULE?(await import(pathToFileURL(process.env.PUPPETEER_MODULE))).default:(await import('puppeteer-core')).default;
const profile=await mkdtemp('/tmp/st005-theme-profile-');const server=await serve(worker);let browser;
const results=[];
try{
 browser=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,userDataDir:profile});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const [name,width,height] of [['desktop',1440,1100],['mobile',390,844]]){
  await page.setViewport({width,height});
  for(const [label,path] of [['home','/'],['battery','/battery?seconds=5'],['environment','/environment'],['incognito','/incognito']]){
   await page.goto((process.env.THEME_BASE_URL||server.url)+path,{waitUntil:'load',timeout:30000});
   await page.evaluate(()=>document.fonts.ready);
   const state=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.body).fontFamily,fontReady:document.fonts.check('16px "Inter Variable"'),accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),overflow:document.documentElement.scrollWidth>innerWidth,logoLoaded:document.querySelector('.checks-brand img')?.naturalWidth>0,navLinks:[...document.querySelectorAll('.checks-nav a')].map(a=>a.getAttribute('href')),ready:window.__PROBE_RESULT__?.ready??null,storageAutoRun:window.__ST005_RESULT__?.complete??false}));
   results.push({viewport:name,page:label,...state});
   if(state.overflow||!state.logoLoaded||!state.fontReady||state.background!=='rgb(17, 16, 21)'||state.accent!=='#b7a4f0')throw new Error('Theme regression: '+JSON.stringify(results.at(-1)));
   await page.screenshot({path:new URL('../raw/theme/'+label+'-'+name+'.png',import.meta.url).pathname,fullPage:true});
  }
 }
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser?.close();await server.close();await rm(profile,{recursive:true,force:true});}
await writeFile(new URL('../raw/theme/visual-checks.json',import.meta.url),JSON.stringify({baseUrl:process.env.THEME_BASE_URL||'local reproduction server',results,profileCleanup:'removed',browserErrors:[],timestamp:new Date().toISOString()},null,2));
console.log('Captured all four pages on desktop and mobile; local font, logo, palette and layout verified.');
