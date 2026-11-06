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
const consistencyTemplate=await read('site/consistency/index.html');
for(const [path,mode,title,description,link] of [
 ['/consistency','simple','User-Agent cross consistency','Compare the User-Agent reported by this page, a frame and three types of worker. Differences expand automatically.','<a href="/consistency/full">Need more detail? Compare the full navigator →</a>'],
 ['/consistency/full','full','Full navigator comparison','Inspect navigator properties across the page, frame, dedicated worker, shared worker and service worker.','<a href="/consistency">← Simple User-Agent comparison</a>']
]){
 const body=consistencyTemplate.replaceAll('%%MODE%%',mode).replaceAll('%%TITLE%%',title).replace('%%DESCRIPTION%%',description).replace('%%LINK%%',link).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer);
 assets[path]={type:'text/html',body};
}
for(const file of ['collect.js','app.js','worker.js','shared-worker.js','service-worker.js','frame.js','style.css']){
 assets['/consistency/'+file]={type:file.endsWith('.css')?'text/css':'application/javascript',body:await read('site/consistency/'+file)};
}
assets['/consistency/frame']={type:'text/html',body:await read('site/consistency/frame.html')};
assets['/screen']={type:'text/html',body:(await read('site/screen/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer)};
for(const file of ['app.js','geometry.js','style.css']){
 assets['/screen/'+file]={type:file.endsWith('.css')?'text/css':'application/javascript',body:await read('site/screen/'+file)};
}

assets['/mobile']={type:'text/html',body:(await read('site/mobile/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer)};
for(const file of ['app.js','probe.js','style.css']){
 assets['/mobile/'+file]={type:file.endsWith('.css')?'text/css':'application/javascript',body:await read('site/mobile/'+file)};
}

const keyboardProbe=await read('site/keyboard/probe.js');
const keyboardApp=await read('site/keyboard/app.js');
assets['/keyboard']={type:'text/html',body:(await read('site/keyboard/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer)};
assets['/keyboard/start.js']={type:'application/javascript',body:'(() => {\n'+keyboardProbe.replaceAll('export ','')+'\n'+keyboardApp.replace(/^import[^\n]+\n/,'')+'\n})();'};
assets['/keyboard/gate.js']={type:'application/javascript',body:'window.__KEYBOARD_GATE__?.();'};
assets['/keyboard/style.css']={type:'text/css',body:await read('site/keyboard/style.css')};
assets['/keyboard/CHROMIUM-LICENSE.txt']={type:'text/plain',body:await read('site/keyboard/CHROMIUM-LICENSE.txt')};

assets['/ai']={type:'text/html',body:(await read('site/ai/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer)};
for(const file of ['app.js','probe.js','style.css']){
 assets['/ai/'+file]={type:file.endsWith('.css')?'text/css':'application/javascript',body:await read('site/ai/'+file)};
}

assets['/speech']={type:'text/html',body:(await read('site/speech/index.html')).replace('%%SHARED_HEADER%%',header).replace('%%SHARED_FOOTER%%',footer)};
assets['/speech/frame']={type:'text/html',body:await read('site/speech/frame.html')};
for(const file of ['app.js','probe.js','frame.js','style.css']){
 assets['/speech/'+file]={type:file.endsWith('.css')?'text/css':'application/javascript',body:await read('site/speech/'+file)};
}

for(const [path,file,type] of [['/checks/logo.png','logo-transparent.png','image/png'],['/checks/inter-latin.woff2','inter-latin-normal.woff2','font/woff2']]){
 assets[path]={type,body:(await readFile(new URL('site/shared/'+file,root))).toString('base64'),base64:true};
}
const wrapper=String.raw`
const CHECK_ASSETS=ASSET_MAP;
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname.replace(/\/$/,'')||'/';
 if(Object.hasOwn(CHECK_ASSETS,path)){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  if(path==='/keyboard/gate.js' && request.method!=='HEAD')await new Promise(resolve=>setTimeout(resolve,5500));
  const a=CHECK_ASSETS[path];
  // Only document request headers are reflected; no browser readings are sent here.
  const requestData=path==='/mobile'?JSON.stringify({userAgent:request.headers.get('user-agent'),secChUaMobile:request.headers.get('sec-ch-ua-mobile'),secChUaPlatform:request.headers.get('sec-ch-ua-platform'),secChUa:request.headers.get('sec-ch-ua')}).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'):null;
  const textBody=path==='/mobile'?a.body.replace('%%REQUEST_DATA%%',()=>requestData):a.body;
  const body=request.method==='HEAD'?null:a.base64?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):textBody;
  return new Response(body,{headers:{'content-type':a.type+(a.base64?'':'; charset=utf-8'),'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src "+(path.startsWith('/keyboard')?"'self'":"'none'")+"; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors "+(["/consistency/frame","/speech/frame"].includes(path) ? "'self'" : "'none'")+(path.startsWith('/consistency') ? "; frame-src 'self'; worker-src 'self'" : path.startsWith('/speech') ? "; frame-src 'self'" : "")}});
 }
 const response=await legacyWorker.fetch(request,env,ctx);
 if(path==='/' && request.method==='GET'){
  let html=await response.text();
  html=html.replace('03 tools / ready to run','11 tools / ready to run').replace('<div class="cards">','<div class="cards"><a class="card" href="/speech"><span class="num">BROWSER / SPEECH</span><h2>Speech &amp; voices</h2><p>Inspect speech synthesis, voice loading and page/frame consistency. Try a returned voice with a click.</p><span class="go">Check speech support ↗</span></a><a class="card" href="/ai"><span class="num">BROWSER / BUILT-IN AI</span><h2>Built-in AI check</h2><p>Inspect AI interfaces, model availability and short test responses. Compare exposed APIs with working sessions.</p><span class="go">Check AI features ↗</span></a><a class="card" href="/keyboard"><span class="num">BROWSER / KEYBOARD</span><h2>Keyboard layout check</h2><p>Visualize writing-system keys, compare the full Chromium US fallback table and inspect layout-dependent platform profiles.</p><span class="go">Inspect keyboard layout ↗</span></a><a class="card" href="/mobile"><span class="num">BROWSER / MOBILE</span><h2>Mobile configuration check</h2><p>Compare screen size, touch, pointer capabilities, User-Agent and mobile client hints. See which signals agree and which differ.</p><span class="go">Inspect mobile signals ↗</span></a><a class="card" href="/screen"><span class="num">BROWSER / GEOMETRY</span><h2>Screen &amp; window geometry</h2><p>Visualize the reported screen, window and page. Inspect browser UI gaps, available screen area and visual viewport differences.</p><span class="go">Inspect screen layout ↗</span></a><a class="card" href="/consistency"><span class="num">BROWSER / CONSISTENCY</span><h2>User-Agent cross consistency</h2><p>Compare the page, frame and three worker types. Expand differences and inspect reported User-Agents.</p><span class="go">Compare User-Agents ↗</span></a><a class="card" href="/consistency/full"><span class="num">BROWSER / NAVIGATOR</span><h2>Full navigator comparison</h2><p>Inspect navigator properties and API availability across browser contexts, with local JSON export.</p><span class="go">Compare navigator properties ↗</span></a><a class="card" href="/incognito"><span class="num">ST—005 / STORAGE</span><h2>IndexedDB durability timing</h2><p>Compare strict and relaxed commit times. A transparent timing heuristic with raw measurements and explicit uncertainty.</p><span class="go">Run storage experiment ↗</span></a>');
  return new Response(html,{status:response.status,headers:response.headers});
 }
 return response;
}};
`.replace('ASSET_MAP',JSON.stringify(assets));
await writeFile(new URL('dist/_worker.js',root),legacy+wrapper);
await writeFile(new URL('dist/_routes.json',root),JSON.stringify({version:1,include:['/*'],exclude:[]}));
console.log('Built Checks with shared ScrapeTrace branding and preserved experiment code.');
