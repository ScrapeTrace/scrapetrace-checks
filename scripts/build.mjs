import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const encode=s=>JSON.stringify(s).slice(1,-1);
await mkdir(new URL('dist/',root),{recursive:true});
const theme=await read('site/shared/theme.css');
const header=(await read('site/shared/header.html')).trim();
const footer=(await read('site/shared/footer.html')).trim();
const oldLayout=await read('legacy/page.html');
const oldHeader=oldLayout.match(/<header>[\s\S]*?<\/header>/)[0];
const oldFooter=oldLayout.match(/<footer>[\s\S]*?<\/footer>/)[0];
const oldCss=await read('legacy/style.css');
let legacy=await read('legacy/dist/_worker.js');
// Only the serialized page styles and shared chrome are restyled. The recovered
// collector, workloads, network gates and result contracts remain intact.
for(const [before,after] of [[encode(oldCss),encode(oldCss+'\n'+theme)],[encode(oldHeader),encode(header)],[encode(oldFooter),encode(footer)]]){
 if(!legacy.includes(before))throw new Error('Recovered presentation anchor not found');
 legacy=legacy.replaceAll(before,after);
}
legacy=legacy.replaceAll('<main>','<main id=\\"main\\">');
legacy=legacy.replaceAll('</head>','<link rel=\\"icon\\" href=\\"/favicon.svg\\" type=\\"image/svg+xml\\"><meta name=\\"theme-color\\" content=\\"#111015\\"></head>');
legacy=legacy.replace('export default {async fetch','const legacyWorker = {async fetch');
if(!legacy.includes('const legacyWorker ='))throw new Error('Legacy export shape changed');
const detector=await read('site/assets/durability.js');
const consoleScript=detector+`\n(async () => {\n const result = await ST005.measure();\n console.table(result.rounds.map(r=>({round:r.round,relaxedMs:r.relaxed.elapsedMs,strictMs:r.strict.elapsedMs,ratio:r.ratio})));\n console.log('ST—005',result.status,result.inferredMode,'median ratio:',result.medianRatio,'cleanup:',result.cleanup.status);\n console.log(JSON.stringify(result,null,2));\n return result;\n})();\n`;
await writeFile(new URL('scripts/console.js',root),consoleScript);
const page=(await read('site/incognito/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer);
const assets={
 '/incognito':{type:'text/html',body:page},
 '/incognito/style.css':{type:'text/css',body:await read('site/incognito/style.css')},
 '/incognito/durability.js':{type:'application/javascript',body:detector},
 '/incognito/app.js':{type:'application/javascript',body:await read('site/incognito/app.js')},
 '/incognito/console.js':{type:'application/javascript',body:consoleScript},
 '/checks/theme.css':{type:'text/css',body:theme},
 '/favicon.svg':{type:'image/svg+xml',body:await read('site/shared/favicon.svg')}
};
for(const [path,file,type] of [['/checks/logo.png','logo-transparent.png','image/png'],['/checks/inter-latin.woff2','inter-latin-normal.woff2','font/woff2']]){
 assets[path]={type,body:(await readFile(new URL('site/shared/'+file,root))).toString('base64'),base64:true};
}
const wrapper=String.raw`
const CHECK_ASSETS=ASSET_MAP;
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname.replace(/\/$/,'')||'/';
 if(Object.hasOwn(CHECK_ASSETS,path)){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  const a=CHECK_ASSETS[path];
  const body=request.method==='HEAD'?null:a.base64?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body;
  return new Response(body,{headers:{'content-type':a.type+(a.base64?'':'; charset=utf-8'),'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'none'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
 }
 const response=await legacyWorker.fetch(request,env,ctx);
 if(path==='/' && request.method==='GET'){
  let html=await response.text();
  html=html.replace('03 tools / ready to run','04 tools / ready to run').replace('<div class="cards">','<div class="cards"><a class="card" href="/incognito"><span class="num">ST—005 / STORAGE</span><h2>IndexedDB durability timing</h2><p>Compare strict and relaxed commit times. A transparent timing heuristic with raw measurements and explicit uncertainty.</p><span class="go">Run storage experiment ↗</span></a>');
  return new Response(html,{status:response.status,headers:response.headers});
 }
 return response;
}};
`.replace('ASSET_MAP',JSON.stringify(assets));
await writeFile(new URL('dist/_worker.js',root),legacy+wrapper);
await writeFile(new URL('dist/_routes.json',root),JSON.stringify({version:1,include:['/*'],exclude:[]}));
console.log('Built Checks with shared ScrapeTrace branding and preserved experiment code.');
