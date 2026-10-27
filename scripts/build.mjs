import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
await mkdir(new URL('dist',root),{recursive:true});
let legacy=await read('legacy/dist/_worker.js');
legacy=legacy.replace('export default {async fetch','const legacyWorker = {async fetch');
if(!legacy.includes('const legacyWorker ='))throw new Error('Legacy export shape changed');
const detector=await read('site/assets/durability.js');
const consoleScript=detector+`\n(async () => {\n const result = await ST005.measure();\n console.table(result.rounds.map(r=>({round:r.round,relaxedMs:r.relaxed.elapsedMs,strictMs:r.strict.elapsedMs,ratio:r.ratio})));\n console.log('ST—005',result.status,result.inferredMode,'median ratio:',result.medianRatio,'cleanup:',result.cleanup.status);\n console.log(JSON.stringify(result,null,2));\n return result;\n})();\n`;
await writeFile(new URL('scripts/console.js',root),consoleScript);
const assets={'/incognito':{type:'text/html',body:await read('site/incognito/index.html')},'/incognito/style.css':{type:'text/css',body:await read('site/incognito/style.css')},'/incognito/durability.js':{type:'application/javascript',body:detector},'/incognito/app.js':{type:'application/javascript',body:await read('site/incognito/app.js')},'/incognito/console.js':{type:'application/javascript',body:consoleScript}};
// Wrap the recovered Worker; all pre-existing non-home routes delegate unchanged.
const wrapper=`\nconst INC_ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request,env,ctx){\n const path=new URL(request.url).pathname.replace(/\\/$/,'')||'/';\n if(path in INC_ASSETS){\n  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});\n  const a=INC_ASSETS[path];return new Response(request.method==='HEAD'?null:a.body,{headers:{'content-type':a.type+'; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':\"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\"}});\n }\n const response=await legacyWorker.fetch(request,env,ctx);\n if(path==='/' && request.method==='GET'){let html=await response.text();html=html.replace('03 tools / ready to run','04 tools / ready to run').replace('<div class=\"cards\">','<div class=\"cards\"><a class=\"card\" href=\"/incognito\"><span class=\"num\">ST—005 / STORAGE</span><h2>IndexedDB durability timing</h2><p>Compare strict and relaxed commit times. A transparent timing heuristic with raw measurements and explicit uncertainty.</p><span class=\"go\">Run storage experiment ↗</span></a>');return new Response(html,{status:response.status,headers:response.headers});}\n return response;\n}};\n`;
await writeFile(new URL('dist/_worker.js',root),legacy+wrapper);
await writeFile(new URL('dist/_routes.json',root),JSON.stringify({version:1,include:['/*'],exclude:[]}));
console.log('Built Checks with preserved legacy routes, /incognito, and self-contained scripts/console.js');
